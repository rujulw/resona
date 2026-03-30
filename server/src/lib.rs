use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppShellState {
    app_name: &'static str,
    playback_mode: &'static str,
    remote_store: &'static str,
    analysis_engine: &'static str,
}

#[tauri::command]
fn app_shell_state() -> AppShellState {
    AppShellState {
        app_name: "resona",
        playback_mode: "local-first",
        remote_store: "atlas",
        analysis_engine: "timbre",
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_shell_state])
        .run(tauri::generate_context!())
        .expect("failed to run resona tauri application");
}
