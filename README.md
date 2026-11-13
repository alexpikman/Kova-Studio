# ONE CORE AI — локальный Windows ИИ-агент

**ONE CORE AI** — это десктопный ИИ-агент для Windows 10/11 на базе **Tauri 2.0 + WebView2** и `llama.cpp` / `llama-server.exe`. Он помогает работать с локальными проектами, моделями GGUF, файлами, Git и терминалом.

Репозиторий проекта: **[`https://github.com/alexpikman/Kova-Studio`](https://github.com/alexpikman/Kova-Studio)**

---

## Что умеет ONE CORE AI

- **Cline-подобная рабочая станция (`Plan` / `Act` / `Код`)**:
  - 3-колоночный интерфейс (дерево проекта, локальные модели и история сессий слева; агентский чат с встроенными Git-диффами, терминалом PowerShell и Checkpoints SQLite в центре; анимированный векторный персонаж, телеметрия VRAM/RAM и активный контекст справа).
  - **Максимальная настройка видимых областей чата (20 переключателей)**: можно включить или отключить боковые панели целиком и по отдельным блокам, верхнюю панель инструментов, баннер задачи Cline, заголовки и таймстемпы сообщений, чипы прочитанных файлов (`read_file`), встроенные диффы (`replace_in_file`), терминальные блоки, бейджи Checkpoints, свитчер ролей и пресеты промптов — плюс 3 готовых пресета (*«Показать всё»*, *«Фокус Cline»*, *«Минимальный чат»*).
- **3 варианта стиля интерфейса**:
  1. **Cline / VS Code** — компактная IDE-компоновка с плотными границами и панелью задачи.
  2. **Windows 11 Mica** — мягкое скругление карточек, полупрозрачные слои и воздушные отступы.
  3. **Терминал Obsidian** — высококонтрастный моноширинный режим с изумрудными акцентами.
- **Возможности OpenKova (100% бесплатно и без ограничений)**:
  - **Навыки и трёхслойная память (`SKILL.md`, `SOUL.md`, `MEMORY.md`, `USER.md`)**: замкнутый цикл обучения (кнопка «Сохранить как навык» прямо в чате), поиск по прошлым сессиям и переиспользуемые инструкции формата `agentskills.io`.
  - **Бесплатные провайдеры без лимитов**: локальные `llama-server.exe`, Ollama, LM Studio, а также бесплатные модели OpenRouter (`:free`), Groq Free и любые OpenAI-compatible URL.
  - **Субагенты и делегирование**: параллельный запуск воркеров через инспектор или slash-команды (`/skill`, `/memory`, `/subagent`, `/env`, `/provider`).
  - **Среды выполнения (`Локально` / `SSH` / `Docker`) и Шлюз мессенджеров (`Telegram` / `Discord` / `Slack`)**: переключение среды исполнения и удалённое управление агентом с проверкой Bot Token.
- **Единый раздел «Настройки»**: все параметры интерфейса, бесплатных провайдеров, навыков и памяти, путей к GGUF/`llama-server.exe`, профилей GPU/VRAM, ключей OpenSSH (`~/.ssh/config`), доступа GitHub (SSH / PAT / `gh` CLI), сред выполнения и шлюзов собраны в одном месте.
- **Модели GGUF (Hugging Face Hub)**: живой поиск по `apps=llama.cpp`, докачка по HTTP `Range`, проверка `SHA256` и загрузка по прямому URL. Для публичных моделей API-ключ не нужен.
- **Роли и 6-этапный пайплайн**: Архитектор, Разработчик, Код-ревьюер, Тестировщик и собственный конструктор ролей с библиотекой правил и графом сборки от ТЗ до Checkpoint.

---

## Как скачать и запустить с GitHub (`alexpikman/Kova-Studio`)

В Windows-приложении локальный API запускается вместе с приложением, а встроенный Node.js не нужно устанавливать отдельно. Определение оборудования, каталог Hugging Face и скачивание публичных GGUF работают без ключей; ключи нужны только для облачных AI-провайдеров и закрытых/ограниченных моделей.

### Способ 1 — Автоматическая установка в 1 клик (Windows 10/11, без MSVC)

Откройте **PowerShell** (или Windows Terminal) и выполните:

```powershell
irm https://raw.githubusercontent.com/alexpikman/Kova-Studio/main/scripts/install.ps1 | iex
```

**Что сделает скрипт [`scripts/install.ps1`](https://github.com/alexpikman/Kova-Studio/blob/main/scripts/install.ps1):**
1. Создаст каталоги `%APPDATA%\com.kovastudio.app\models\` и `%LOCALAPPDATA%\KovaStudio\`. Эти внутренние пути сохранены для совместимости с уже установленными версиями.
2. Установит **Microsoft Edge WebView2 Runtime** (если ещё не установлен).
3. Автоматически определит GPU (**NVIDIA CUDA** / **Vulkan** / **CPU AVX2**) и скачает `llama-server.exe` из официальных релизов `ggml-org/llama.cpp`.
4. Проверит **[GitHub Releases](https://github.com/alexpikman/Kova-Studio/releases)** и **GitHub Actions** на наличие готового `.exe` (NSIS) или `.msi` (WiX) установщика — и сразу установит его без локальной компиляции MSVC (`8012`).
5. Если готовый `.exe`/`.msi` релиз ещё не опубликован — скачает архив репозитория с GitHub (без `git` и без `MSVC`), установит зависимости, создаст ярлык **`ONE CORE AI.cmd`** на рабочем столе и запустит приложение в браузере (`http://localhost:3000`, с поддержкой установки как **PWA**).

---

### Способ 2 — Скачать готовый `.exe` / `.msi` или собрать в облаке GitHub

1. Проверьте вкладку [**Releases**](https://github.com/alexpikman/Kova-Studio/releases) — если там прикреплён файл `*_x64-setup.exe` или `*.msi`, просто скачайте и запустите его.
2. Чтобы собрать свежий `.exe` и `.msi` в облаке (без установки Rust и Visual Studio на ваш ПК):
   - Перейдите в [**Actions → Build Windows Installer (.exe / .msi)**](https://github.com/alexpikman/Kova-Studio/actions/workflows/build-windows.yml);
   - Нажмите **Run workflow**;
   - Через ~3–5 минут готовые установщики появятся в [**Releases**](https://github.com/alexpikman/Kova-Studio/releases) и в артефакте `kova-studio-windows-installer`.

---

### Способ 3 — Скачать исходники вручную (ZIP или `git clone`) и запустить локально

Потребуется **Node.js 22+**:

```powershell
git clone https://github.com/alexpikman/Kova-Studio.git
cd Kova-Studio
npm install --legacy-peer-deps
npm run dev
```

Или без Git: нажмите на GitHub зелёную кнопку **Code → Download ZIP**, распакуйте архив, откройте PowerShell в папке проекта и выполните `npm install --legacy-peer-deps` и `npm run dev`. Приложение откроется на `http://localhost:3000`.

---

## Ручная сборка нативного `.exe` / `.msi` (продвинутый режим)

Если вы хотите компилировать Tauri 2.0 локально на Windows:
1. Установите **Node.js 22**, **Rust (`rustup`)** и **Visual Studio C++ Build Tools** (нагрузка *«Desktop development with C++»*).
2. Поместите `llama-server.exe` в `src-tauri/binaries/llama-server-x86_64-pc-windows-msvc.exe`.
3. Выполните:

```powershell
npm install --legacy-peer-deps
npx --yes @tauri-apps/cli@2 icon public/pwa-512x512.png
npm run tauri:build
```

Готовые установщики будут созданы в `src-tauri/target/release/bundle/nsis/` и `src-tauri/target/release/bundle/msi/`.
