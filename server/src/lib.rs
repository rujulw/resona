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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellStatePayload {
    nav_sections: Vec<NavSection>,
    library_rows: Vec<LibraryRow>,
    playback: PlaybackShellState,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NavSection {
    id: &'static str,
    label: &'static str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LibraryRow {
    title: &'static str,
    detail: &'static str,
    state: &'static str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlaybackShellState {
    status_label: &'static str,
    transport_label: &'static str,
    progress_seconds: u32,
    duration_seconds: u32,
}

#[tauri::command]
fn get_shell_state() -> ShellStatePayload {
    ShellStatePayload {
        nav_sections: vec![
            NavSection {
                id: "tracks",
                label: "Tracks",
            },
            NavSection {
                id: "albums",
                label: "Albums",
            },
            NavSection {
                id: "artists",
                label: "Artists",
            },
            NavSection {
                id: "queue",
                label: "Queue",
            },
            NavSection {
                id: "insights",
                label: "Insights",
            },
            NavSection {
                id: "settings",
                label: "Settings",
            },
        ],
        library_rows: vec![
            LibraryRow {
                title: "Library",
                detail: "No tracks loaded yet",
                state: "Idle",
            },
            LibraryRow {
                title: "atlas",
                detail: "Remote source not connected",
                state: "Idle",
            },
            LibraryRow {
                title: "timbre",
                detail: "Analysis queue unavailable",
                state: "Idle",
            },
        ],
        playback: PlaybackShellState {
            status_label: "Nothing playing",
            transport_label: "Idle",
            progress_seconds: 0,
            duration_seconds: 0,
        },
    }
}

#[tauri::command]
fn playback_action(action: &str) -> PlaybackShellState {
    match action {
        "previous" => PlaybackShellState {
            status_label: "Nothing playing",
            transport_label: "Previous unavailable",
            progress_seconds: 0,
            duration_seconds: 0,
        },
        "next" => PlaybackShellState {
            status_label: "Nothing playing",
            transport_label: "Next unavailable",
            progress_seconds: 0,
            duration_seconds: 0,
        },
        _ => PlaybackShellState {
            status_label: "Nothing playing",
            transport_label: "Play requested",
            progress_seconds: 0,
            duration_seconds: 0,
        },
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            bootstrap_app,
            get_shell_state,
            playback_action
        ])
        .run(tauri::generate_context!())
        .expect("failed to run resona tauri application");
}
