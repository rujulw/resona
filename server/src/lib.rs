use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapPayload {
    app_name: &'static str,
    app_version: &'static str,
    window_title: &'static str,
    platform: &'static str,
    runtime: RuntimeInfo,
}

#[tauri::command]
fn bootstrap_app() -> BootstrapPayload {
    BootstrapPayload {
        app_name: "resona",
        app_version: env!("CARGO_PKG_VERSION"),
        window_title: "resona",
        platform: std::env::consts::OS,
        runtime: RuntimeInfo {
            desktop_shell: "tauri",
            frontend: "react-vite",
            core: "rust",
        },
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeInfo {
    desktop_shell: &'static str,
    frontend: &'static str,
    core: &'static str,
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![bootstrap_app])
        .run(tauri::generate_context!())
        .expect("failed to run resona tauri application");
}
