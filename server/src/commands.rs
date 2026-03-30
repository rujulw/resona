use serde::Serialize;
use tauri::State;

use crate::database::AppDatabase;
use crate::library::{
    LibraryPage, LibraryQuery, LocalLibraryScanner, ScanSummary, SortDirection, TrackSortKey,
};

pub struct DatabaseState {
    pub app_database: AppDatabase,
}

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
    pub playback: PlaybackShellState,
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
pub struct PlaybackShellState {
    pub status_label: &'static str,
    pub transport_label: &'static str,
    pub progress_seconds: u32,
    pub duration_seconds: u32,
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
pub fn get_shell_state(database_state: State<'_, DatabaseState>) -> ShellStatePayload {
    build_shell_state(&database_state.app_database)
}

pub fn build_shell_state(app_database: &AppDatabase) -> ShellStatePayload {
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
pub fn scan_local_library(
    database_state: State<'_, DatabaseState>,
    root_path: String,
    display_name: Option<String>,
) -> Result<ScanSummary, String> {
    scan_local_library_with_database(
        &database_state.app_database,
        &root_path,
        display_name.as_deref(),
    )
    .map_err(|error| error.to_string())
}

pub fn scan_local_library_with_database(
    app_database: &AppDatabase,
    root_path: &str,
    display_name: Option<&str>,
) -> Result<ScanSummary, crate::library::ScanError> {
    LocalLibraryScanner::new(app_database.clone()).scan_path(root_path, display_name)
}

#[tauri::command]
pub fn query_library(
    database_state: State<'_, DatabaseState>,
    page_size: Option<usize>,
    cursor: Option<String>,
    search: Option<String>,
    sort_key: Option<String>,
    sort_direction: Option<String>,
) -> Result<LibraryPage, String> {
    query_library_with_database(
        &database_state.app_database,
        page_size,
        cursor,
        search,
        sort_key,
        sort_direction,
    )
    .map_err(|error| error.to_string())
}

pub fn query_library_with_database(
    app_database: &AppDatabase,
    page_size: Option<usize>,
    cursor: Option<String>,
    search: Option<String>,
    sort_key: Option<String>,
    sort_direction: Option<String>,
) -> Result<LibraryPage, crate::library::ScanError> {
    let sort_key = match sort_key.as_deref() {
        Some("artist") => TrackSortKey::Artist,
        Some("album") => TrackSortKey::Album,
        Some("indexed_at") => TrackSortKey::IndexedAt,
        _ => TrackSortKey::Title,
    };
    let sort_direction = match sort_direction.as_deref() {
        Some("desc") => SortDirection::Desc,
        _ => SortDirection::Asc,
    };

    LocalLibraryScanner::new(app_database.clone()).query_library(&LibraryQuery {
        page_size: page_size.unwrap_or(50),
        cursor,
        search,
        sort_key,
        sort_direction,
    })
}

#[tauri::command]
pub fn playback_action(action: &str) -> PlaybackShellState {
    playback_state_for_action(action)
}

pub fn playback_state_for_action(action: &str) -> PlaybackShellState {
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

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{
        bootstrap_app, build_shell_state, playback_state_for_action, query_library_with_database,
        scan_local_library_with_database, DatabaseState,
    };
    use crate::database::AppDatabase;

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn unique_test_suffix(prefix: &str) -> String {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let counter = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);

        format!("{prefix}-{nanos}-{counter}")
    }

    fn test_database_state() -> DatabaseState {
        let db_path = std::env::temp_dir().join(format!(
            "{}.sqlite3",
            unique_test_suffix("resona-shell-state")
        ));

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
        assert_eq!(payload.persistence.track_count, 0);
        assert_eq!(payload.playback.status_label, "Nothing playing");
        assert_eq!(payload.playback.transport_label, "Idle");
    }

    #[test]
    fn playback_action_returns_expected_transport_messages() {
        let previous = playback_state_for_action("previous");
        let toggle = playback_state_for_action("toggle");
        let next = playback_state_for_action("next");

        assert_eq!(previous.transport_label, "Previous unavailable");
        assert_eq!(toggle.transport_label, "Play requested");
        assert_eq!(next.transport_label, "Next unavailable");
    }

    #[test]
    fn local_scan_command_persists_mp3_files() {
        let database_state = test_database_state();
        let root = std::env::temp_dir().join(unique_test_suffix("resona-command-scan"));

        std::fs::create_dir_all(root.join("nested")).expect("directories should be created");
        std::fs::File::create(root.join("alpha.mp3")).expect("root mp3 should be created");
        std::fs::File::create(root.join("nested").join("beta.mp3"))
            .expect("nested mp3 should be created");

        let summary = scan_local_library_with_database(
            &database_state.app_database,
            &root.display().to_string(),
            Some("portfolio"),
        )
        .expect("scan should succeed");

        assert_eq!(summary.discovered_tracks, 2);

        let payload = build_shell_state(&database_state.app_database);
        assert_eq!(payload.persistence.track_count, 2);
        assert_eq!(payload.persistence.library_root_count, 1);
    }

    #[test]
    fn query_library_command_returns_paginated_results() {
        let database_state = test_database_state();
        let root = std::env::temp_dir().join(unique_test_suffix("resona-query-library"));

        std::fs::create_dir_all(&root).expect("directories should be created");
        std::fs::File::create(root.join("alpha.mp3")).expect("first track should be created");
        std::fs::File::create(root.join("beta.mp3")).expect("second track should be created");

        scan_local_library_with_database(
            &database_state.app_database,
            &root.display().to_string(),
            Some("portfolio"),
        )
        .expect("scan should succeed");

        let page = query_library_with_database(
            &database_state.app_database,
            Some(1),
            None,
            None,
            Some("title".to_owned()),
            Some("asc".to_owned()),
        )
        .expect("query should succeed");

        assert_eq!(page.items.len(), 1);
        assert_eq!(page.total, 2);
        assert!(page.next_cursor.is_some());
    }
}
