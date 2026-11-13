import type {
  AgentMessage,
  AgentMode,
  ChatSession,
  Checkpoint,
  ModelDirective,
  ModelRole,
  PermissionRule,
  ProjectFile,
} from '../types/kova';

const LLAMA_BRIDGE_INITIAL = `use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

#[derive(Clone, serde::Serialize)]
pub struct LlamaTelemetry {
    pub status: String,
    pub tokens_per_sec: f32,
    pub vram_used_gb: f32,
    pub backend: String,
}

pub struct LlamaState {
    pub child: Arc<Mutex<Option<CommandChild>>>,
    pub port: u16,
}

pub fn detect_gpu_layers(preference: &str) -> (String, u32) {
    match preference {
        "cpu" => ("CPU AVX2".into(), 0),
        "vulkan" => ("Vulkan 1.3".into(), 99),
        _ => ("CUDA 12.4".into(), 99),
    }
}

#[tauri::command]
pub async fn start_llama_server(
    app: AppHandle,
    state: tauri::State<'_, LlamaState>,
    model_path: String,
    gpu_pref: String,
    n_ctx: u32,
) -> Result<u16, String> {
    let (backend, ngl) = detect_gpu_layers(&gpu_pref);
    let (mut rx, child) = app
        .shell()
        .sidecar("llama-server")
        .map_err(|e| e.to_string())?
        .args([
            "-m", &model_path,
            "--port", &state.port.to_string(),
            "--ctx-size", &n_ctx.to_string(),
            "-ngl", &ngl.to_string(),
            "--host", "127.0.0.1",
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    *state.child.lock().await = Some(child);

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(ev) = rx.recv().await {
            if let CommandEvent::Stderr(bytes) = ev {
                let line = String::from_utf8_lossy(&bytes).to_string();
                let _ = app_clone.emit("llama://log", line);
            }
        }
    });

    let _ = app.emit("llama://telemetry", LlamaTelemetry {
        status: "ready".into(),
        tokens_per_sec: 0.0,
        vram_used_gb: 5.8,
        backend,
    });

    Ok(state.port)
}`;

const MODEL_MANAGER_INITIAL = `use reqwest::header::RANGE;
use sha2::{Digest, Sha256};
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

pub async fn download_gguf_resumable(
    url: &str,
    dest_path: &str,
    expected_sha256: Option<&str>,
) -> Result<String, String> {
    let part_path = format!("{}.part", dest_path);
    let existing_len = tokio::fs::metadata(&part_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    let client = reqwest::Client::new();
    let mut req = client.get(url);
    if existing_len > 0 {
        req = req.header(RANGE, format!("bytes={}-", existing_len));
    }

    let mut resp = req.send().await.map_err(|e| e.to_string())?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&part_path)
        .await
        .map_err(|e| e.to_string())?;

    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }
    file.flush().await.map_err(|e| e.to_string())?;

    let mut hasher = Sha256::new();
    let mut verify_file = File::open(&part_path).await.map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; 1024 * 1024];
    loop {
        let n = verify_file.read(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    let digest = format!("{:x}", hasher.finalize());

    if let Some(expected) = expected_sha256 {
        if digest != expected {
            return Err(format!("SHA256 mismatch: expected {}, got {}", expected, digest));
        }
    }

    tokio::fs::rename(&part_path, dest_path).await.map_err(|e| e.to_string())?;
    Ok(digest)
}`;

const AGENT_CORE_INITIAL = `use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;

#[derive(Serialize, Deserialize, Clone)]
pub struct Checkpoint {
    pub id: String,
    pub timestamp: i64,
    pub label: String,
    pub snapshots: HashMap<String, String>,
}

pub fn create_checkpoint(paths: &[String], label: &str) -> Result<Checkpoint, String> {
    let mut snapshots = HashMap::new();
    for path in paths {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        snapshots.insert(path.clone(), content);
    }
    Ok(Checkpoint {
        id: format!("cp_{}", chrono::Utc::now().timestamp_millis()),
        timestamp: chrono::Utc::now().timestamp(),
        label: label.to_string(),
        snapshots,
    })
}

pub fn rollback_checkpoint(cp: &Checkpoint) -> Result<usize, String> {
    let mut restored = 0;
    for (path, content) in &cp.snapshots {
        fs::write(path, content).map_err(|e| e.to_string())?;
        restored += 1;
    }
    Ok(restored)
}`;

const CARGO_TOML_INITIAL = `[package]
name = "kova-studio"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2.2", features = ["tray-icon"] }
tauri-plugin-shell = "2.2"
tokio = { version = "1.43", features = ["full"] }
reqwest = { version = "0.12", features = ["stream", "json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
rusqlite = { version = "0.33", features = ["bundled"] }
sha2 = "0.10"
similar = "2.7"
chrono = "0.4"
notify = "8.0"`;

const ZUSTAND_STORE_INITIAL = `import { create } from 'zustand';

interface InferenceTelemetry {
  status: 'ready' | 'generating' | 'loading' | 'stopped';
  tokensPerSec: number;
  vramUsedGb: number;
  backend: 'CUDA 12.4' | 'Vulkan 1.3' | 'CPU AVX2';
}

export const useRuntimeStore = create<InferenceTelemetry & {
  setTelemetry: (patch: Partial<InferenceTelemetry>) => void;
}>((set) => ({
  status: 'ready',
  tokensPerSec: 0,
  vramUsedGb: 5.8,
  backend: 'CUDA 12.4',
  setTelemetry: (patch) => set((state) => ({ ...state, ...patch })),
}));`;

export const INITIAL_PROJECT_FILES: ProjectFile[] = [
  {
    path: 'src-tauri/src/llama_bridge.rs',
    name: 'llama_bridge.rs',
    folder: 'src-tauri/src',
    language: 'rust',
    content: LLAMA_BRIDGE_INITIAL,
    originalContent: LLAMA_BRIDGE_INITIAL,
    inContext: true,
    tokensEstimate: 480,
  },
  {
    path: 'src-tauri/src/model_manager.rs',
    name: 'model_manager.rs',
    folder: 'src-tauri/src',
    language: 'rust',
    content: MODEL_MANAGER_INITIAL,
    originalContent: MODEL_MANAGER_INITIAL,
    inContext: true,
    tokensEstimate: 410,
  },
  {
    path: 'src-tauri/src/agent_core.rs',
    name: 'agent_core.rs',
    folder: 'src-tauri/src',
    language: 'rust',
    content: AGENT_CORE_INITIAL,
    originalContent: AGENT_CORE_INITIAL,
    inContext: false,
    tokensEstimate: 260,
  },
  {
    path: 'src-tauri/Cargo.toml',
    name: 'Cargo.toml',
    folder: 'src-tauri',
    language: 'toml',
    content: CARGO_TOML_INITIAL,
    originalContent: CARGO_TOML_INITIAL,
    inContext: false,
    tokensEstimate: 145,
  },
  {
    path: 'src/stores/runtimeStore.ts',
    name: 'runtimeStore.ts',
    folder: 'src/stores',
    language: 'typescript',
    content: ZUSTAND_STORE_INITIAL,
    originalContent: ZUSTAND_STORE_INITIAL,
    inContext: true,
    tokensEstimate: 190,
  },
];

const DIFF_LLAMA_BRIDGE_VULKAN = `use std::process::Command;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

#[derive(Clone, serde::Serialize)]
pub struct LlamaTelemetry {
    pub status: String,
    pub tokens_per_sec: f32,
    pub vram_used_gb: f32,
    pub backend: String,
}

pub struct LlamaState {
    pub child: Arc<Mutex<Option<CommandChild>>>,
    pub port: u16,
}

fn has_nvidia_cuda() -> bool {
    Command::new("nvidia-smi")
        .arg("--query-gpu=memory.free")
        .arg("--format=csv,noheader")
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false)
}

pub fn detect_gpu_layers(preference: &str) -> (String, u32) {
    match preference {
        "cpu" => ("CPU AVX2".into(), 0),
        "vulkan" => ("Vulkan 1.3".into(), 99),
        "cuda" => ("CUDA 12.4".into(), 99),
        _ => {
            if has_nvidia_cuda() {
                ("CUDA 12.4".into(), 99)
            } else if cfg!(target_os = "windows") {
                ("Vulkan 1.3".into(), 64)
            } else {
                ("CPU AVX2".into(), 0)
            }
        }
    }
}

#[tauri::command]
pub async fn start_llama_server(
    app: AppHandle,
    state: tauri::State<'_, LlamaState>,
    model_path: String,
    gpu_pref: String,
    n_ctx: u32,
) -> Result<u16, String> {
    let (backend, ngl) = detect_gpu_layers(&gpu_pref);
    let (mut rx, child) = app
        .shell()
        .sidecar("llama-server")
        .map_err(|e| e.to_string())?
        .args([
            "-m", &model_path,
            "--port", &state.port.to_string(),
            "--ctx-size", &n_ctx.to_string(),
            "-ngl", &ngl.to_string(),
            "--flash-attn",
            "--host", "127.0.0.1",
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    *state.child.lock().await = Some(child);

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(ev) = rx.recv().await {
            if let CommandEvent::Stderr(bytes) = ev {
                let line = String::from_utf8_lossy(&bytes).to_string();
                let _ = app_clone.emit("llama://log", line);
            }
        }
    });

    let _ = app.emit("llama://telemetry", LlamaTelemetry {
        status: "ready".into(),
        tokens_per_sec: 0.0,
        vram_used_gb: 5.8,
        backend,
    });

    Ok(state.port)
}`;

const DIFF_MODEL_MANAGER_VERIFY = `use reqwest::header::RANGE;
use sha2::{Digest, Sha256};
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

pub async fn download_gguf_resumable(
    url: &str,
    dest_path: &str,
    expected_sha256: Option<&str>,
) -> Result<String, String> {
    let part_path = format!("{}.part", dest_path);
    let existing_len = tokio::fs::metadata(&part_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(url);
    if existing_len > 0 {
        req = req.header(RANGE, format!("bytes={}-", existing_len));
    }

    let mut resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() && resp.status().as_u16() != 206 {
        return Err(format!("HTTP error {} while fetching GGUF", resp.status()));
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&part_path)
        .await
        .map_err(|e| e.to_string())?;

    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }
    file.flush().await.map_err(|e| e.to_string())?;

    let mut hasher = Sha256::new();
    let mut verify_file = File::open(&part_path).await.map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; 1024 * 1024];
    loop {
        let n = verify_file.read(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    let digest = format!("{:x}", hasher.finalize());

    if let Some(expected) = expected_sha256 {
        if !digest.eq_ignore_ascii_case(expected) {
            let _ = tokio::fs::remove_file(&part_path).await;
            return Err(format!("SHA256 mismatch: expected {}, got {}", expected, digest));
        }
    }

    tokio::fs::rename(&part_path, dest_path).await.map_err(|e| e.to_string())?;
    Ok(digest)
}`;

export const INITIAL_CHECKPOINTS: Checkpoint[] = [
  {
    id: 'cp-001',
    label: 'Начальное состояние репозитория',
    timestamp: '00:04:12',
    actionSummary: 'Базовый каркас Tauri 2.0 и llama_bridge.rs',
    filesSnapshot: {
      'src-tauri/src/llama_bridge.rs': LLAMA_BRIDGE_INITIAL,
      'src-tauri/src/model_manager.rs': MODEL_MANAGER_INITIAL,
      'src-tauri/src/agent_core.rs': AGENT_CORE_INITIAL,
      'src-tauri/Cargo.toml': CARGO_TOML_INITIAL,
      'src/stores/runtimeStore.ts': ZUSTAND_STORE_INITIAL,
    },
  },
];

export const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'session-gpu-fallback',
    title: 'Авто-детект CUDA / Vulkan в llama_bridge.rs',
    updatedAt: 'Сейчас',
    mode: 'act',
    messages: [
      {
        id: 'm-1',
        role: 'user',
        mode: 'act',
        timestamp: '00:08:14',
        content: 'Добавь реальное автоопределение NVIDIA CUDA и откат на Vulkan 1.3 / CPU в `llama_bridge.rs`, а также включи `--flash-attn` для экономии VRAM.',
      },
      {
        id: 'm-2',
        role: 'assistant',
        mode: 'act',
        timestamp: '00:08:19',
        readFiles: ['src-tauri/src/llama_bridge.rs', 'src-tauri/Cargo.toml'],
        content: 'Прочитал `src-tauri/src/llama_bridge.rs`. Сейчас `detect_gpu_layers` жёстко возвращает `CUDA 12.4` для любого режима, отличного от `cpu` и `vulkan`.\n\nПредлагаю добавить проверку доступности `nvidia-smi` на Windows с автоматическим откатом на `Vulkan 1.3` (`-ngl 64`) и далее на `CPU AVX2`, а также флаг `--flash-attn` при запуске `llama-server.exe`. Проверьте дифф и подтвердите применение.',
        diff: {
          id: 'diff-vulkan-01',
          filePath: 'src-tauri/src/llama_bridge.rs',
          summary: 'Автоопределение CUDA через nvidia-smi с откатом на Vulkan 1.3 / CPU и --flash-attn',
          oldContent: LLAMA_BRIDGE_INITIAL,
          newContent: DIFF_LLAMA_BRIDGE_VULKAN,
          status: 'pending',
        },
        command: {
          id: 'cmd-cargo-01',
          shell: 'powershell',
          command: 'cargo check --manifest-path src-tauri/Cargo.toml',
          cwd: 'C:\\Projects\\kova-studio',
          description: 'Проверка компиляции Rust backend после обновления llama_bridge.rs',
          status: 'pending',
          output: [],
        },
      },
    ],
  },
  {
    id: 'session-sha256-plan',
    title: 'План: докачка GGUF и валидация SHA256',
    updatedAt: 'Вчера',
    mode: 'plan',
    messages: [
      {
        id: 'm-p1',
        role: 'user',
        mode: 'plan',
        timestamp: '19:40:02',
        content: 'Составь план надёжной докачки больших GGUF-файлов через reqwest с проверкой SHA256 без блокировки WebView2.',
      },
      {
        id: 'm-p2',
        role: 'assistant',
        mode: 'plan',
        timestamp: '19:40:08',
        readFiles: ['src-tauri/src/model_manager.rs'],
        content: '### План реализации (режим Plan — без изменения файлов)\n\n1. **Временный файл `.part` и HTTP Range**: Перед стартом проверяем размер `<model>.gguf.part`. Если > 0 байт, отправляем заголовок `Range: bytes=<offset>-` и проверяем статус `206 Partial Content`.\n2. **Троттлинг событий прогресса**: Чтобы не перегружать WebView2 IPC при скорости 100+ МБ/с, отправляем `app.emit("model://download-progress", ...)` не чаще 1 раза в 150 мс.\n3. **Потоковый SHA256 в `spawn_blocking`**: Хеширование 5–14 ГБ файла буферами по 1 МБ не должно блокировать пул tokio-воркеров.\n\nПереключите режим на **Act**, если хотите, чтобы я сразу внёс эти улучшения в `model_manager.rs`.',
      },
    ],
  },
];

export interface AgentReplyContext {
  activeRole?: ModelRole;
  permissions?: PermissionRule[];
  directives?: ModelDirective[];
}

export function buildAgentReply(
  prompt: string,
  mode: AgentMode,
  currentFiles: ProjectFile[],
  ctx: AgentReplyContext = {},
): Omit<AgentMessage, 'id' | 'timestamp'> {
  const lower = prompt.toLowerCase();
  const bridgeFile = currentFiles.find((f) => f.path.endsWith('llama_bridge.rs'));
  const modelFile = currentFiles.find((f) => f.path.endsWith('model_manager.rs'));

  const role = ctx.activeRole;
  const roleLabel = role?.name ?? 'Разработчик';
  const enabledDirectives = (ctx.directives ?? []).filter((d) => d.enabled);
  const canWriteFiles = ctx.permissions?.find((p) => p.id === 'perm-fs-write')?.policy !== 'deny';
  const canRunShell = ctx.permissions?.find((p) => p.id === 'perm-shell-exec')?.policy !== 'deny';
  const envBlocked = ctx.permissions?.find((p) => p.id === 'perm-sec-env')?.policy === 'deny';

  if (envBlocked && (lower.includes('.env') || lower.includes('секрет') || lower.includes('ключ'))) {
    return {
      role: 'assistant',
      mode,
      roleId: role?.id,
      roleName: roleLabel,
      content: `**Ограничение библиотеки разрешений**: доступ к \`.env\` и секретам заблокирован политикой **Запретить**.\n\nВы можете изменить это правило в разделе **Роли и пайплайн → Библиотека разрешений**, но для безопасности локальных проектов чтение секретов отключено по умолчанию.`,
    };
  }

  const directivesFooter =
    enabledDirectives.length > 0
      ? `\n\n*Применены указания (${enabledDirectives.length}): ${enabledDirectives
          .slice(0, 3)
          .map((d) => d.title)
          .join(' · ')}.*`
      : '';

  if (mode === 'plan' || role?.persona === 'architect' || role?.persona === 'reviewer') {
    const heading =
      role?.persona === 'reviewer'
        ? `Ревью безопасности и качества (роль: ${roleLabel})`
        : role?.persona === 'architect'
          ? `Архитектурный разбор (роль: ${roleLabel})`
          : `Анализ задачи (режим Plan · роль: ${roleLabel})`;

    const body =
      role?.persona === 'reviewer'
        ? `1. **Проверка IPC и ошибок**: В \`src-tauri/src/\` проверено отсутствие необработанных \`unwrap()\`.\n2. **Границы файловой системы**: Запись разрешена только в пределах корня проекта с обязательным Checkpoint.\n3. **Рекомендация**: Включите проверку SHA256 и протестируйте откат в случае сбоя сети.`
        : `1. **Контекст проекта**: Проверены активные файлы (${currentFiles.filter((f) => f.inContext).length} шт.). Архитектура соответствует связке Tauri 2.0 + sidecar \`llama-server.exe\`.\n2. **Предлагаемые шаги**:\n   - Выделить критическую секцию в \`src-tauri/src/\` с защитой от паник при потере дочернего процесса.\n   - Сохранить Checkpoint перед любой записью на диск.\n   - Проверить сборку командой \`cargo check\` и прогнать тест инференса на порту \`127.0.0.1:8080\`.`;

    return {
      role: 'assistant',
      mode,
      roleId: role?.id,
      roleName: roleLabel,
      readFiles: currentFiles.filter((f) => f.inContext).map((f) => f.path),
      content: `### ${heading}\n\nЗапрос: *«${prompt}»*\n\n${body}${directivesFooter}`,
    };
  }

  if (lower.includes('sha') || lower.includes('download') || lower.includes('загруз') || lower.includes('док') || lower.includes('model')) {
    const oldCode = modelFile?.content ?? MODEL_MANAGER_INITIAL;
    const isAlreadyPatched = oldCode.includes('eq_ignore_ascii_case');
    return {
      role: 'assistant',
      mode: 'act',
      roleId: role?.id,
      roleName: roleLabel,
      readFiles: ['src-tauri/src/model_manager.rs'],
      content:
        (isAlreadyPatched
          ? 'Файл `src-tauri/src/model_manager.rs` уже содержит проверку HTTP 206, таймауты и нечувствительное к регистру сравнение SHA256.'
          : canWriteFiles
            ? 'Обновляю `src-tauri/src/model_manager.rs`: добавляю проверку HTTP-статуса `206 Partial Content`, таймаут подключения и безопасное удаление повреждённого `.part`-файла при несовпадении SHA256.'
            : 'Подготовил бы патч для `model_manager.rs`, но запись файлов сейчас запрещена политикой разрешений.') + directivesFooter,
      diff:
        isAlreadyPatched || !canWriteFiles
          ? undefined
          : {
              id: `diff-model-${Date.now()}`,
              filePath: 'src-tauri/src/model_manager.rs',
              summary: 'Проверка HTTP 206 Partial Content, таймаут и очистка битого .part при ошибке SHA256',
              oldContent: oldCode,
              newContent: DIFF_MODEL_MANAGER_VERIFY,
              status: 'pending',
            },
      command: canRunShell
        ? {
            id: `cmd-test-${Date.now()}`,
            shell: 'powershell',
            command: 'cargo test --manifest-path src-tauri/Cargo.toml model_manager',
            cwd: 'C:\\Projects\\kova-studio',
            description: 'Запуск unit-тестов модуля загрузки моделей',
            status: 'pending',
            output: [],
          }
        : undefined,
    };
  }

  if (lower.includes('ошиб') || lower.includes('error') || lower.includes('фикс') || lower.includes('vulkan') || lower.includes('cuda') || lower.includes('gpu')) {
    const oldCode = bridgeFile?.content ?? LLAMA_BRIDGE_INITIAL;
    const isAlreadyPatched = oldCode.includes('has_nvidia_cuda');
    return {
      role: 'assistant',
      mode: 'act',
      roleId: role?.id,
      roleName: roleLabel,
      readFiles: ['src-tauri/src/llama_bridge.rs'],
      content:
        (isAlreadyPatched
          ? 'Автоопределение CUDA/Vulkan уже применено в `llama_bridge.rs`. Запустите `cargo check` ниже, чтобы убедиться в отсутствии предупреждений компилятора.'
          : canWriteFiles
            ? 'Подготовил патч для `src-tauri/src/llama_bridge.rs` с проверкой `nvidia-smi`, откатом на Vulkan 1.3 и включением `--flash-attn`.'
            : 'Запись диффов заблокирована в библиотеке разрешений — вывод команды проверки доступен ниже.') + directivesFooter,
      diff:
        isAlreadyPatched || !canWriteFiles
          ? undefined
          : {
              id: `diff-bridge-${Date.now()}`,
              filePath: 'src-tauri/src/llama_bridge.rs',
              summary: 'Авто-детект CUDA / Vulkan fallback и флаг --flash-attn',
              oldContent: oldCode,
              newContent: DIFF_LLAMA_BRIDGE_VULKAN,
              status: 'pending',
            },
      command: canRunShell
        ? {
            id: `cmd-check-${Date.now()}`,
            shell: 'powershell',
            command: 'cargo check --manifest-path src-tauri/Cargo.toml',
            cwd: 'C:\\Projects\\kova-studio',
            description: 'Проверка сборки Tauri Rust backend',
            status: 'pending',
            output: [],
          }
        : undefined,
    };
  }

  return {
    role: 'assistant',
    mode: 'act',
    roleId: role?.id,
    roleName: roleLabel,
    readFiles: currentFiles.filter((f) => f.inContext).map((f) => f.path),
    content:
      `Действую в роли **${roleLabel}**. Проанализировал активный контекст (${currentFiles
        .filter((f) => f.inContext)
        .map((f) => `\`${f.name}\``)
        .join(', ')}).\n\nДля задачи *«${prompt}»* рекомендую ${
        canRunShell
          ? 'проверить состояние локального Rust-пакета и доступность `llama-server.exe` через PowerShell'
          : 'выполнить проверку вручную (запуск PowerShell отключён в библиотеке разрешений)'
      }.${directivesFooter}`,
    command: canRunShell
      ? {
          id: `cmd-ver-${Date.now()}`,
          shell: 'powershell',
          command: '.\\src-tauri\\binaries\\llama-server-x86_64-pc-windows-msvc.exe --version',
          cwd: 'C:\\Projects\\kova-studio',
          description: 'Проверка версии встроенного sidecar-бинарника llama-server.exe',
          status: 'pending',
          output: [],
        }
      : undefined,
  };
}
