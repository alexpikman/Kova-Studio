import React, { useMemo, useState } from 'react';
import {
  AppWindow,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  Github,
  MonitorDown,
  Package,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useKovaStore } from '../../store/useKovaStore';

type PreviewTab = 'ps1' | 'readme' | 'workflow';

export const InstallGuideView: React.FC = () => {
  const { appSettings, inferenceSettings, githubAccess, updateGitHubAccess } = useKovaStore();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const githubRepo = githubAccess.repoOwnerSlashName;
  const githubBranch = githubAccess.defaultBranch;
  const setGithubRepo = (val: string) => updateGitHubAccess({ repoOwnerSlashName: val });
  const setGithubBranch = (val: string) => updateGitHubAccess({ defaultBranch: val });
  const [forceBuildFromSource, setForceBuildFromSource] = useState(false);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('ps1');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pwaNotice, setPwaNotice] = useState<string | null>(null);

  const cleanRepo = githubRepo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '') || 'owner/repo';
  const cleanBranch = githubBranch.trim() || 'main';

  const rawScriptUrl = `https://raw.githubusercontent.com/${cleanRepo}/${cleanBranch}/scripts/install.ps1`;
  const githubReleasesUrl = `https://github.com/${cleanRepo}/releases/latest`;
  const githubRepoUrl = `https://github.com/${cleanRepo}`;

  const oneLineCommand = forceBuildFromSource
    ? `& ([scriptblock]::Create((irm "${rawScriptUrl}"))) -Repo "${cleanRepo}" -Branch "${cleanBranch}" -BuildFromSource`
    : `irm "${rawScriptUrl}" | iex`;

  const ps1Script = useMemo(() => {
    const modelsDir = appSettings.modelsDir.replace('%APPDATA%', '$env:APPDATA');
    const backendFlag =
      inferenceSettings.gpuBackend === 'cpu'
        ? 'cpu'
        : inferenceSettings.gpuBackend === 'vulkan'
          ? 'vulkan'
          : 'auto';

    return `# Kova Studio — Автоматическая установка и сборка .exe/.msi (Tauri 2.0 + llama.cpp)
param(
    [string]$Repo = "${cleanRepo}",
    [string]$Branch = "${cleanBranch}",
    [string]$InstallDir = "$env:LOCALAPPDATA\\KovaStudio\\src",
    [string]$ModelsDir = "${modelsDir}",
    [string]$GpuBackend = "${backendFlag}",
    [switch]$BuildFromSource${forceBuildFromSource ? ' = $true' : ''}
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$BinDir = "$env:LOCALAPPDATA\\KovaStudio\\bin"
New-Item -ItemType Directory -Force -Path $ModelsDir, $BinDir | Out-Null

# 1. Microsoft Edge WebView2 Runtime
$wv2 = Get-ItemProperty "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
if (-not $wv2) {
    Invoke-WebRequest "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile "$env:TEMP\\MicrosoftEdgeWebview2Setup.exe"
    Start-Process "$env:TEMP\\MicrosoftEdgeWebview2Setup.exe" -ArgumentList "/silent /install" -Wait
}

# 2. Автоопределение GPU и загрузка llama-server.exe
$resolved = if ($GpuBackend -eq "auto") { if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { "cuda" } else { "vulkan" } } else { $GpuBackend }
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest" -Headers @{ "User-Agent" = "KovaStudio" }
$pattern = switch ($resolved) { "cuda" { "bin-win-cuda-cu12.*x64\\.zip$" } "vulkan" { "bin-win-vulkan-x64\\.zip$" } default { "bin-win-avx2-x64\\.zip$" } }
$asset = $release.assets | Where-Object { $_.name -match $pattern } | Select-Object -First 1
if ($asset) {
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile "$env:TEMP\\llama-win.zip"
    Expand-Archive "$env:TEMP\\llama-win.zip" -DestinationPath $BinDir -Force
}

# 3. Установка готового .exe/.msi из GitHub Releases (если не выбрана принудительная сборка)
if (-not $BuildFromSource) {
    try {
        $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ "User-Agent" = "KovaStudio" }
        $inst = $rel.assets | Where-Object { $_.name -match "\\.(msi|exe)$" } | Select-Object -First 1
        if ($inst) {
            $out = "$env:TEMP\\$($inst.name)"
            Invoke-WebRequest -Uri $inst.browser_download_url -OutFile $out
            if ($out.EndsWith(".msi")) { Start-Process msiexec.exe -ArgumentList "/i \`"$out\`" /passive" -Wait }
            else { Start-Process $out -ArgumentList "/S" -Wait }
            return
        }
    } catch { Write-Host "Релиз не найден, собираем .exe/.msi из исходников..." -ForegroundColor Yellow }
}

# 4. Установка зависимостей сборки (Git, Node.js LTS, Rust, VS C++ Build Tools)
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { winget install --id Rustlang.Rustup -e --silent --accept-package-agreements --accept-source-agreements }
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")

# 5. Клонирование с GitHub и сборка Tauri 2.0 (.exe / .msi)
if (Test-Path "$InstallDir\\.git") { Push-Location $InstallDir; git pull origin $Branch }
else { git clone --branch $Branch "https://github.com/$Repo.git" $InstallDir; Push-Location $InstallDir }

$sidecarDir = Join-Path $InstallDir "src-tauri\\binaries"
New-Item -ItemType Directory -Force -Path $sidecarDir | Out-Null
$llama = Get-ChildItem -Path $BinDir -Filter "llama-server.exe" -Recurse | Select-Object -First 1
if ($llama) { Copy-Item $llama.FullName (Join-Path $sidecarDir "llama-server-x86_64-pc-windows-msvc.exe") -Force }

npm install
npx @tauri-apps/cli@2 icon public/pwa-512x512.png
npx @tauri-apps/cli@2 build
Pop-Location`;
  }, [appSettings.modelsDir, inferenceSettings.gpuBackend, cleanRepo, cleanBranch, forceBuildFromSource]);

  const readmePreview = useMemo(() => {
    return `# Kova Studio — Автономный Windows ИИ-агент (Tauri 2.0 + llama.cpp)

Десктопный Cline-подобный ИИ-агент для Windows 10/11 на базе **Tauri 2.0 (Rust + WebView2)** и sidecar-движка **\`llama-server.exe\`** без Ollama и Python.

## Установка на ПК в один клик (Windows PowerShell)

\`\`\`powershell
irm ${rawScriptUrl} | iex
\`\`\`

Прямая ссылка на скрипт автоматической установки:
- ${rawScriptUrl}

Готовые установщики (.exe / .msi):
- ${githubReleasesUrl}

## Ручная сборка собственного .exe / .msi

\`\`\`bash
npm install
npx @tauri-apps/cli@2 icon public/pwa-512x512.png
npm run tauri:build
\`\`\`

Результаты сборки:
- \`src-tauri/target/release/bundle/nsis/Kova Studio_0.1.0_x64-setup.exe\`
- \`src-tauri/target/release/bundle/msi/Kova Studio_0.1.0_x64_en-US.msi\``;
  }, [rawScriptUrl, githubReleasesUrl]);

  const workflowPreview = `name: Build Windows Installer (.exe / .msi)
on:
  push:
    branches: [main]
    tags: ['v*']
  workflow_dispatch:

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - uses: dtolnay/rust-toolchain@stable
      - run: npm install && npx @tauri-apps/cli@2 icon public/pwa-512x512.png
      # Загрузка llama-server.exe в src-tauri/binaries/llama-server-x86_64-pc-windows-msvc.exe
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}`;

  const copyText = (id: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePwaClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setPwaNotice('Kova Studio успешно установлено как отдельное десктопное окно.');
      }
    } else {
      setPwaNotice(
        'Откройте прямую ссылку Shared App URL в Microsoft Edge или Google Chrome и нажмите иконку «Установить приложение» в адресной строке.',
      );
    }
  };

  const activePreviewContent =
    previewTab === 'ps1' ? ps1Script : previewTab === 'readme' ? readmePreview : workflowPreview;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50 dark:bg-[#09090B]">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="pb-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Сборка .exe/.msi (Tauri 2.0) и автоустановка с GitHub
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-3xl">
              Настройте ссылку на ваш GitHub-репозиторий для автоматического скачивания Kova Studio и установки всех зависимостей Windows (WebView2, Git, Node.js, Rust, MSVC, <span className="font-mono">llama-server.exe</span>) в один клик.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/install.ps1"
              download="install-kova-studio.ps1"
              className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              <span>scripts/install.ps1</span>
            </a>
            <button
              type="button"
              onClick={() => downloadFile('README.md', readmePreview)}
              className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-blue-500" />
              <span>Скачать README.md</span>
            </button>
          </div>
        </div>

        {/* GitHub 1-Click Link & Command Generator */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Github className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
              <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Ссылка GitHub для автоматической установки и сборки
              </h2>
            </div>
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              README.md · scripts/install.ps1 · .github/workflows/build-windows.yml
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                GitHub репозиторий (owner/repo)
              </label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="username/kova-studio"
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Ветка (branch)
              </label>
              <div className="relative">
                <GitBranch className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.target.value)}
                  placeholder="main"
                  className="w-full h-9 pl-8 pr-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="md:col-span-4 flex items-end">
              <label className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between gap-2 cursor-pointer text-xs text-zinc-700 dark:text-zinc-300">
                <span>Принудительно собирать .exe/.msi из исходников</span>
                <input
                  type="checkbox"
                  checked={forceBuildFromSource}
                  onChange={(e) => setForceBuildFromSource(e.target.checked)}
                  className="accent-blue-600 w-4 h-4"
                />
              </label>
            </div>
          </div>

          {/* Copyable 1-click PowerShell Command */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-emerald-400">
                Команда Windows PowerShell (1-клик установка приложения + всех зависимостей)
              </span>
              <button
                type="button"
                onClick={() => copyText('one-line', oneLineCommand)}
                className="h-7 px-2.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100 inline-flex items-center gap-1.5 transition-colors"
              >
                {copiedId === 'one-line' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedId === 'one-line' ? 'Скопировано' : 'Копировать команду'}</span>
              </button>
            </div>
            <div className="font-mono text-xs text-zinc-100 break-all select-all bg-zinc-900/90 px-3 py-2 rounded border border-zinc-800">
              {oneLineCommand}
            </div>
          </div>

          {/* Direct Links Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Прямая ссылка на скрипт автоустановки (GitHub Raw)
                </div>
                <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                  {rawScriptUrl}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => copyText('raw-url', rawScriptUrl)}
                  className="h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1"
                  title="Копировать ссылку"
                >
                  {copiedId === 'raw-url' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={rawScriptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1"
                  title="Открыть на GitHub"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Страница готовых сборок .exe / .msi (GitHub Releases)
                </div>
                <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                  {githubReleasesUrl}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1 text-[11px]"
                >
                  <span>Репозиторий</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={githubReleasesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white inline-flex items-center gap-1 text-[11px] font-medium"
                >
                  <span>Releases</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Two Primary Deployment Cards: Tauri 2.0 Native Build vs PWA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Card 1: Tauri 2.0 .exe / .msi */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-6 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                Сборка .exe (NSIS) / .msi (WiX) · Tauri 2.0 + Sidecar
              </div>
              <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-500" />
                Нативный установщик Windows с авто-зависимостями
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Проект уже включает конфиг <span className="font-mono">src-tauri/</span> и GitHub Actions workflow. Скрипт{' '}
                <span className="font-mono">install.ps1</span> сам ставит недостающие компоненты и собирает <span className="font-mono">.exe</span>/<span className="font-mono">.msi</span>.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">Рантайм и GPU</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    WebView2 + llama-server.exe ({inferenceSettings.detectedBackend})
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">Стек сборки (winget)</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Git · Node.js LTS · Rust · MSVC Build Tools
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadFile('install-kova-studio.ps1', ps1Script)}
                className="flex-1 h-10 px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Скачать скрипт под текущий репозиторий (.ps1)</span>
              </button>
              <button
                type="button"
                onClick={() => copyText('ps1', ps1Script)}
                className="h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {copiedId === 'ps1' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'ps1' ? 'Скопировано' : 'Копировать .ps1'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: PWA 1-Click */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-6 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                  Мгновенный запуск · Веб-приложение Windows (PWA)
                </span>
                {isInstalled && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Установлено
                  </span>
                )}
              </div>
              <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <AppWindow className="w-5 h-5 text-blue-500" />
                Установка окна PWA в один клик (без компиляции)
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Устанавливает Kova Studio в меню «Пуск» и панель задач Windows 10/11 без рамки браузера, с автообновлением Service Worker и оффлайн-кэшем.
              </p>

              <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300 pt-1">
                <li>· Работает в Microsoft Edge и Google Chrome на Windows 10/11</li>
                <li>· Не требует Rust или Visual Studio Build Tools</li>
                <li>· Идеально как лёгкий клиент для локального сервера</li>
              </ul>
            </div>

            <div className="space-y-2.5">
              {isInstalled ? (
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-700 dark:text-emerald-300">
                  Приложение уже запущено в автономном режиме Standalone.
                </div>
              ) : isIOS ? (
                <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-300">
                  На iPad/iOS: нажмите кнопку «Поделиться» в Safari и выберите «На экран «Домой»».
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handlePwaClick}
                  className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <MonitorDown className="w-4 h-4" />
                  <span>
                    {isInstallable
                      ? 'Установить Kova Studio (PWA) на ПК сейчас'
                      : 'Установить на ПК (PWA / Инструкция)'}
                  </span>
                </button>
              )}

              {pwaNotice && (
                <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/5 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {pwaNotice}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step-by-Step Build Guide + Tabbed Files Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              Как опубликовать и собрать .exe/.msi
            </h3>
            <ol className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <li>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">1. Загрузка на GitHub:</span>{' '}
                Запушьте проект в репозиторий <span className="font-mono">{cleanRepo}</span>. Workflow{' '}
                <span className="font-mono">.github/workflows/build-windows.yml</span> автоматически соберёт <span className="font-mono">.exe</span> и <span className="font-mono">.msi</span> на <span className="font-mono">windows-latest</span>.
              </li>
              <li>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">2. Установка пользователем в 1 клик:</span>{' '}
                Скопируйте команду <span className="font-mono">irm ... | iex</span> из <span className="font-mono">README.md</span> — скрипт проверит Release или установит зависимости через <span className="font-mono">winget</span> и соберёт проект локально.
              </li>
              <li>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">3. Ручная сборка на Windows:</span>{' '}
                Разместите <span className="font-mono">llama-server.exe</span> в{' '}
                <span className="font-mono">src-tauri/binaries/llama-server-x86_64-pc-windows-msvc.exe</span> и выполните:
                <div className="mt-1.5 p-2.5 rounded bg-zinc-950 text-zinc-200 font-mono text-[11px] space-y-1">
                  <div>npm install</div>
                  <div>npx @tauri-apps/cli@2 icon public/pwa-512x512.png</div>
                  <div>npm run tauri:build</div>
                </div>
              </li>
              <li className="flex items-start gap-2 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                <Wrench className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-400" />
                <span>
                  Выходные файлы: <span className="font-mono">src-tauri/target/release/bundle/nsis/*.exe</span> и <span className="font-mono">msi/*.msi</span>.
                </span>
              </li>
            </ol>
          </div>

          <div className="lg:col-span-7 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-200 overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewTab('ps1')}
                  className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors ${
                    previewTab === 'ps1' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  scripts/install.ps1
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('readme')}
                  className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors ${
                    previewTab === 'readme' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  README.md
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('workflow')}
                  className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors ${
                    previewTab === 'workflow' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  build-windows.yml
                </button>
              </div>
              <button
                type="button"
                onClick={() => copyText(`tab-${previewTab}`, activePreviewContent)}
                className="px-2 py-1 rounded hover:bg-zinc-800 text-zinc-300 text-[11px] inline-flex items-center gap-1"
              >
                {copiedId === `tab-${previewTab}` ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedId === `tab-${previewTab}` ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
            <pre className="p-4 font-mono text-[11.5px] leading-5 overflow-x-auto max-h-96 overflow-y-auto flex-1">
              {activePreviewContent}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
