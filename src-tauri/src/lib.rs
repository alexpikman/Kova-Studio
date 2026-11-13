use serde::Serialize;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    fs::{self, OpenOptions},
    net::{SocketAddr, TcpListener, TcpStream},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

struct BackendRuntime {
    url: String,
    child: Mutex<Option<Child>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPathsInfo {
    pub models_dir: String,
    pub bin_dir: String,
    pub sidecar_ready: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuProbeResult {
    pub backend: String,
    pub details: String,
}

#[tauri::command]
fn get_app_paths(app: tauri::AppHandle) -> Result<AppPathsInfo, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve application data directory: {error}"))?;
    let models_dir = app_data.join("models");
    let bin_dir = app_data.join("bin");

    fs::create_dir_all(&models_dir)
        .map_err(|error| format!("Could not create models directory: {error}"))?;
    fs::create_dir_all(&bin_dir)
        .map_err(|error| format!("Could not create binaries directory: {error}"))?;

    let sidecar_ready = app.shell().sidecar("llama-server").is_ok();

    Ok(AppPathsInfo {
        models_dir: models_dir.to_string_lossy().to_string(),
        bin_dir: bin_dir.to_string_lossy().to_string(),
        sidecar_ready,
    })
}

#[tauri::command]
fn get_backend_url(state: tauri::State<'_, BackendRuntime>) -> String {
    state.url.clone()
}

fn start_backend(app: &tauri::AppHandle) -> Result<BackendRuntime, String> {
    if cfg!(debug_assertions) {
        return Ok(BackendRuntime {
            url: "http://127.0.0.1:3000".to_string(),
            child: Mutex::new(None),
        });
    }

    start_packaged_backend(app)
}

fn start_packaged_backend(app: &tauri::AppHandle) -> Result<BackendRuntime, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Could not resolve application resources: {error}"))?;
    let node = resource_dir.join("node.exe");
    let backend = resource_dir.join("backend.cjs");
    if !node.is_file() || !backend.is_file() {
        return Err(format!(
            "Packaged backend resources are missing (Node: {}, backend: {})",
            node.display(),
            backend.display()
        ));
    }

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve application data directory: {error}"))?;
    fs::create_dir_all(&app_data)
        .map_err(|error| format!("Could not create application data directory: {error}"))?;
    let log_path = app_data.join("backend.log");
    let log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|error| format!("Could not open backend log {}: {error}", log_path.display()))?;

    let mut last_error = String::new();
    for _ in 0..5 {
        let port = TcpListener::bind(("127.0.0.1", 0))
            .map_err(|error| format!("Could not reserve a local API port: {error}"))?
            .local_addr()
            .map_err(|error| format!("Could not read the local API port: {error}"))?
            .port();
        let stdout = log
            .try_clone()
            .map_err(|error| format!("Could not open backend log: {error}"))?;
        let stderr = log
            .try_clone()
            .map_err(|error| format!("Could not open backend log: {error}"))?;
        let mut command = Command::new(&node);
        command
            .arg(&backend)
            .current_dir(&app_data)
            .env("NODE_ENV", "production")
            .env("KOVA_BACKEND_ONLY", "true")
            .env("KOVA_APP_ROOT", &resource_dir)
            .env("KOVA_HOME", &app_data)
            .env("HOST", "127.0.0.1")
            .env("PORT", port.to_string())
            .stdin(Stdio::null())
            .stdout(Stdio::from(stdout))
            .stderr(Stdio::from(stderr));
        #[cfg(windows)]
        command.creation_flags(0x08000000);
        let mut child = command
            .spawn()
            .map_err(|error| format!("Could not start the bundled Node backend: {error}"))?;

        match wait_for_backend(&mut child, port) {
            Ok(()) => {
                return Ok(BackendRuntime {
                    url: format!("http://127.0.0.1:{port}"),
                    child: Mutex::new(Some(child)),
                });
            }
            Err(error) => {
                last_error = error;
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }

    Err(format!(
        "Local API did not start after 5 attempts: {last_error}. See {}",
        log_path.display()
    ))
}

fn wait_for_backend(child: &mut Child, port: u16) -> Result<(), String> {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    for _ in 0..50 {
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("Could not check the backend process: {error}"))?
        {
            return Err(format!("Backend process exited with status {status}"));
        }
        if TcpStream::connect_timeout(&address, Duration::from_millis(100)).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(100));
    }

    Err("Timed out waiting for the local API to start".to_string())
}

#[tauri::command]
fn detect_gpu_backend() -> GpuProbeResult {
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = std::process::Command::new("nvidia-smi")
            .args(["--query-gpu=name,memory.total", "--format=csv,noheader"])
            .output()
        {
            if output.status.success() {
                let info = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !info.is_empty() {
                    return GpuProbeResult {
                        backend: "cuda".to_string(),
                        details: info,
                    };
                }
            }
        }
        return GpuProbeResult {
            backend: "vulkan".to_string(),
            details: "Vulkan 1.3 (fallback to CPU AVX2)".to_string(),
        };
    }

    #[cfg(not(target_os = "windows"))]
    {
        GpuProbeResult {
            backend: "cpu".to_string(),
            details: "Host non-Windows runtime".to_string(),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_app_paths,
            get_backend_url,
            detect_gpu_backend
        ])
        .setup(|app| {
            let backend = start_backend(app.handle()).map_err(|error| {
                Box::new(std::io::Error::new(std::io::ErrorKind::Other, error))
                    as Box<dyn std::error::Error>
            })?;
            app.manage(backend);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Kova Studio Tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(runtime) = app_handle.try_state::<BackendRuntime>() {
                    if let Ok(mut child_slot) = runtime.child.lock() {
                        if let Some(mut child) = child_slot.take() {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        });
}
