use tauri::{State};

use super::DatabaseState;
use crate::database::AppDatabase;
use crate::library::{
    ArtworkSource, LibraryPage, LibraryQuery, LocalLibraryScanner, PlaybackSource, ScanError,
    ScanSummary, SortDirection, TrackSortKey,
};

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
) -> Result<ScanSummary, ScanError> {
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
) -> Result<LibraryPage, ScanError> {
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
) -> Result<Option<PlaybackSource>, ScanError> {
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
) -> Result<Option<ArtworkSource>, ScanError> {
    LocalLibraryScanner::new(app_database.clone()).resolve_artwork_source(artwork_key)
}
