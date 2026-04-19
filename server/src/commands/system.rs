use serde::Serialize;
use tauri::State;

use super::DatabaseState;
use crate::database::AppDatabase;
use crate::library::LocalLibraryScanner;
use crate::playback::{PlaybackRuntimeState, PlaybackSnapshot};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapPayload {
    pub app_name: &'static str,
    pub app_version: &'static str,
    pub window_title: &'static str,
    pub platform: &'static str,
    pub runtime: RuntimeInfo,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo {
    pub desktop_shell: &'static str,
    pub frontend: &'static str,
    pub core: &'static str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellStatePayload {
    pub nav_sections: Vec<NavSection>,
    pub library_rows: Vec<LibraryRow>,
    pub playback: PlaybackSnapshot,
    pub persistence: PersistenceState,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NavSection {
    pub id: &'static str,
    pub label: &'static str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryRow {
    pub title: &'static str,
    pub detail: String,
    pub state: &'static str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistenceState {
    pub status_label: &'static str,
    pub detail: &'static str,
    pub database_path: String,
    pub track_count: usize,
    pub library_root_count: usize,
}

#[tauri::command]
pub fn bootstrap_app() -> BootstrapPayload {
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

#[tauri::command]
pub fn get_shell_state(
    database_state: State<'_, DatabaseState>,
    playback_runtime_state: State<'_, PlaybackRuntimeState>,
) -> ShellStatePayload {
    build_shell_state_with_playback(
        &database_state.app_database,
        playback_runtime_state.snapshot(),
    )
}

#[cfg(test)]
pub fn build_shell_state(app_database: &AppDatabase) -> ShellStatePayload {
    build_shell_state_with_playback(app_database, PlaybackRuntimeState::default().snapshot())
}

pub fn build_shell_state_with_playback(
    app_database: &AppDatabase,
    playback: PlaybackSnapshot,
) -> ShellStatePayload {
    let migration_status = app_database.migration_status().ok();
    let library_summary = LocalLibraryScanner::new(app_database.clone())
        .library_summary()
        .ok();
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
        track_count: library_summary
            .as_ref()
            .map(|summary| summary.tracks)
            .unwrap_or(0),
        library_root_count: library_summary
            .as_ref()
            .map(|summary| summary.library_roots)
            .unwrap_or(0),
    };

    let library_detail = if persistence.track_count == 0 {
        "No tracks loaded yet".to_owned()
    } else {
        format!(
            "{} tracks indexed across {} root(s)",
            persistence.track_count, persistence.library_root_count
        )
    };

    ShellStatePayload {
        nav_sections: vec![
            NavSection {
                id: "home",
                label: "Home",
            },
            NavSection {
                id: "tracks",
                label: "Tracks",
            },
            NavSection {
                id: "albums",
                label: "Albums",
            },
            NavSection {
                id: "playlists",
                label: "Playlists",
            },
            NavSection {
                id: "queue",
                label: "Queue",
            },
            NavSection {
                id: "settings",
                label: "Settings",
            },
        ],
        library_rows: vec![
            LibraryRow {
                title: "Library",
                detail: library_detail,
                state: persistence.status_label,
            },
            LibraryRow {
                title: "atlas",
                detail: "Remote source not connected".to_owned(),
                state: "Idle",
            },
            LibraryRow {
                title: "timbre",
                detail: "Analysis queue unavailable".to_owned(),
                state: "Idle",
            },
        ],
        playback,
        persistence,
    }
}
