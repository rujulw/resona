mod database;

use database::AppDatabase;
use serde::Serialize;
use tauri::State;

struct DatabaseState {
    app_database: AppDatabase,
}

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
    persistence: PersistenceState,
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
fn get_shell_state(database_state: State<'_, DatabaseState>) -> ShellStatePayload {
    build_shell_state(&database_state.app_database)
}

fn build_shell_state(app_database: &AppDatabase) -> ShellStatePayload {
    let migration_status = app_database.migration_status().ok();
    let persistence = PersistenceState {
        status_label: if migration_status.is_some() {
            "Ready"
        } else {
            "Unavailable"
        },
        detail: migration_status
            .as_ref()
            .map(|status| status.latest_migration)
            .unwrap_or("migration status unavailable"),
        database_path: app_database.db_path().display().to_string(),
    };

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
                state: persistence.status_label,
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
        persistence,
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PersistenceState {
    status_label: &'static str,
    detail: &'static str,
    database_path: String,
}

pub fn run() {
    let app_database =
        AppDatabase::initialize_default().expect("failed to initialize resona database");

    tauri::Builder::default()
        .manage(DatabaseState { app_database })
        .invoke_handler(tauri::generate_handler![
            bootstrap_app,
            get_shell_state,
            playback_action
        ])
        .run(tauri::generate_context!())
        .expect("failed to run resona tauri application");
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{bootstrap_app, build_shell_state, playback_action, DatabaseState};
    use crate::database::AppDatabase;

    fn test_database_state() -> DatabaseState {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let db_path = std::env::temp_dir().join(format!("resona-shell-state-{nanos}.sqlite3"));

        DatabaseState {
            app_database: AppDatabase::initialize_at(db_path)
                .expect("test database should initialize"),
        }
    }

    #[test]
    fn bootstrap_payload_exposes_shell_runtime() {
        let payload = bootstrap_app();

        assert_eq!(payload.app_name, "resona");
        assert_eq!(payload.window_title, "resona");
        assert_eq!(payload.runtime.desktop_shell, "tauri");
        assert_eq!(payload.runtime.frontend, "react-vite");
        assert_eq!(payload.runtime.core, "rust");
    }

    #[test]
    fn shell_state_returns_nav_rows_and_playback_defaults() {
        let database_state = test_database_state();
        let payload = build_shell_state(&database_state.app_database);

        assert_eq!(payload.nav_sections.len(), 6);
        assert_eq!(payload.library_rows.len(), 3);
        assert_eq!(payload.library_rows[1].title, "atlas");
        assert_eq!(payload.persistence.status_label, "Ready");
        assert_eq!(payload.playback.status_label, "Nothing playing");
        assert_eq!(payload.playback.transport_label, "Idle");
    }

    #[test]
    fn playback_action_returns_expected_transport_messages() {
        let previous = playback_action("previous");
        let toggle = playback_action("toggle");
        let next = playback_action("next");

        assert_eq!(previous.transport_label, "Previous unavailable");
        assert_eq!(toggle.transport_label, "Play requested");
        assert_eq!(next.transport_label, "Next unavailable");
    }
}
