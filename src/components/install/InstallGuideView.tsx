import React, { useMemo, useState } from 'react';
import {
  AppWindow,
  Check,
  CheckCircle2,
  Copy,
  Download,
  MonitorDown,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useKovaStore } from '../../store/useKovaStore';

export const InstallGuideView: React.FC = () => {
  const { appSettings, inferenceSettings } = useKovaStore();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copiedScript, setCopiedScript] = useState(false);
  const [pwaNotice, setPwaNotice] = useState<string | null>(null);

  const ps1Script = useMemo(() => {
    const modelsDir = appSettings.modelsDir.replace('%APPDATA%', '$env:APPDATA');
    const backendFlag =
      inferenceSettings.gpuBackend === 'cpu'
        ? 'cpu'
        : inferenceSettings.gpuBackend === 'vulkan'
          ? 'vulkan'
          : 'cuda12.4';

    return `# Kova Studio — Автоматическая установка Windows окружения (1-клик)
$ErrorActionPreference = "Stop"
$ModelsDir = "${modelsDir}"
$BinDir = "$env:LOCALAPPDATA\\KovaStudio\\bin"

Write-Host "1/4. Создание локальных каталогов..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

Write-Host "2/4. Проверка Edge WebView2 Runtime..." -ForegroundColor Cyan
$wv2 = Get-ItemProperty "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
if (-not $wv2) {
  Write-Host "Загрузка Evergreen WebView2 Bootstrapper..." -ForegroundColor Yellow
  Invoke-WebRequest "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile "$env:TEMP\\MicrosoftEdgeWebview2Setup.exe"
  Start-Process "$env:TEMP\\MicrosoftEdgeWebview2Setup.exe" -ArgumentList "/silent /install" -Wait
}

Write-Host "3/4. Подготовка sidecar llama-server.exe (${backendFlag})..." -ForegroundColor Cyan
# В релизе URL указывает на актуальный архив llama.cpp Windows x64 (${backendFlag})
$LlamaApi = "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest"
$Release = Invoke-RestMethod -Uri $LlamaApi -Headers @{ "User-Agent" = "KovaStudio-Installer" }
$Asset = $Release.assets | Where-Object { $_.name -match "bin-win-${backendFlag === 'vulkan' ? 'vulkan' : backendFlag === 'cpu' ? 'avx2' : 'cuda-cu12'}.*x64\\.zip$" } | Select-Object -First 1
if ($Asset) {
  $ZipPath = "$env:TEMP\\llama-server.zip"
  Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $ZipPath
  Expand-Archive -Path $ZipPath -DestinationPath $BinDir -Force
  Remove-Item $ZipPath -Force
}

Write-Host "4/4. Готово! Каталог моделей: $ModelsDir" -ForegroundColor Green
Write-Host "Запустите Kova Studio и выберите модель GGUF во вкладке 'Модели GGUF'." -ForegroundColor Green`;
  }, [appSettings.modelsDir, inferenceSettings.gpuBackend]);

  const handleDownloadPs1 = () => {
    const blob = new Blob([ps1Script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'install-kova-studio.ps1';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyPs1 = () => {
    navigator.clipboard?.writeText(ps1Script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 1700);
  };

  const handlePwaClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setPwaNotice('Kova Studio успешно установлено как отдельное десктопное окно.');
      }
    } else {
      setPwaNotice(
        'Если вы открыли приложение во встроенном iframe-превью, откройте прямую ссылку Shared App URL в Microsoft Edge или Google Chrome и нажмите иконку «Установить приложение» в адресной строке.',
      );
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50 dark:bg-[#09090B]">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="pb-5 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Установка на ПК в один клик и инструкция развёртывания
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-3xl">
            Установите Kova Studio на Windows 10/11 мгновенно как автономное десктопное PWA-приложение или разверните локальное окружение <span className="font-mono">llama-server.exe</span> одним PowerShell-скриптом.
          </p>
        </div>

        {/* Two Primary 1-Click Install Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Card 1: PWA 1-Click */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-6 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                  Вариант 1 · Веб-приложение Windows (PWA)
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
                Установка окна приложения в один клик
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Устанавливает Kova Studio в меню «Пуск» и на рабочий стол Windows 10/11 без рамки браузера, с кэшированием интерфейса для работы оффлайн.
              </p>

              <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300 pt-1">
                <li>· Работает в Microsoft Edge и Google Chrome на Windows 10/11</li>
                <li>· Мгновенный запуск из панели задач как отдельного приложения</li>
                <li>· Service Worker обновляется автоматически в фоне</li>
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
                      ? 'Установить Kova Studio на ПК сейчас'
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

          {/* Card 2: Windows PowerShell 1-Click Script */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-6 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                Вариант 2 · Нативный Windows-скрипт (WebView2 + llama-server.exe)
              </div>
              <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-500" />
                Автоматический установщик для Windows (.ps1)
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Скрипт сформирован под ваши текущие настройки: каталог моделей{' '}
                <span className="font-mono">{appSettings.modelsDir}</span> и ускорение{' '}
                <span className="font-mono">{inferenceSettings.detectedBackend}</span>.
              </p>

              <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300 pt-1">
                <li>· Проверяет и ставит Microsoft Edge WebView2 при необходимости</li>
                <li>· Скачивает последний релиз <span className="font-mono">llama-server.exe</span> под ваш GPU</li>
                <li>· Создаёт папки в <span className="font-mono">%APPDATA%</span> без установки Python или Ollama</li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadPs1}
                className="flex-1 h-10 px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Скачать install-kova-studio.ps1</span>
              </button>
              <button
                type="button"
                onClick={handleCopyPs1}
                className="h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Step-by-Step Guide + Script Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              Пошаговая инструкция установки и сборки
            </h3>
            <ol className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <li>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">1. Быстрый запуск как PWA:</span>{' '}
                Откройте приложение в Edge или Chrome и нажмите кнопку «Установить на ПК» выше (либо иконку установки справа в адресной строке).
              </li>
              <li>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">2. Развёртывание локального движка:</span>{' '}
                Скачайте <span className="font-mono">install-kova-studio.ps1</span> и запустите его правой кнопкой мыши → <em>«Выполнить с помощью PowerShell»</em>.
              </li>
              <li>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">3. Сборка собственного .exe/.msi (Tauri 2.0):</span>{' '}
                При наличии Rust (MSVC toolchain) и Node.js 22 выполните в корне репозитория:
                <div className="mt-1.5 p-2 rounded bg-zinc-950 text-zinc-200 font-mono text-[11px]">
                  npm install && npm run tauri build
                </div>
              </li>
              <li>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">4. Загрузка первой GGUF-модели:</span>{' '}
                Откройте вкладку «Модели GGUF», выберите квантизацию <span className="font-mono">Q4_K_M</span> и дождитесь проверки SHA256.
              </li>
            </ol>
          </div>

          <div className="lg:col-span-7 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-xs">
              <span className="font-mono text-zinc-300">install-kova-studio.ps1</span>
              <span className="text-zinc-500 font-mono">PowerShell 5.1+ / 7+</span>
            </div>
            <pre className="p-4 font-mono text-[11.5px] leading-5 overflow-x-auto max-h-80 overflow-y-auto">
              {ps1Script}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
