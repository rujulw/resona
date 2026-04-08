use serde::Serialize;
use tauri::{AppHandle, State};

use crate::database::AppDatabase;
use crate::library::{
    ArtworkSource, LibraryPage, LibraryQuery, LocalLibraryScanner, PlaybackSource, ScanSummary,
    SortDirection, TrackSortKey,
};
use crate::playback::{
    emit_playback_state, playback_contract, LoadedPlaybackTrackPayload, PlaybackContract,
    PlaybackRuntimeState, PlaybackSnapshot,
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

#[tauri::command]
pub fn describe_playback_contract() -> PlaybackContract {
    playback_contract()
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
        playback,
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
pub fn resolve_track_playback_source(
    database_state: State<'_, DatabaseState>,
    track_id: String,
) -> Result<PlaybackSource, String> {
    resolve_track_playback_source_with_database(&database_state.app_database, &track_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("No local playback source found for track {track_id}"))
}

pub fn resolve_track_playback_source_with_database(
    app_database: &AppDatabase,
    track_id: &str,
) -> Result<Option<PlaybackSource>, crate::library::ScanError> {
    LocalLibraryScanner::new(app_database.clone()).resolve_playback_source(track_id)
}

#[tauri::command]
pub fn resolve_artwork_source(
    database_state: State<'_, DatabaseState>,
    artwork_key: String,
) -> Result<ArtworkSource, String> {
    resolve_artwork_source_with_database(&database_state.app_database, &artwork_key)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("No artwork source found for artwork {artwork_key}"))
}

pub fn resolve_artwork_source_with_database(
    app_database: &AppDatabase,
    artwork_key: &str,
) -> Result<Option<ArtworkSource>, crate::library::ScanError> {
    LocalLibraryScanner::new(app_database.clone()).resolve_artwork_source(artwork_key)
}

#[tauri::command]
pub fn load_playback_track(
    app_handle: AppHandle,
    database_state: State<'_, DatabaseState>,
    playback_runtime_state: State<'_, PlaybackRuntimeState>,
    track_id: String,
) -> Result<LoadedPlaybackTrackPayload, String> {
    let payload = load_playback_track_with_database(
        &database_state.app_database,
        &playback_runtime_state,
        &track_id,
    )
    .map_err(|error| error.to_string())?;

    emit_playback_state(&app_handle, &payload.playback).map_err(|error| error.to_string())?;

    Ok(payload)
}

pub fn load_playback_track_with_database(
    app_database: &AppDatabase,
    playback_runtime_state: &PlaybackRuntimeState,
    track_id: &str,
) -> Result<LoadedPlaybackTrackPayload, crate::library::ScanError> {
    let track = LocalLibraryScanner::new(app_database.clone())
        .resolve_playback_track(track_id)?
        .ok_or_else(|| {
            crate::library::ScanError::InvalidRoot(format!(
                "No local playback track found for track {track_id}"
            ))
        })?;

    Ok(playback_runtime_state.load_track(track))
}

#[tauri::command]
pub fn playback_action(
    app_handle: AppHandle,
    playback_runtime_state: State<'_, PlaybackRuntimeState>,
    action: &str,
) -> Result<PlaybackSnapshot, String> {
    let snapshot = playback_action_with_runtime(&playback_runtime_state, action);
    emit_playback_state(&app_handle, &snapshot).map_err(|error| error.to_string())?;
    Ok(snapshot)
}

pub fn playback_action_with_runtime(
    playback_runtime_state: &PlaybackRuntimeState,
    action: &str,
) -> PlaybackSnapshot {
    playback_runtime_state.apply_action(action)
}

#[cfg(test)]
pub fn sync_playback_timing_with_runtime(
    playback_runtime_state: &PlaybackRuntimeState,
    progress_seconds: Option<u32>,
    duration_seconds: Option<u32>,
) -> PlaybackSnapshot {
    playback_runtime_state.sync_timing(progress_seconds, duration_seconds)
}

#[cfg(test)]
pub fn seek_playback_with_runtime(
    playback_runtime_state: &PlaybackRuntimeState,
    position_seconds: u32,
) -> PlaybackSnapshot {
    playback_runtime_state.seek(position_seconds)
}

#[cfg(test)]
pub fn complete_playback_with_runtime(
    playback_runtime_state: &PlaybackRuntimeState,
) -> PlaybackSnapshot {
    playback_runtime_state.complete()
}

#[cfg(test)]
pub fn report_playback_error_with_runtime(
    playback_runtime_state: &PlaybackRuntimeState,
    transport_label: Option<&str>,
) -> PlaybackSnapshot {
    playback_runtime_state.report_error(transport_label)
}

#[tauri::command]
pub fn sync_playback_timing(
    app_handle: AppHandle,
    playback_runtime_state: State<'_, PlaybackRuntimeState>,
    progress_seconds: Option<u32>,
    duration_seconds: Option<u32>,
) -> Result<PlaybackSnapshot, String> {
    let snapshot = playback_runtime_state.sync_timing(progress_seconds, duration_seconds);
    emit_playback_state(&app_handle, &snapshot).map_err(|error| error.to_string())?;
    Ok(snapshot)
}

#[tauri::command]
pub fn seek_playback(
    app_handle: AppHandle,
    playback_runtime_state: State<'_, PlaybackRuntimeState>,
    position_seconds: u32,
) -> Result<PlaybackSnapshot, String> {
    let snapshot = playback_runtime_state.seek(position_seconds);
    emit_playback_state(&app_handle, &snapshot).map_err(|error| error.to_string())?;
    Ok(snapshot)
}

#[tauri::command]
pub fn complete_playback(
    app_handle: AppHandle,
    playback_runtime_state: State<'_, PlaybackRuntimeState>,
) -> Result<PlaybackSnapshot, String> {
    let snapshot = playback_runtime_state.complete();
    emit_playback_state(&app_handle, &snapshot).map_err(|error| error.to_string())?;
    Ok(snapshot)
}

#[tauri::command]
pub fn report_playback_error(
    app_handle: AppHandle,
    playback_runtime_state: State<'_, PlaybackRuntimeState>,
    transport_label: Option<String>,
) -> Result<PlaybackSnapshot, String> {
    let snapshot = playback_runtime_state.report_error(transport_label.as_deref());
    emit_playback_state(&app_handle, &snapshot).map_err(|error| error.to_string())?;
    Ok(snapshot)
}

#[cfg(test)]
pub fn playback_state_for_action(action: &str) -> PlaybackSnapshot {
    let runtime = PlaybackRuntimeState::default();
    runtime.apply_action(action)
}

#[cfg(test)]
mod tests {
    use std::io::Write;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    use id3::frame::ExtendedText;
    use id3::{Tag, TagLike, Version};

    use super::{
        bootstrap_app, build_shell_state, build_shell_state_with_playback,
        complete_playback_with_runtime, describe_playback_contract,
        load_playback_track_with_database, playback_action_with_runtime, playback_state_for_action,
        query_library_with_database, report_playback_error_with_runtime,
        resolve_track_playback_source_with_database, scan_local_library_with_database,
        seek_playback_with_runtime, sync_playback_timing_with_runtime, DatabaseState,
    };
    use crate::database::AppDatabase;
    use crate::playback::PlaybackRuntimeState;

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

    fn write_test_mp3(
        file_path: &std::path::Path,
        title: Option<&str>,
        album: Option<&str>,
        artist: Option<&str>,
        advisory: Option<bool>,
    ) {
        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent).expect("parent directories should be created");
        }

        std::fs::File::create(file_path).expect("tagged mp3 file should be created");

        let mut tag = Tag::new();
        if let Some(title) = title {
            tag.set_title(title);
        }
        if let Some(album) = album {
            tag.set_album(album);
        }
        if let Some(artist) = artist {
            tag.set_artist(artist);
        }
        if let Some(advisory) = advisory {
            tag.add_frame(ExtendedText {
                description: "ITUNESADVISORY".to_owned(),
                value: if advisory { "1" } else { "2" }.to_owned(),
            });
        }

        tag.write_to_path(file_path, Version::Id3v24)
            .expect("id3 tag should write");

        std::fs::OpenOptions::new()
            .append(true)
            .open(file_path)
            .and_then(|mut file| file.write_all(b"\xFF\xFB\x90\x64"))
            .expect("mp3 bytes should append");
    }

    fn write_test_flac(
        file_path: &std::path::Path,
        title: Option<&str>,
        album: Option<&str>,
        artist: Option<&str>,
        include_artwork: bool,
        advisory: Option<bool>,
    ) {
        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent).expect("parent directories should be created");
        }

        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"fLaC");

        let streaminfo = build_test_flac_streaminfo(44_100, 132_300);
        bytes.push(0);
        bytes.extend_from_slice(&(streaminfo.len() as u32).to_be_bytes()[1..]);
        bytes.extend_from_slice(&streaminfo);

        let comments = build_test_flac_comments(title, album, artist, advisory);
        bytes.push(if include_artwork { 4 } else { 0x84 });
        bytes.extend_from_slice(&(comments.len() as u32).to_be_bytes()[1..]);
        bytes.extend_from_slice(&comments);

        if include_artwork {
            let picture = build_test_flac_picture();
            bytes.push(0x86);
            bytes.extend_from_slice(&(picture.len() as u32).to_be_bytes()[1..]);
            bytes.extend_from_slice(&picture);
        }

        std::fs::File::create(file_path)
            .and_then(|mut file| file.write_all(&bytes))
            .expect("test flac should be created");
    }

    fn build_test_flac_streaminfo(sample_rate: u32, total_samples: u64) -> Vec<u8> {
        let mut block = vec![0u8; 34];
        block[0..2].copy_from_slice(&4096u16.to_be_bytes());
        block[2..4].copy_from_slice(&4096u16.to_be_bytes());
        let combined = ((sample_rate as u64) << 44) | (1u64 << 41) | (15u64 << 36) | total_samples;
        let combined_bytes = combined.to_be_bytes();
        block[10..18].copy_from_slice(&combined_bytes);
        block
    }

    fn build_test_flac_comments(
        title: Option<&str>,
        album: Option<&str>,
        artist: Option<&str>,
        advisory: Option<bool>,
    ) -> Vec<u8> {
        let mut comments = Vec::new();
        let vendor = b"resona-command-test";
        comments.extend_from_slice(&(vendor.len() as u32).to_le_bytes());
        comments.extend_from_slice(vendor);

        let mut entries = Vec::new();
        if let Some(title) = title {
            entries.push(format!("TITLE={title}"));
        }
        if let Some(album) = album {
            entries.push(format!("ALBUM={album}"));
        }
        if let Some(artist) = artist {
            entries.push(format!("ARTIST={artist}"));
        }
        if let Some(advisory) = advisory {
            entries.push(format!(
                "ITUNESADVISORY={}",
                if advisory { "1" } else { "2" }
            ));
        }
        entries.push("TRACKNUMBER=4".to_owned());
        entries.push("DISCNUMBER=1".to_owned());

        comments.extend_from_slice(&(entries.len() as u32).to_le_bytes());
        for entry in entries {
            comments.extend_from_slice(&(entry.len() as u32).to_le_bytes());
            comments.extend_from_slice(entry.as_bytes());
        }
        comments
    }

    fn build_test_flac_picture() -> Vec<u8> {
        let mime = b"image/png";
        let description = b"cover";
        let data = [137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4];
        let mut block = Vec::new();
        block.extend_from_slice(&3u32.to_be_bytes());
        block.extend_from_slice(&(mime.len() as u32).to_be_bytes());
        block.extend_from_slice(mime);
        block.extend_from_slice(&(description.len() as u32).to_be_bytes());
        block.extend_from_slice(description);
        block.extend_from_slice(&64u32.to_be_bytes());
        block.extend_from_slice(&64u32.to_be_bytes());
        block.extend_from_slice(&24u32.to_be_bytes());
        block.extend_from_slice(&0u32.to_be_bytes());
        block.extend_from_slice(&(data.len() as u32).to_be_bytes());
        block.extend_from_slice(&data);
        block
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
    fn shell_state_can_embed_runtime_playback_snapshot() {
        let database_state = test_database_state();
        let playback = playback_state_for_action("toggle");
        let payload = build_shell_state_with_playback(&database_state.app_database, playback);

        assert_eq!(payload.playback.transport_label, "Play requested");
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
    fn playback_contract_exposes_v1_1_runtime_boundary() {
        let payload = describe_playback_contract();

        assert_eq!(
            payload.runtime_boundary,
            "tauri commands mutate playback runtime and tauri events broadcast playback snapshots"
        );
        assert_eq!(payload.commands.len(), 8);
        assert_eq!(payload.events.len(), 2);
        assert_eq!(payload.commands[0].name, "load_playback_track");
        assert_eq!(payload.commands[3].name, "sync_playback_timing");
        assert_eq!(payload.events[0].name, "playback://state-changed");
    }

    #[test]
    fn local_scan_command_persists_supported_local_audio_files() {
        let database_state = test_database_state();
        let root = std::env::temp_dir().join(unique_test_suffix("resona-command-scan"));

        std::fs::create_dir_all(root.join("nested")).expect("directories should be created");
        std::fs::File::create(root.join("alpha.mp3")).expect("root mp3 should be created");
        std::fs::File::create(root.join("nested").join("beta.flac"))
            .expect("nested flac should be created");

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

    #[test]
    fn playback_source_command_returns_local_path_for_indexed_track() {
        let database_state = test_database_state();
        let root = std::env::temp_dir().join(unique_test_suffix("resona-playback-source"));

        std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
        std::fs::File::create(root.join("disc").join("alpha.mp3"))
            .expect("track should be created");

        scan_local_library_with_database(
            &database_state.app_database,
            &root.display().to_string(),
            Some("portfolio"),
        )
        .expect("scan should succeed");

        let page = query_library_with_database(
            &database_state.app_database,
            Some(10),
            None,
            None,
            Some("title".to_owned()),
            Some("asc".to_owned()),
        )
        .expect("query should succeed");

        let source = resolve_track_playback_source_with_database(
            &database_state.app_database,
            &page.items[0].id,
        )
        .expect("lookup should succeed")
        .expect("source should exist");

        assert_eq!(source.track_id, page.items[0].id);
        assert!(source.local_path.ends_with("disc/alpha.mp3"));
        assert_eq!(source.extension, "mp3");
    }

    #[test]
    fn load_playback_track_populates_runtime_snapshot() {
        let database_state = test_database_state();
        let playback_runtime_state = PlaybackRuntimeState::default();
        let root = std::env::temp_dir().join(unique_test_suffix("resona-load-playback"));

        std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
        std::fs::File::create(root.join("disc").join("alpha.mp3"))
            .expect("track should be created");

        scan_local_library_with_database(
            &database_state.app_database,
            &root.display().to_string(),
            Some("portfolio"),
        )
        .expect("scan should succeed");

        let page = query_library_with_database(
            &database_state.app_database,
            Some(10),
            None,
            None,
            Some("title".to_owned()),
            Some("asc".to_owned()),
        )
        .expect("query should succeed");

        let payload = load_playback_track_with_database(
            &database_state.app_database,
            &playback_runtime_state,
            &page.items[0].id,
        )
        .expect("load should succeed");

        assert_eq!(payload.playback.status_label, "Ready");
        assert_eq!(
            payload.playback.track_id.as_deref(),
            Some(page.items[0].id.as_str())
        );
        assert!(payload.source.local_path.ends_with("disc/alpha.mp3"));
        assert_eq!(payload.source.extension, "mp3");

        let toggled = playback_action_with_runtime(&playback_runtime_state, "toggle");
        assert!(toggled.is_playing);
        assert_eq!(toggled.status_label, "Playing");
    }

    #[test]
    fn load_playback_track_supports_indexed_flac_files() {
        let database_state = test_database_state();
        let playback_runtime_state = PlaybackRuntimeState::default();
        let root = std::env::temp_dir().join(unique_test_suffix("resona-load-flac-playback"));

        std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
        std::fs::File::create(root.join("disc").join("alpha.flac"))
            .expect("flac track should be created");

        scan_local_library_with_database(
            &database_state.app_database,
            &root.display().to_string(),
            Some("portfolio"),
        )
        .expect("scan should succeed");

        let page = query_library_with_database(
            &database_state.app_database,
            Some(10),
            None,
            None,
            Some("title".to_owned()),
            Some("asc".to_owned()),
        )
        .expect("query should succeed");

        let payload = load_playback_track_with_database(
            &database_state.app_database,
            &playback_runtime_state,
            &page.items[0].id,
        )
        .expect("load should succeed");

        assert_eq!(payload.playback.status_label, "Ready");
        assert_eq!(payload.playback.output_owner, "rust");
        assert!(payload.source.local_path.ends_with("disc/alpha.flac"));
        assert_eq!(payload.source.extension, "flac");
    }

    #[test]
    fn playback_runtime_commands_cover_backend_owned_state_sync() {
        let database_state = test_database_state();
        let playback_runtime_state = PlaybackRuntimeState::default();
        let root = std::env::temp_dir().join(unique_test_suffix("resona-playback-sync"));

        std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
        std::fs::File::create(root.join("disc").join("alpha.mp3"))
            .expect("track should be created");

        scan_local_library_with_database(
            &database_state.app_database,
            &root.display().to_string(),
            Some("portfolio"),
        )
        .expect("scan should succeed");

        let page = query_library_with_database(
            &database_state.app_database,
            Some(10),
            None,
            None,
            Some("title".to_owned()),
            Some("asc".to_owned()),
        )
        .expect("query should succeed");

        load_playback_track_with_database(
            &database_state.app_database,
            &playback_runtime_state,
            &page.items[0].id,
        )
        .expect("load should succeed");

        let timed = sync_playback_timing_with_runtime(&playback_runtime_state, Some(33), Some(182));
        assert_eq!(timed.progress_seconds, 33);
        assert_eq!(timed.duration_seconds, 182);

        let seeked = seek_playback_with_runtime(&playback_runtime_state, 12);
        assert_eq!(seeked.progress_seconds, 12);
        assert_eq!(seeked.transport_label, "Paused");

        let failed =
            report_playback_error_with_runtime(&playback_runtime_state, Some("Playback blocked"));
        assert_eq!(failed.status_label, "Error");
        assert_eq!(failed.transport_label, "Playback blocked");

        let completed = complete_playback_with_runtime(&playback_runtime_state);
        assert_eq!(completed.status_label, "Ended");
        assert_eq!(completed.progress_seconds, 182);
    }

    #[test]
    fn native_playback_smoke_covers_launch_play_seek_pause_and_completion() {
        let database_state = test_database_state();
        let playback_runtime_state = PlaybackRuntimeState::default();
        let root = std::env::temp_dir().join(unique_test_suffix("resona-native-smoke"));

        std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
        std::fs::File::create(root.join("disc").join("alpha.mp3"))
            .expect("track should be created");

        scan_local_library_with_database(
            &database_state.app_database,
            &root.display().to_string(),
            Some("portfolio"),
        )
        .expect("scan should succeed");

        let page = query_library_with_database(
            &database_state.app_database,
            Some(10),
            None,
            None,
            Some("title".to_owned()),
            Some("asc".to_owned()),
        )
        .expect("query should succeed");

        let launched = load_playback_track_with_database(
            &database_state.app_database,
            &playback_runtime_state,
            &page.items[0].id,
        )
        .expect("load should succeed");
        assert_eq!(launched.playback.status_label, "Ready");
        assert_eq!(launched.playback.output_owner, "rust");

        let playing = playback_action_with_runtime(&playback_runtime_state, "toggle");
        assert_eq!(playing.status_label, "Playing");
        assert!(playing.is_playing);
        assert_eq!(playing.output_owner, "rust");

        let timed =
            sync_playback_timing_with_runtime(&playback_runtime_state, Some(0), Some(182));
        assert_eq!(timed.duration_seconds, 182);

        let seeked = seek_playback_with_runtime(&playback_runtime_state, 61);
        assert_eq!(seeked.progress_seconds, 61);
        assert_eq!(seeked.transport_label, "Playing");
        assert_eq!(seeked.output_owner, "rust");

        let paused = playback_action_with_runtime(&playback_runtime_state, "toggle");
        assert_eq!(paused.status_label, "Paused");
        assert!(!paused.is_playing);
        assert_eq!(paused.output_owner, "rust");

        let completed = complete_playback_with_runtime(&playback_runtime_state);
        assert_eq!(completed.status_label, "Ended");
        assert_eq!(completed.transport_label, "Ended");
        assert_eq!(completed.duration_seconds, 182);
        assert_eq!(completed.progress_seconds, 182);
        assert_eq!(completed.output_owner, "rust");
    }

    #[test]
    fn flac_smoke_covers_import_metadata_playback_and_queue_behavior() {
        let database_state = test_database_state();
        let playback_runtime_state = PlaybackRuntimeState::default();
        let root = std::env::temp_dir().join(unique_test_suffix("resona-flac-smoke"));

        std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
        std::fs::File::create(root.join("disc").join("alpha.mp3"))
            .expect("mp3 track should be created");
        write_test_flac(
            &root.join("disc").join("signal.flac"),
            Some("Signal"),
            Some("Frames"),
            Some("North"),
            true,
            Some(true),
        );

        let summary = scan_local_library_with_database(
            &database_state.app_database,
            &root.display().to_string(),
            Some("portfolio"),
        )
        .expect("scan should succeed");
        assert_eq!(summary.discovered_tracks, 2);

        let page = query_library_with_database(
            &database_state.app_database,
            Some(10),
            None,
            None,
            Some("title".to_owned()),
            Some("asc".to_owned()),
        )
        .expect("query should succeed");

        let flac_track = page
            .items
            .iter()
            .find(|item| item.relative_path.ends_with("signal.flac"))
            .expect("flac track should be indexed");
        assert_eq!(flac_track.title, "Signal");
        assert_eq!(flac_track.artist.as_deref(), Some("North"));
        assert_eq!(flac_track.album.as_deref(), Some("Frames"));
        assert_eq!(flac_track.advisory, Some(true));
        assert_eq!(flac_track.extension, "flac");
        assert!(flac_track.duration_seconds.is_some_and(|value| value > 2.9 && value < 3.1));
        assert!(flac_track.artwork_key.is_some());

        let payload = load_playback_track_with_database(
            &database_state.app_database,
            &playback_runtime_state,
            &flac_track.id,
        )
        .expect("load should succeed");
        assert_eq!(payload.playback.track_title.as_deref(), Some("Signal"));
        assert_eq!(payload.playback.track_album.as_deref(), Some("Frames"));
        assert_eq!(payload.playback.track_advisory, Some(true));
        assert_eq!(payload.source.extension, "flac");
        assert!(payload.source.local_path.ends_with("signal.flac"));

        let playing = playback_action_with_runtime(&playback_runtime_state, "toggle");
        assert_eq!(playing.status_label, "Playing");
        assert_eq!(playing.output_owner, "rust");

        let completed = complete_playback_with_runtime(&playback_runtime_state);
        assert_eq!(completed.status_label, "Ended");
        assert_eq!(completed.track_title.as_deref(), Some("Signal"));
        assert_eq!(completed.output_owner, "rust");
    }

    #[test]
    fn explicit_metadata_smoke_covers_ingest_and_playback_render_contract() {
        let database_state = test_database_state();
        let playback_runtime_state = PlaybackRuntimeState::default();
        let root = std::env::temp_dir().join(unique_test_suffix("resona-explicit-smoke"));

        std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
        write_test_mp3(
            &root.join("disc").join("alpha.mp3"),
            Some("Alpha"),
            Some("Signals"),
            Some("North"),
            Some(true),
        );
        write_test_mp3(
            &root.join("disc").join("bravo.mp3"),
            Some("Bravo"),
            Some("Horizons"),
            Some("South"),
            Some(false),
        );
        std::fs::File::create(root.join("disc").join("charlie.mp3"))
            .expect("neutral mp3 track should be created");

        let summary = scan_local_library_with_database(
            &database_state.app_database,
            &root.display().to_string(),
            Some("explicit-smoke"),
        )
        .expect("scan should succeed");
        assert_eq!(summary.discovered_tracks, 3);

        let page = query_library_with_database(
            &database_state.app_database,
            Some(10),
            None,
            None,
            Some("title".to_owned()),
            Some("asc".to_owned()),
        )
        .expect("query should succeed");

        let alpha = page
            .items
            .iter()
            .find(|item| item.title == "Alpha")
            .expect("explicit track should be indexed");
        let bravo = page
            .items
            .iter()
            .find(|item| item.title == "Bravo")
            .expect("clean track should be indexed");
        let charlie = page
            .items
            .iter()
            .find(|item| item.title == "charlie")
            .expect("neutral track should be indexed");

        assert_eq!(alpha.advisory, Some(true));
        assert_eq!(bravo.advisory, Some(false));
        assert_eq!(charlie.advisory, None);

        let payload = load_playback_track_with_database(
            &database_state.app_database,
            &playback_runtime_state,
            &alpha.id,
        )
        .expect("load should succeed");

        assert_eq!(payload.playback.track_title.as_deref(), Some("Alpha"));
        assert_eq!(payload.playback.track_artist.as_deref(), Some("North"));
        assert_eq!(payload.playback.track_album.as_deref(), Some("Signals"));
        assert_eq!(payload.playback.track_advisory, Some(true));
    }
}
