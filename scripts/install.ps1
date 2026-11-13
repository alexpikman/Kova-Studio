<#
.SYNOPSIS
    Автоматический установщик Kova Studio (Windows 10/11) без локальной сборки MSVC (нет ошибки 8012).
.DESCRIPTION
    Запуск одной командой из PowerShell:
    irm https://raw.githubusercontent.com/alexpikman/Kova-Studio/main/scripts/install.ps1 | iex
#>

param(
    [string]$Repo = "alexpikman/Kova-Studio",
    [string]$Branch = "main",
    [string]$AppDir = "$env:LOCALAPPDATA\KovaStudio\app",
    [string]$ModelsDir = "$env:APPDATA\KovaStudio\models",
    [ValidateSet("auto", "cuda", "vulkan", "cpu")]
    [string]$GpuBackend = "auto",
    [string]$GitHubToken = $env:GITHUB_TOKEN,
    [string]$ModelUrl = "",
    [switch]$Silent,
    [switch]$NoWebFallback,
    [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Step($msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Refresh-UserPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = @($machinePath, $userPath) -join ";"
}

function Invoke-GitHubApi {
    param([string]$Uri)
    $headers = @{
        "User-Agent" = "KovaStudio-Installer"
        "Accept"     = "application/vnd.github+json"
    }
    if (-not [string]::IsNullOrWhiteSpace($GitHubToken)) {
        $headers["Authorization"] = "Bearer $GitHubToken"
    }
    return Invoke-RestMethod -Uri $Uri -Headers $headers
}

function Install-FromDownloadedPackage {
    param(
        [string]$FilePath,
        [string]$ExtractDir
    )

    if ($FilePath -match "\.msi$") {
        Write-Host "Запуск MSI-установщика $(Split-Path $FilePath -Leaf)..." -ForegroundColor Green
        $msiArgs = if ($Silent) { "/i `"$FilePath`" /passive" } else { "/i `"$FilePath`"" }
        $proc = Start-Process msiexec.exe -ArgumentList $msiArgs -Wait -PassThru
        return ($proc.ExitCode -in @(0, 3010))
    }

    if ($FilePath -match "\.exe$") {
        Write-Host "Запуск $(Split-Path $FilePath -Leaf)..." -ForegroundColor Green
        if ($Silent) {
            Start-Process -FilePath $FilePath -ArgumentList "/S" -Wait
        } else {
            Start-Process -FilePath $FilePath
        }
        return $true
    }

    if ($FilePath -match "\.zip$") {
        Write-Host "Распаковка архива $(Split-Path $FilePath -Leaf) в $ExtractDir..." -ForegroundColor Green
        New-Item -ItemType Directory -Force -Path $ExtractDir | Out-Null
        Expand-Archive -Path $FilePath -DestinationPath $ExtractDir -Force

        $installer = Get-ChildItem -Path $ExtractDir -Include "*.exe", "*.msi" -Recurse | Select-Object -First 1
        if (-not $installer) {
            Write-Warning "Архив распакован в $ExtractDir, но .exe/.msi внутри не найден."
            return $false
        }

        if ($installer.Extension -eq ".msi") {
            $msiArgs = if ($Silent) { "/i `"$($installer.FullName)`" /passive" } else { "/i `"$($installer.FullName)`"" }
            Start-Process msiexec.exe -ArgumentList $msiArgs -Wait
        } else {
            Write-Host "Запуск $($installer.Name)..." -ForegroundColor Green
            Start-Process -FilePath $installer.FullName
        }
        return $true
    }

    return $false
}

Write-Host "=========================================================" -ForegroundColor Blue
Write-Host "     Kova Studio — Автоустановка на Windows 10 / 11      " -ForegroundColor Blue
Write-Host "=========================================================" -ForegroundColor Blue
Write-Host "Репозиторий: https://github.com/$Repo (ветка: $Branch)" -ForegroundColor Gray

# 1. Создание локальных каталогов
Write-Step "1/5. Подготовка каталогов %APPDATA%\KovaStudio\models и %LOCALAPPDATA%\KovaStudio"
$BinDir = "$env:LOCALAPPDATA\KovaStudio\bin"
New-Item -ItemType Directory -Force -Path $ModelsDir, $BinDir, $AppDir | Out-Null

# 2. Проверка и установка Microsoft Edge WebView2 Runtime
Write-Step "2/5. Проверка Microsoft Edge WebView2 Runtime"
$wv2Reg = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
)
$hasWv2 = $wv2Reg | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $hasWv2) {
    try {
        Write-Host "Загрузка Evergreen WebView2 Bootstrapper..." -ForegroundColor Yellow
        $wv2Exe = "$env:TEMP\MicrosoftEdgeWebview2Setup.exe"
        Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $wv2Exe
        Start-Process -FilePath $wv2Exe -ArgumentList "/silent /install" -Wait
        Remove-Item $wv2Exe -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Warning "Не удалось автоматически установить WebView2: $($_.Exception.Message)"
    }
} else {
    Write-Host "WebView2 Runtime уже установлен." -ForegroundColor Green
}

# 3. Автоопределение GPU и загрузка llama-server.exe (+ опциональной модели)
Write-Step "3/5. Определение GPU и загрузка llama-server.exe (llama.cpp)"
$resolvedBackend = $GpuBackend
if ($resolvedBackend -eq "auto") {
    $nvidia = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    $resolvedBackend = if ($nvidia) { "cuda" } else { "vulkan" }
}
Write-Host "Выбранный профиль ускорения: $resolvedBackend" -ForegroundColor Gray

try {
    $llamaRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest" -Headers @{ "User-Agent" = "KovaStudio-Installer" }
    $pattern = switch ($resolvedBackend) {
        "cuda" { "bin-win-cuda-cu12.*x64\.zip$" }
        "vulkan" { "bin-win-vulkan-x64\.zip$" }
        default { "bin-win-avx2-x64\.zip$" }
    }
    $asset = $llamaRelease.assets | Where-Object { $_.name -match $pattern } | Select-Object -First 1
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

if (-not [string]::IsNullOrWhiteSpace($ModelUrl)) {
    try {
        $modelFileName = [System.IO.Path]::GetFileName(($ModelUrl -split '\?')[0])
        if ([string]::IsNullOrWhiteSpace($modelFileName)) { $modelFileName = "model.gguf" }
        $modelDest = Join-Path $ModelsDir $modelFileName
        Write-Host "Скачивание GGUF-модели в $modelDest..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $ModelUrl -OutFile $modelDest
        Write-Host "Модель сохранена: $modelDest" -ForegroundColor Green
    } catch {
        Write-Warning "Не удалось скачать модель по URL: $($_.Exception.Message)"
    }
}

# 4. Поиск готового нативного установщика в GitHub Releases или Actions Artifacts (без MSVC)
Write-Step "4/5. Поиск готового установщика (.exe / .msi) в GitHub Releases и Actions ($Repo)"

# 4.1 Проверка GitHub Releases
try {
    $releasesToCheck = @()
    try {
        $latest = Invoke-GitHubApi -Uri "https://api.github.com/repos/$Repo/releases/latest"
        if ($latest) { $releasesToCheck += $latest }
    } catch { }

    if ($releasesToCheck.Count -eq 0) {
        $allReleases = Invoke-GitHubApi -Uri "https://api.github.com/repos/$Repo/releases?per_page=5"
        if ($allReleases) { $releasesToCheck += $allReleases }
    }

    foreach ($rel in $releasesToCheck) {
        $pkgAsset = $rel.assets |
            Where-Object { $_.name -match "\.(exe|msi|zip)$" } |
            Sort-Object { if ($_.name -match "\.exe$") { 0 } elseif ($_.name -match "\.msi$") { 1 } else { 2 } } |
            Select-Object -First 1

        if ($pkgAsset) {
            $downloadPath = "$env:TEMP\$($pkgAsset.name)"
            Write-Host "Найден готовый релиз $($rel.tag_name): $($pkgAsset.name). Скачивание..." -ForegroundColor Green
            Invoke-WebRequest -Uri $pkgAsset.browser_download_url -OutFile $downloadPath
            $installed = Install-FromDownloadedPackage -FilePath $downloadPath -ExtractDir $AppDir
            if ($installed) {
                Write-Host "`nГотово! Нативное приложение Kova Studio установлено." -ForegroundColor Green
                Write-Host "Каталог моделей GGUF: $ModelsDir" -ForegroundColor Gray
                return
            }
        }
    }
} catch {
    Write-Host "В GitHub Releases пока нет опубликованных .exe/.msi файлов." -ForegroundColor Yellow
}

# 4.2 Проверка GitHub Actions Artifacts (если задан GITHUB_TOKEN)
try {
    $artifactsResp = Invoke-GitHubApi -Uri "https://api.github.com/repos/$Repo/actions/artifacts?per_page=10"
    $foundArtifact = $null
    if ($artifactsResp -and $artifactsResp.artifacts) {
        $foundArtifact = $artifactsResp.artifacts |
            Where-Object { -not $_.expired -and ($_.name -match "kova|windows|installer|bundle|exe|msi") } |
            Select-Object -First 1
    }

    if ($foundArtifact -and (-not [string]::IsNullOrWhiteSpace($GitHubToken))) {
        $zipOut = "$env:TEMP\$($foundArtifact.name).zip"
        Write-Host "Найден артефакт GitHub Actions '$($foundArtifact.name)'. Скачивание..." -ForegroundColor Green
        Invoke-WebRequest -Uri $foundArtifact.archive_download_url -Headers @{
            "User-Agent"    = "KovaStudio-Installer"
            "Authorization" = "Bearer $GitHubToken"
        } -OutFile $zipOut
        $installed = Install-FromDownloadedPackage -FilePath $zipOut -ExtractDir $AppDir
        if ($installed) {
            Write-Host "`nГотово! Kova Studio установлено из артефакта GitHub Actions." -ForegroundColor Green
            return
        }
    }
} catch { }

if ($NoWebFallback) {
    Write-Host "`nГотовый .exe/.msi не найден. Запустите облачную сборку: https://github.com/$Repo/actions/workflows/build-windows.yml" -ForegroundColor Yellow
    return
}

# 5. Надёжный запуск без MSVC и без git: скачиваем ZIP-архив ветки + Node.js LTS + ярлык запуска
Write-Step "5/5. Готовый .exe пока не опубликован — разворачиваем локальный запуск без MSVC (Node + PWA)"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "Node.js не найден. Устанавливаем OpenJS.NodeJS.LTS через winget..." -ForegroundColor Yellow
    $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
    if ($wingetCmd) {
        winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements --silent | Out-Null
        Refresh-UserPath
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    }
    if (-not $nodeCmd) {
        Write-Warning "Установите Node.js 22 LTS вручную (https://nodejs.org/) или запустите облачную сборку .exe в GitHub Actions:"
        Write-Host "  https://github.com/$Repo/actions/workflows/build-windows.yml" -ForegroundColor White
        return
    }
}

$repoZip = "$env:TEMP\Kova-Studio-$Branch.zip"
$stageDir = "$env:TEMP\Kova-Studio-stage"
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }

$archiveUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
Write-Host "Скачивание исходников из $archiveUrl..." -ForegroundColor Gray
Invoke-WebRequest -Uri $archiveUrl -OutFile $repoZip
Expand-Archive -Path $repoZip -DestinationPath $stageDir -Force
Remove-Item $repoZip -Force -ErrorAction SilentlyContinue

$extractedRoot = Get-ChildItem -Path $stageDir -Directory | Select-Object -First 1
if (-not $extractedRoot) {
    throw "Не удалось найти распакованную папку репозитория внутри архива."
}

$projectDir = Join-Path $AppDir "repo"
if (Test-Path $projectDir) {
    Remove-Item $projectDir -Recurse -Force -ErrorAction SilentlyContinue
}
Move-Item -Path $extractedRoot.FullName -Destination $projectDir -Force
Remove-Item $stageDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Установка зависимостей npm (--legacy-peer-deps)..." -ForegroundColor Gray
Push-Location $projectDir
try {
    & npm install --legacy-peer-deps --no-audit --no-fund
} finally {
    Pop-Location
}

# Создаём удобный запускатель (Рабочий стол + Меню Пуск)
$launcherCmd = "$env:LOCALAPPDATA\KovaStudio\Start-Kova-Studio.cmd"
$launcherBody = @"
@echo off
title Kova Studio
cd /d "$projectDir"
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
npm run dev
"@
Set-Content -Path $launcherCmd -Value $launcherBody -Encoding ASCII

$desktopLauncher = Join-Path ([Environment]::GetFolderPath("Desktop")) "Kova Studio.cmd"
Copy-Item $launcherCmd $desktopLauncher -Force

$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
if (Test-Path $startMenuDir) {
    Copy-Item $launcherCmd (Join-Path $startMenuDir "Kova Studio.cmd") -Force
}

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host "  Kova Studio успешно установлен и готов к запуску!" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "Папка приложения : $projectDir" -ForegroundColor Gray
Write-Host "Каталог моделей  : $ModelsDir" -ForegroundColor Gray
Write-Host "Ярлык запуска    : $desktopLauncher" -ForegroundColor Cyan
Write-Host "Локальный адрес  : http://localhost:3000 (в Edge/Chrome можно нажать 'Установить как приложение PWA')" -ForegroundColor Gray
Write-Host ""
Write-Host "Совет: для нативного .exe/.msi без Node.js запустите облачный workflow (Actions -> Build Windows Installer):" -ForegroundColor Yellow
Write-Host "  https://github.com/$Repo/actions/workflows/build-windows.yml" -ForegroundColor White

if (-not $NoLaunch) {
    Write-Host "`nЗапуск Kova Studio (http://localhost:3000)..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$launcherCmd`""
}
