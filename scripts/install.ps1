<#
.SYNOPSIS
    Автоматический установщик Kova Studio (.exe / .msi Tauri 2.0 + llama.cpp) для Windows 10/11.
.DESCRIPTION
    Запуск одной командой из PowerShell:
    irm https://raw.githubusercontent.com/<OWNER>/<REPO>/main/scripts/install.ps1 | iex
#>

param(
    [string]$Repo = "kova-studio/kova-studio",
    [string]$Branch = "main",
    [string]$InstallDir = "$env:LOCALAPPDATA\KovaStudio\src",
    [string]$ModelsDir = "$env:APPDATA\KovaStudio\models",
    [ValidateSet("auto", "cuda", "vulkan", "cpu")]
    [string]$GpuBackend = "auto",
    [switch]$FromReleaseOnly,
    [switch]$BuildFromSource
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Step($msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}

Write-Host "=====================================================" -ForegroundColor Blue
Write-Host "   Kova Studio — Установка на Windows 10/11 (1-клик) " -ForegroundColor Blue
Write-Host "=====================================================" -ForegroundColor Blue

# 1. Создание локальных каталогов (модели и бинарники)
Write-Step "1/6. Подготовка каталогов %APPDATA%\KovaStudio\models и %LOCALAPPDATA%\KovaStudio\bin"
$BinDir = "$env:LOCALAPPDATA\KovaStudio\bin"
New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

# 2. Проверка и установка Microsoft Edge WebView2 Runtime
Write-Step "2/6. Проверка Microsoft Edge WebView2 Runtime"
$wv2Reg = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
)
$hasWv2 = $wv2Reg | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $hasWv2) {
    Write-Host "Загрузка Evergreen WebView2 Bootstrapper..." -ForegroundColor Yellow
    $wv2Exe = "$env:TEMP\MicrosoftEdgeWebview2Setup.exe"
    Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $wv2Exe
    Start-Process -FilePath $wv2Exe -ArgumentList "/silent /install" -Wait
    Remove-Item $wv2Exe -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "WebView2 Runtime уже установлен." -ForegroundColor Green
}

# 3. Автоопределение GPU и скачивание sidecar llama-server.exe
Write-Step "3/6. Определение GPU и загрузка llama-server.exe (llama.cpp)"
$resolvedBackend = $GpuBackend
if ($resolvedBackend -eq "auto") {
    $nvidia = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    if ($nvidia) {
        $resolvedBackend = "cuda"
    } else {
        $resolvedBackend = "vulkan"
    }
}
Write-Host "Выбранный профиль ускорения: $resolvedBackend" -ForegroundColor Gray

try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest" -Headers @{ "User-Agent" = "KovaStudio-Installer" }
    $pattern = switch ($resolvedBackend) {
        "cuda" { "bin-win-cuda-cu12.*x64\.zip$" }
        "vulkan" { "bin-win-vulkan-x64\.zip$" }
        default { "bin-win-avx2-x64\.zip$" }
    }
    $asset = $release.assets | Where-Object { $_.name -match $pattern } | Select-Object -First 1
    if ($asset) {
        $zipPath = "$env:TEMP\llama-server-win.zip"
        Write-Host "Скачивание $($asset.name)..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath
        Expand-Archive -Path $zipPath -DestinationPath $BinDir -Force
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        Write-Host "llama-server.exe установлен в $BinDir" -ForegroundColor Green
    }
} catch {
    Write-Warning "Не удалось загрузить llama-server.exe автоматически: $($_.Exception.Message)"
}

# 4. Попытка быстрой установки готового .msi / .exe из GitHub Releases
if (-not $BuildFromSource) {
    Write-Step "4/6. Проверка готового установщика (.exe / .msi) в GitHub Releases ($Repo)"
    try {
        $appRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ "User-Agent" = "KovaStudio-Installer" }
        $installerAsset = $appRelease.assets | Where-Object { $_.name -match "\.(msi|exe)$" } | Select-Object -First 1
        if ($installerAsset) {
            $outInstaller = "$env:TEMP\$($installerAsset.name)"
            Write-Host "Найден готовый установщик $($installerAsset.name). Скачивание..." -ForegroundColor Green
            Invoke-WebRequest -Uri $installerAsset.browser_download_url -OutFile $outInstaller
            if ($outInstaller.EndsWith(".msi")) {
                Start-Process msiexec.exe -ArgumentList "/i `"$outInstaller`" /passive" -Wait
            } else {
                Start-Process -FilePath $outInstaller -ArgumentList "/S" -Wait
            }
            Write-Host "Готово! Kova Studio установлено из GitHub Release." -ForegroundColor Green
            return
        }
    } catch {
        Write-Host "Готовый релиз не найден. Переход к автоматической сборке Tauri 2.0 (.exe / .msi)..." -ForegroundColor Yellow
    }
} else {
    Write-Step "4/6. Выбран режим принудительной сборки собственного .exe / .msi из исходников"
}

if ($FromReleaseOnly) {
    throw "Флаг -FromReleaseOnly задан, но готовый .exe/.msi в GitHub Releases не обнаружен."
}

# 5. Автоматическая установка зависимостей сборки (Git, Node.js 22, Rust + MSVC Build Tools)
Write-Step "5/6. Проверка и установка зависимостей сборки (Git, Node.js, Rust, MSVC)"
function Ensure-WingetPackage($cmdName, $wingetId, $label) {
    if (-not (Get-Command $cmdName -ErrorAction SilentlyContinue)) {
        Write-Host "Установка $label через winget ($wingetId)..." -ForegroundColor Yellow
        winget install --id $wingetId -e --silent --accept-package-agreements --accept-source-agreements
        Refresh-Path
    } else {
        Write-Host "$label уже установлен." -ForegroundColor Green
    }
}

Ensure-WingetPackage "git" "Git.Git" "Git"
Ensure-WingetPackage "node" "OpenJS.NodeJS.LTS" "Node.js LTS"
Ensure-WingetPackage "cargo" "Rustlang.Rustup" "Rust (rustup + cargo)"

$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasMsvc = (Test-Path $vsWhere) -and (& $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath)
if (-not $hasMsvc) {
    Write-Host "Установка Visual Studio C++ Build Tools..." -ForegroundColor Yellow
    winget install --id Microsoft.VisualStudio.2022.BuildTools -e --silent --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" --accept-package-agreements --accept-source-agreements
}

# 6. Клонирование репозитория и сборка собственного .exe / .msi (Tauri 2.0)
Write-Step "6/6. Скачивание исходников с GitHub и сборка .exe / .msi"
if (Test-Path "$InstallDir\.git") {
    Push-Location $InstallDir
    git pull origin $Branch
} else {
    New-Item -ItemType Directory -Force -Path (Split-Path $InstallDir) | Out-Null
    git clone --branch $Branch "https://github.com/$Repo.git" $InstallDir
    Push-Location $InstallDir
}

try {
    # Копируем llama-server.exe в src-tauri/binaries как Tauri sidecar
    $sidecarDir = Join-Path $InstallDir "src-tauri\binaries"
    New-Item -ItemType Directory -Force -Path $sidecarDir | Out-Null
    $llamaExe = Get-ChildItem -Path $BinDir -Filter "llama-server.exe" -Recurse | Select-Object -First 1
    if ($llamaExe) {
        Copy-Item $llamaExe.FullName (Join-Path $sidecarDir "llama-server-x86_64-pc-windows-msvc.exe") -Force
    }

    npm install
    if (Test-Path "public\pwa-512x512.png") {
        npx @tauri-apps/cli@2 icon public/pwa-512x512.png
    }
    npx @tauri-apps/cli@2 build

    $bundleDir = Join-Path $InstallDir "src-tauri\target\release\bundle"
    $exeInstaller = Get-ChildItem -Path $bundleDir -Filter "*.exe" -Recurse | Select-Object -First 1
    if ($exeInstaller) {
        Write-Host "`nСборка завершена! Запуск установщика $($exeInstaller.Name)..." -ForegroundColor Green
        Start-Process -FilePath $exeInstaller.FullName
    } else {
        Write-Host "`nСборка завершена! Проверьте установщики в $bundleDir" -ForegroundColor Green
    }
} finally {
    Pop-Location
}
