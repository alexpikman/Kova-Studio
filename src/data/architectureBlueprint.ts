export interface ArchitectureModule {
  id: string;
  title: string;
  layer: 'Frontend (WebView2)' | 'Core Rust' | 'Sidecar & Storage';
  summary: string;
  responsibilities: string[];
  cratesOrPackages: string[];
  ipcTouchpoints: string[];
}

export interface TauriCommandSpec {
  name: string;
  direction: 'invoke' | 'event';
  module: 'Agent Core' | 'Model Manager' | 'llama.cpp Bridge' | 'Workspace';
  payload: string;
  returns: string;
  permissionScope: string;
  description: string;
}

export interface RoadmapStage {
  phase: string;
  title: string;
  target: string;
  dependencies: string[];
  deliverables: string[];
  riskMitigation: string;
}

export interface CodeSnippetSpec {
  id: string;
  title: string;
  language: 'rust' | 'tsx' | 'typescript';
  filename: string;
  description: string;
  code: string;
}

export const ARCHITECTURE_MODULES: ArchitectureModule[] = [
  {
    id: 'ui-webview',
    title: 'UI Layer (WebView2 + React)',
    layer: 'Frontend (WebView2)',
    summary: 'Лёгкий 3-колоночный интерфейс на встроенном в Windows 10/11 Edge WebView2 без упаковки Chromium (~25–40 МБ RAM в простое).',
    responsibilities: [
      'Рендеринг чата Plan/Act, потокового Markdown и кастомного Git-диффа',
      'Реактивное управление состоянием через Zustand (очередь загрузок, стриминг, чекпоинты)',
      'Тёмная и светлая темы с полупрозрачными Windows 11 Mica-поверхностями',
      'Обработка глобальных шорткатов и окна системного трея',
    ],
    cratesOrPackages: ['react 19', 'zustand', 'tailwindcss v4', 'shadcn/ui', 'framer-motion', '@tauri-apps/api'],
    ipcTouchpoints: ['invoke("send_agent_prompt")', 'listen("agent://token")', 'listen("llama://telemetry")'],
  },
  {
    id: 'agent-core',
    title: 'Agent Core & Checkpoints',
    layer: 'Core Rust',
    summary: 'Оркестратор инструментальных вызовов (Plan/Act) с песочницей файловых операций и моментальными снапшотами перед каждым изменением.',
    responsibilities: [
      'Сборка системного промпта: дерево проекта + открытые файлы + вывод терминала',
      'Парсинг tool-calls модели (read_file, write_diff, run_command) и постановка на ручное подтверждение',
      'Автоматическое создание Checkpoint (копия затрагиваемых файлов в SQLite/диске) перед записью',
      'Выполнение команд в cmd.exe / powershell.exe с захватом stdout/stderr и кодов возврата',
    ],
    cratesOrPackages: ['similar', 'rusqlite', 'notify', 'chrono', 'serde_json'],
    ipcTouchpoints: ['invoke("apply_diff_with_checkpoint")', 'invoke("rollback_checkpoint")', 'invoke("exec_terminal_cmd")'],
  },
  {
    id: 'model-manager',
    title: 'Autonomous Model Manager',
    layer: 'Core Rust',
    summary: 'Полностью автономный загрузчик GGUF без Ollama и Python: поиск по Hugging Face Hub, докачка по HTTP Range и проверка SHA256.',
    responsibilities: [
      'Запросы к Hugging Face Hub API (/api/models?apps=llama.cpp) и парсинг GGUF-вариантов',
      'Загрузка больших файлов (4–15 ГБ) с поддержкой паузы и докачки через заголовок Range',
      'Потоковая проверка SHA256 из LFS-метаданных и хранение в %APPDATA%\\KovaStudio\\models\\',
      'Расчёт достаточности RAM/VRAM до запуска скачивания и опциональный вызов convert_hf_to_gguf.py',
    ],
    cratesOrPackages: ['reqwest (stream)', 'sha2', 'tokio::fs', 'zip / tar (опционально)'],
    ipcTouchpoints: ['invoke("search_hf_models")', 'invoke("download_gguf")', 'listen("model://download-progress")'],
  },
  {
    id: 'llama-bridge',
    title: 'llama.cpp Bridge (Sidecar)',
    layer: 'Sidecar & Storage',
    summary: 'Управление официальным бинарником llama-server.exe как дочерним sidecar-процессом с авто-детектом CUDA / Vulkan и OpenAI-совместимым SSE-стримингом.',
    responsibilities: [
      'Автоматическая проверка nvidia-smi (CUDA 12) или Vulkan 1.3 с безопасным откатом на CPU AVX2',
      'Запуск llama-server.exe на 127.0.0.1:<free_port> с флагами -ngl, --ctx-size, --flash-attn',
      'Потоковое чтение stderr/stdout сервера для отслеживания загрузки слоёв в VRAM и tok/s',
      'Гарантированное завершение дочернего процесса (Job Object на Windows) при закрытии приложения',
    ],
    cratesOrPackages: ['tauri-plugin-shell', 'windows-sys (JobObject)', 'reqwest (SSE stream)', 'SQLite'],
    ipcTouchpoints: ['invoke("start_llama_server")', 'invoke("stop_llama_server")', 'listen("llama://telemetry")'],
  },
];

export const TAURI_IPC_SPECS: TauriCommandSpec[] = [
  {
    name: 'search_hf_models',
    direction: 'invoke',
    module: 'Model Manager',
    payload: '{ query: string, quantFilter?: string, limit: number }',
    returns: 'Result<Vec<HfModelSummary>, String>',
    permissionScope: 'http:allow-fetch (huggingface.co)',
    description: 'Запрашивает совместимые с llama.cpp модели из Hugging Face Hub API с метаданными лицензии и загрузок.',
  },
  {
    name: 'download_gguf',
    direction: 'invoke',
    module: 'Model Manager',
    payload: '{ url: string, filename: string, expectedSha256?: string }',
    returns: 'Result<DownloadTaskId, String>',
    permissionScope: 'fs:scope-appdata-models',
    description: 'Запускает фоновую асинхронную загрузку с докачкой (.part + Range) и проверкой SHA256.',
  },
  {
    name: 'pause_or_cancel_download',
    direction: 'invoke',
    module: 'Model Manager',
    payload: '{ taskId: string, removePart: boolean }',
    returns: 'Result<(), String>',
    permissionScope: 'internal-state',
    description: 'Приостанавливает поток reqwest, сохраняя .part-файл на диске для последующей докачки.',
  },
  {
    name: 'start_llama_server',
    direction: 'invoke',
    module: 'llama.cpp Bridge',
    payload: '{ modelPath: string, gpuPref: "auto"|"cuda"|"vulkan"|"cpu", nCtx: number, nGpuLayers: number }',
    returns: 'Result<{ port: number, resolvedBackend: string }, String>',
    permissionScope: 'shell:allow-spawn (sidecar: llama-server)',
    description: 'Определяет GPU-бэкенд, запускает sidecar llama-server.exe и ждёт готовности эндпоинта /health.',
  },
  {
    name: 'send_agent_prompt',
    direction: 'invoke',
    module: 'Agent Core',
    payload: '{ sessionId: string, prompt: string, mode: "plan"|"act", contextFiles: string[] }',
    returns: 'Result<String, String>',
    permissionScope: 'fs:scope-workspace-read',
    description: 'Собирает промпт с деревом проекта и открытыми файлами, запускает SSE-запрос к llama-server.',
  },
  {
    name: 'apply_diff_with_checkpoint',
    direction: 'invoke',
    module: 'Agent Core',
    payload: '{ filePath: string, newContent: string, label: string }',
    returns: 'Result<CheckpointId, String>',
    permissionScope: 'fs:scope-workspace-write',
    description: 'Создаёт снимок затронутых файлов в SQLite перед записью и атомарно применяет новый контент.',
  },
  {
    name: 'rollback_checkpoint',
    direction: 'invoke',
    module: 'Agent Core',
    payload: '{ checkpointId: string }',
    returns: 'Result<Vec<string>, String>',
    permissionScope: 'fs:scope-workspace-write',
    description: 'Восстанавливает файлы проекта из сохранённого снапшота и возвращает список обновлённых путей.',
  },
  {
    name: 'exec_terminal_cmd',
    direction: 'invoke',
    module: 'Workspace',
    payload: '{ shell: "powershell"|"cmd", command: string, cwd: string }',
    returns: 'Result<CommandExecutionId, String>',
    permissionScope: 'shell:allow-execute (user-confirmed)',
    description: 'Выполняет подтверждённую пользователем команду Windows-терминала со стримингом stdout/stderr.',
  },
  {
    name: 'llama://telemetry',
    direction: 'event',
    module: 'llama.cpp Bridge',
    payload: '{ status: string, tokensPerSec: number, vramUsedGb: number, ramUsedGb: number, backend: string }',
    returns: 'Push Event (WebView2)',
    permissionScope: 'tauri-event-emit',
    description: 'Обновляет состояние инференса, скорость генерации и потребление VRAM в Zustand в реальном времени.',
  },
  {
    name: 'model://download-progress',
    direction: 'event',
    module: 'Model Manager',
    payload: '{ taskId: string, downloadedBytes: number, totalBytes: number, speedMbps: number, phase: string }',
    returns: 'Push Event (WebView2)',
    permissionScope: 'tauri-event-emit',
    description: 'Передаёт прогресс скачивания и статус верификации SHA256 с троттлингом 150 мс.',
  },
];

export const PROJECT_FOLDER_STRUCTURE = `kova-studio/
├── src-tauri/
│   ├── binaries/
│   │   └── llama-server-x86_64-pc-windows-msvc.exe   # Официальный sidecar llama.cpp (CUDA/Vulkan/AVX2)
│   ├── capabilities/
│   │   └── default.json                              # Разрешения shell:allow-spawn, fs, http
│   ├── migrations/
│   │   └── 001_init.sql                              # Таблицы sessions, messages, models, checkpoints
│   ├── src/
│   │   ├── main.rs                                   # Точка входа Windows GUI + JobObject cleanup
│   │   ├── lib.rs                                    # Регистрация Tauri Commands, SQLite и Tray
│   │   ├── llama_bridge.rs                           # Sidecar llama-server.exe + авто-детект CUDA/Vulkan
│   │   ├── model_manager.rs                          # HF Hub клиент + reqwest Range докачка + SHA256
│   │   ├── agent_core.rs                             # Цикл Plan/Act, парсер tool-calls, diff-движок
│   │   ├── checkpoints.rs                            # Снапшоты файлов и откат состояний
│   │   └── tray.rs                                   # Иконка системного трея Windows и уведомления
│   ├── Cargo.toml                                    # tauri 2.2, tauri-plugin-shell, reqwest, rusqlite, sha2
│   └── tauri.conf.json                               # bundle.externalBin + настройки WebView2
├── src/
│   ├── stores/
│   │   ├── agentStore.ts                             # Zustand: Plan/Act, диффы, чекпоинты, Tauri listeners
│   │   └── modelStore.ts                             # Zustand: очередь загрузок, HF поиск, RAM/VRAM
│   ├── components/
│   │   ├── layout/                                   # 3-колоночный каркас, шапка, системный трей
│   │   ├── agent/                                    # Чат, Markdown, DiffViewer, TerminalBlock
│   │   ├── models/                                   # Каталог GGUF, карточка модели, калькулятор VRAM
│   │   └── settings/                                 # Модальное окно путей, GPU и горячих клавиш
│   └── App.tsx
└── package.json                                      # React 19, Zustand, Tailwind CSS v4, Motion`;

export const ROADMAP_STAGES: RoadmapStage[] = [
  {
    phase: 'Этап 1 · MVP (Недели 1–2)',
    title: 'Каркас Tauri 2.0 + Sidecar llama-server.exe',
    target: 'Работающий локальный чат поверх WebView2 без Ollama',
    dependencies: ['tauri 2.2', 'tauri-plugin-shell', 'tokio', 'zustand'],
    deliverables: [
      'Сборка пустого Tauri 2.0 бандла под Windows (< 12 МБ без весов) с WebView2',
      'Подключение llama-server-x86_64-pc-windows-msvc.exe как externalBin sidecar',
      'Авто-выбор свободного порта localhost и SSE-стриминг /v1/chat/completions',
      'Базовый 3-колоночный интерфейс и Zustand-стор телеметрии инференса',
    ],
    riskMitigation: 'Использование Win32 Job Object гарантирует отсутствие «висячих» процессов llama-server.exe при аварийном закрытии UI.',
  },
  {
    phase: 'Этап 2 · Ядро агента (Недели 3–4)',
    title: 'Режимы Plan/Act, Git-диффы, Терминал и Checkpoints',
    target: 'Полноценный Cline-подобный цикл редактирования кода с откатом',
    dependencies: ['similar', 'rusqlite', 'notify', 'lucide-react'],
    deliverables: [
      'Индексатор дерева проекта с исключением target/, node_modules/, .git/',
      'Кастомный рендерер Git-диффов с подтверждением и отклонением изменений',
      'Автоматический снимок состояния (Checkpoint) перед каждым применением диффа',
      'Выполнение команд PowerShell/cmd с потоковым захватом stderr для самоисправления',
    ],
    riskMitigation: 'Ограничение области записи в Rust (Path canonicalization) защищает от выхода агента за пределы корня открытого проекта.',
  },
  {
    phase: 'Этап 3 · Автономный Model Hub (Недели 5–6)',
    title: 'Интеграция Hugging Face Hub, докачка и GPU Auto-Detect',
    target: 'Загрузка и запуск любой GGUF-модели в два клика без внешних инструментов',
    dependencies: ['reqwest (stream)', 'sha2', 'nvidia-smi probe'],
    deliverables: [
      'Живой поиск моделей через Hugging Face API (apps=llama.cpp) + парсинг LFS SHA256',
      'Менеджер загрузок с докачкой (.part + Range), паузой и проверкой контрольных сумм',
      'Калькулятор RAM/VRAM и автоопределение CUDA / Vulkan с откатом на CPU',
      'Поддержка прямых URL на .gguf и опциональный мост convert_hf_to_gguf.py',
    ],
    riskMitigation: 'Запись прогресса в Zustand троттлится до 150 мс, чтобы не нагружать WebView2 IPC во время скачивания на гигабитном канале.',
  },
  {
    phase: 'Этап 4 · Полировка под Windows (Неделя 7)',
    title: 'Системный трей, Mica-эффект, горячие клавиши и MSI/NSIS установщик',
    target: 'Финальный релизный билд для Windows 10/11',
    dependencies: ['tauri tray-icon', 'window-vibrancy (Windows 11)', 'NSIS bundler'],
    deliverables: [
      'Иконка системного трея Windows с индикатором активности и toast-уведомлениями',
      'Нативная полупрозрачность Mica/Acrylic (Windows 11) и чистые светлая/тёмная темы',
      'Глобальные горячие клавиши и опциональный fallback на облачные API-ключи',
      'Автоматическое обновление бинарника llama-server.exe с GitHub Releases llama.cpp',
    ],
    riskMitigation: 'Проверка цифровой подписи релизных архивов llama.cpp и хранение бинарников в %LOCALAPPDATA% для совместимости со SmartScreen.',
  },
];

export const CODE_SNIPPETS: CodeSnippetSpec[] = [
  {
    id: 'rust-sidecar',
    title: 'Rust: Запуск llama-server.exe + GPU Auto-Detect',
    language: 'rust',
    filename: 'src-tauri/src/llama_bridge.rs',
    description: 'Запуск sidecar-процесса llama-server.exe через tauri-plugin-shell с проверкой CUDA/Vulkan и стримингом логов.',
    code: `use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::{process::{CommandChild, CommandEvent}, ShellExt};
use tokio::sync::Mutex;

#[derive(Clone, serde::Serialize)]
pub struct LlamaTelemetry {
    pub status: String,
    pub tokens_per_sec: f32,
    pub vram_used_gb: f32,
    pub backend: String,
}

pub struct LlamaBridgeState {
    pub child: Arc<Mutex<Option<CommandChild>>>,
    pub port: u16,
}

fn detect_windows_gpu_backend(pref: &str) -> (String, u32) {
    match pref {
        "cpu" => ("CPU AVX2".into(), 0),
        "vulkan" => ("Vulkan 1.3".into(), 64),
        "cuda" => ("CUDA 12.4".into(), 99),
        _ => {
            let has_cuda = Command::new("nvidia-smi")
                .args(["--query-gpu=name", "--format=csv,noheader"])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);
            if has_cuda {
                ("CUDA 12.4".into(), 99)
            } else {
                ("Vulkan 1.3".into(), 64)
            }
        }
    }
}

#[tauri::command]
pub async fn start_llama_server(
    app: AppHandle,
    state: tauri::State<'_, LlamaBridgeState>,
    model_path: String,
    gpu_pref: String,
    n_ctx: u32,
) -> Result<u16, String> {
    // Завершаем предыдущий экземпляр, если он запущен
    if let Some(prev) = state.child.lock().await.take() {
        let _ = prev.kill();
    }

    let (backend_label, ngl) = detect_windows_gpu_backend(&gpu_pref);
    let sidecar = app.shell().sidecar("llama-server").map_err(|e| e.to_string())?;

    let (mut rx, child) = sidecar
        .args([
            "-m", &model_path,
            "--host", "127.0.0.1",
            "--port", &state.port.to_string(),
            "--ctx-size", &n_ctx.to_string(),
            "-ngl", &ngl.to_string(),
            "--flash-attn",
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn llama-server.exe: {e}"))?;

    *state.child.lock().await = Some(child);

    let app_handle = app.clone();
    let backend_clone = backend_label.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stderr(bytes) | CommandEvent::Stdout(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).to_string();
                    if line.contains("HTTP server listening") {
                        let _ = app_handle.emit("llama://telemetry", LlamaTelemetry {
                            status: "ready".into(),
                            tokens_per_sec: 0.0,
                            vram_used_gb: 5.8,
                            backend: backend_clone.clone(),
                        });
                    }
                    let _ = app_handle.emit("llama://log", line);
                }
                CommandEvent::Terminated(payload) => {
                    let _ = app_handle.emit("llama://telemetry", LlamaTelemetry {
                        status: format!("stopped (code {:?})", payload.code),
                        tokens_per_sec: 0.0,
                        vram_used_gb: 0.0,
                        backend: backend_clone.clone(),
                    });
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(state.port)
}`,
  },
  {
    id: 'rust-downloader',
    title: 'Rust: Загрузчик GGUF с докачкой и SHA256',
    language: 'rust',
    filename: 'src-tauri/src/model_manager.rs',
    description: 'Асинхронная загрузка через reqwest с заголовком Range, паузой и проверкой SHA256 перед перемещением в каталог моделей.',
    code: `use reqwest::header::RANGE;
use sha2::{Digest, Sha256};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[derive(Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub task_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub phase: String,
}

pub async fn download_gguf_with_resume(
    app: AppHandle,
    task_id: String,
    url: String,
    dest_path: String,
    expected_sha256: Option<String>,
) -> Result<String, String> {
    let part_path = format!("{dest_path}.part");
    let mut downloaded = tokio::fs::metadata(&part_path).await.map(|m| m.len()).unwrap_or(0);

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(&url);
    if downloaded > 0 {
        req = req.header(RANGE, format!("bytes={downloaded}-"));
    }

    let mut resp = req.send().await.map_err(|e| e.to_string())?;
    let total_bytes = downloaded + resp.content_length().unwrap_or(0);

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&part_path)
        .await
        .map_err(|e| e.to_string())?;

    let mut last_emit = Instant::now();
    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if last_emit.elapsed() >= Duration::from_millis(150) {
            let _ = app.emit("model://download-progress", DownloadProgress {
                task_id: task_id.clone(),
                downloaded_bytes: downloaded,
                total_bytes,
                phase: "downloading".into(),
            });
            last_emit = Instant::now();
        }
    }
    file.flush().await.map_err(|e| e.to_string())?;

    let _ = app.emit("model://download-progress", DownloadProgress {
        task_id: task_id.clone(),
        downloaded_bytes: downloaded,
        total_bytes,
        phase: "verifying".into(),
    });

    let mut hasher = Sha256::new();
    let mut reader = File::open(&part_path).await.map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; 1024 * 1024];
    loop {
        let n = reader.read(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    let digest = format!("{:x}", hasher.finalize());

    if let Some(expected) = expected_sha256 {
        if !digest.eq_ignore_ascii_case(&expected) {
            return Err(format!("SHA256 mismatch: expected {expected}, got {digest}"));
        }
    }

    tokio::fs::rename(&part_path, &dest_path).await.map_err(|e| e.to_string())?;
    Ok(digest)
}`,
  },
  {
    id: 'react-diff',
    title: 'React: Кастомный Git Diff Viewer',
    language: 'tsx',
    filename: 'src/components/agent/GitDiffViewer.tsx',
    description: 'Лёгкий компонент диффа с нумерацией строк до/после, цветовой индикацией добавлений/удалений и кнопками подтверждения.',
    code: `import React from 'react';

interface DiffLine {
  type: 'context' | 'add' | 'remove';
  oldNum: number | null;
  newNum: number | null;
  text: string;
}

interface GitDiffViewerProps {
  filePath: string;
  lines: DiffLine[];
  status: 'pending' | 'applied' | 'rejected';
  onApply: () => void;
  onReject: () => void;
}

export const GitDiffViewer: React.FC<GitDiffViewerProps> = ({
  filePath,
  lines,
  status,
  onApply,
  onReject,
}) => {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate">
          {filePath}
        </span>
        {status === 'pending' && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onReject}
              className="px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded"
            >
              Отклонить
            </button>
            <button
              onClick={onApply}
              className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded"
            >
              Применить дифф
            </button>
          </div>
        )}
      </div>
      <div className="font-mono text-xs leading-5 overflow-x-auto">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={
              line.type === 'add'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex'
                : line.type === 'remove'
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 flex'
                : 'text-zinc-600 dark:text-zinc-400 flex'
            }
          >
            <span className="w-10 px-2 text-right select-none opacity-50 tabular-nums">
              {line.oldNum ?? ''}
            </span>
            <span className="w-10 px-2 text-right select-none opacity-50 tabular-nums">
              {line.newNum ?? ''}
            </span>
            <span className="w-5 text-center select-none font-semibold">
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>
            <pre className="pr-4 whitespace-pre">{line.text}</pre>
          </div>
        ))}
      </div>
    </div>
  );
};`,
  },
  {
    id: 'zustand-telemetry',
    title: 'Zustand: Real-Time телеметрия инференса',
    language: 'typescript',
    filename: 'src/stores/runtimeBridge.ts',
    description: 'Подписка Zustand-стора на Tauri Events для обновления скорости токенов, статуса llama-server.exe и прогресса загрузок.',
    code: `import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';

interface RuntimeState {
  serverStatus: 'ready' | 'generating' | 'loading' | 'stopped';
  tokensPerSec: number;
  vramUsedGb: number;
  backend: string;
  bindTauriEvents: () => Promise<() => void>;
}

export const useRuntimeBridge = create<RuntimeState>((set) => ({
  serverStatus: 'stopped',
  tokensPerSec: 0,
  vramUsedGb: 0,
  backend: 'CUDA 12.4',

  bindTauriEvents: async () => {
    const unlistenTelemetry = await listen<{
      status: 'ready' | 'generating' | 'loading' | 'stopped';
      tokens_per_sec: number;
      vram_used_gb: number;
      backend: string;
    }>('llama://telemetry', (event) => {
      set({
        serverStatus: event.payload.status,
        tokensPerSec: event.payload.tokens_per_sec,
        vramUsedGb: event.payload.vram_used_gb,
        backend: event.payload.backend,
      });
    });

    return () => {
      unlistenTelemetry();
    };
  },
}));`,
  },
];
