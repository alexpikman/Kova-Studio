use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

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
        .unwrap_or_else(|_| PathBuf::from("."));
    let models_dir = app_data.join("models");
    let bin_dir = app_data.join("bin");

    let _ = std::fs::create_dir_all(&models_dir);
    let _ = std::fs::create_dir_all(&bin_dir);

    let sidecar_ready = app
        .shell()
        .sidecar("llama-server")
        .is_ok();

    Ok(AppPathsInfo {
        models_dir: models_dir.to_string_lossy().to_string(),
        bin_dir: bin_dir.to_string_lossy().to_string(),
        sidecar_ready,
    })
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
        .invoke_handler(tauri::generate_handler![get_app_paths, detect_gpu_backend])
        .run(tauri::generate_context!())
        .expect("error while running Kova Studio Tauri application");
}
