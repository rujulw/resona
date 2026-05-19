use crate::analytics::{
    get_top_artists, get_top_tracks, get_track_play_stats, import_spotify_history,
    import_spotify_history_folder as do_import_folder, AnalyticsWindow, SpotifyImportOptions,
    SpotifyImportResult, TopArtistEntry, TopTrackEntry, TrackPlayStats,
};
use crate::commands::{ArtistProfileImageMapState, DatabaseState};

#[tauri::command]
pub fn query_top_tracks(
    database_state: tauri::State<DatabaseState>,
    window_days: Option<u32>,
    limit: Option<usize>,
) -> Result<Vec<TopTrackEntry>, String> {
    let conn = database_state
        .app_database
        .connect()
        .map_err(|e| e.to_string())?;
    let window = window_days
        .map(AnalyticsWindow::Days)
        .unwrap_or(AnalyticsWindow::AllTime);
    get_top_tracks(&conn, window, limit.unwrap_or(50)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_top_artists(
    database_state: tauri::State<DatabaseState>,
    profile_image_map_state: tauri::State<ArtistProfileImageMapState>,
    window_days: Option<u32>,
    limit: Option<usize>,
) -> Result<Vec<TopArtistEntry>, String> {
    let conn = database_state
        .app_database
        .connect()
        .map_err(|e| e.to_string())?;
    let window = window_days
        .map(AnalyticsWindow::Days)
        .unwrap_or(AnalyticsWindow::AllTime);
    let map = profile_image_map_state
        .0
        .lock()
        .expect("artist profile image map lock");
    get_top_artists(&conn, window, limit.unwrap_or(50), &map).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_track_play_stats(
    database_state: tauri::State<DatabaseState>,
    track_id: String,
) -> Result<Option<TrackPlayStats>, String> {
    let conn = database_state
        .app_database
        .connect()
        .map_err(|e| e.to_string())?;
    get_track_play_stats(&conn, &track_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_spotify_history_file(
    database_state: tauri::State<DatabaseState>,
    json_path: String,
    min_ms_played: Option<u64>,
) -> Result<SpotifyImportResult, String> {
    let mut conn = database_state
        .app_database
        .connect()
        .map_err(|e| e.to_string())?;
    let options = SpotifyImportOptions {
        min_ms_played: min_ms_played.unwrap_or(30_000),
    };
    import_spotify_history(&mut conn, &json_path, options)
}

#[tauri::command]
pub fn import_spotify_history_folder(
    database_state: tauri::State<DatabaseState>,
    folder_path: String,
    min_ms_played: Option<u64>,
) -> Result<SpotifyImportResult, String> {
    let mut conn = database_state
        .app_database
        .connect()
        .map_err(|e| e.to_string())?;
    let options = SpotifyImportOptions {
        min_ms_played: min_ms_played.unwrap_or(30_000),
    };
    do_import_folder(&mut conn, &folder_path, options)
}
