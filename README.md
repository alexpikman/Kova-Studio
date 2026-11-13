# Kova Studio — Автономный Windows ИИ-агент (Tauri 2.0 + llama.cpp)

Десктопный Cline-подобный ИИ-агент для Windows 10/11 на базе **Tauri 2.0 (Rust + WebView2)** и встроенного sidecar-движка **llama.cpp (`llama-server.exe`)** без зависимости от Ollama и Python.

---

## Установка на ПК в один клик (Windows 10/11)

Откройте **PowerShell** (или Windows Terminal) и выполните одну команду

```powershell
irm https://raw.githubusercontent.com/<OWNER>/<REPO>/main/scripts/install.ps1 | iex
```

**Прямая ссылка на скрипт автоматической установки:**
- [`scripts/install.ps1`](./scripts/install.ps1) — raw-ссылка для GitHub:
  `https://raw.githubusercontent.com/alexpikman/Kova-Studio/main/scripts/install.ps1`

### Что делает скрипт автоматической установки

1. Создаёт локальные каталоги хранения весов `%APPDATA%\KovaStudio\models\` и бинарников `%LOCALAPPDATA%\KovaStudio\bin\`.
2. Проверяет наличие **Microsoft Edge WebView2 Runtime** и при необходимости устанавливает его автоматически.
3. Определяет видеокарту (**NVIDIA CUDA 12.4** через `nvidia-smi` или **Vulkan 1.3** с откатом на CPU AVX2) и скачивает официальный `llama-server.exe` из релизов `ggml-org/llama.cpp`.
4. Проверяет готовый `.exe` (NSIS) или `.msi` (WiX) установщик в **GitHub Releases** репозитория и устанавливает приложение в один клик.
5. Если готового релиза нет — автоматически устанавливает недостающие зависимости сборки (**Git**, **Node.js LTS**, **Rustup/Cargo**, **Visual Studio C++ Build Tools** через `winget`), клонирует репозиторий, запускает `npx @tauri-apps/cli@2 build` и открывает собранный `.exe`/`.msi` установщик.

---

## Ручная сборка собственного `.exe` / `.msi` (Tauri 2.0)

### Требования
- Windows 10 / 11 (x64)
- Node.js 20+ / 22+
- Rust (`rustup`) + Microsoft C++ Build Tools (Desktop development with C++)
- Бинарник `llama-server.exe`, размещённый как `src-tauri/binaries/llama-server-x86_64-pc-windows-msvc.exe`

### Команды сборки

```bash
# 1. Установка JS-зависимостей
npm install

# 2. Генерация иконок Windows (.ico / .png) из public/pwa-512x512.png
npx @tauri-apps/cli@2 icon public/pwa-512x512.png

# 3. Сборка фронтенда и нативного Windows-установщика (.exe и .msi)
npm run tauri:build
```

Готовые установщики появятся в каталогах:
- `src-tauri/target/release/bundle/nsis/Kova Studio_0.1.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/Kova Studio_0.1.0_x64_en-US.msi`

Для автоматической публикации `.exe` и `.msi` в GitHub Releases добавлен workflow [`.github/workflows/build-windows.yml`](./.github/workflows/build-windows.yml).

---

## Локальный запуск веб-версии и PWA

```bash
npm install
npm run dev
```

Приложение откроется на `http://localhost:3000`, поддерживает установку как **PWA** в Microsoft Edge / Google Chrome и включает живой прокси к Hugging Face Hub API (`/api/hf/models`, `/api/hf/model`).

---

## Ключевые возможности

- **3-колоночный интерфейс**: дерево проекта, локальные модели и история сессий слева; чат Plan/Act с кастомным Git-диффом, PowerShell-терминалом и Checkpoints в центре; анимированный векторный персонаж, активный контекст и телеметрия VRAM/RAM справа.
- **Автономный Model Hub**: живой поиск GGUF на Hugging Face (`apps=llama.cpp`), докачка по HTTP `Range`, проверка LFS `SHA256`, загрузка по прямому URL.
- **Мульти-роли и библиотека правил**: одна GGUF-модель переключается между ролями (Архитектор, Разработчик, Код-ревьюер, Тестировщик + конструктор ролей) с гранулярной матрицей разрешений и библиотекой системных указаний.
- **Визуальный пайплайн создания проектов**: 6-этапный граф от ТЗ до Checkpoint с назначением ролей на каждый шаг.
