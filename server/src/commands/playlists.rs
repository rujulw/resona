use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use super::{playback::load_playback_track_with_database, DatabaseState};
use crate::database::AppDatabase;
use crate::playback::{
    emit_playback_queue, emit_playback_state, PlaybackQueueSnapshot, PlaybackRuntimeState,
    PlaybackSnapshot,
};
use crate::playlists::{
    playlist_contract, PlaylistContract, PlaylistDetail, PlaylistEntryRecord, PlaylistError,
    PlaylistStore, PlaylistSummary,
};

#[tauri::command]
pub fn describe_playlist_contract() -> PlaylistContract {
    playlist_contract()
}

#[tauri::command]
pub fn list_playlists(
    database_state: State<'_, DatabaseState>,
) -> Result<Vec<PlaylistSummary>, String> {
    list_playlists_with_database(&database_state.app_database)
        .map_err(|error: PlaylistError| error.to_string())
}

pub fn list_playlists_with_database(
    app_database: &AppDatabase,
) -> Result<Vec<PlaylistSummary>, PlaylistError> {
    PlaylistStore::new(app_database.clone()).list_playlists()
}

#[tauri::command]
pub fn get_playlist(
    database_state: State<'_, DatabaseState>,
    playlist_id: String,
) -> Result<PlaylistDetail, String> {
    get_playlist_with_database(&database_state.app_database, &playlist_id)
        .map_err(|error: PlaylistError| error.to_string())?
        .ok_or_else(|| format!("playlist {playlist_id} was not found"))
}

pub fn get_playlist_with_database(
    app_database: &AppDatabase,
    playlist_id: &str,
) -> Result<Option<PlaylistDetail>, PlaylistError> {
    PlaylistStore::new(app_database.clone()).get_playlist(playlist_id)
}

#[tauri::command]
pub fn create_playlist(
    database_state: State<'_, DatabaseState>,
    name: String,
    description: Option<String>,
    artwork_path: Option<String>,
) -> Result<PlaylistSummary, String> {
    create_playlist_with_database(
        &database_state.app_database,
        &name,
        description.as_deref(),
        artwork_path.as_deref(),
    )
    .map_err(|error: PlaylistError| error.to_string())
}

pub fn create_playlist_with_database(
    app_database: &AppDatabase,
    name: &str,
    description: Option<&str>,
    artwork_path: Option<&str>,
) -> Result<PlaylistSummary, PlaylistError> {
    PlaylistStore::new(app_database.clone()).create_playlist(name, description, artwork_path)
}

#[tauri::command]
pub fn update_playlist(
    database_state: State<'_, DatabaseState>,
    playlist_id: String,
    name: String,
    description: Option<String>,
    artwork_path: Option<String>,
) -> Result<PlaylistSummary, String> {
    update_playlist_with_database(
        &database_state.app_database,
        &playlist_id,
        &name,
        description.as_deref(),
        artwork_path.as_deref(),
    )
    .map_err(|error: PlaylistError| error.to_string())
}

pub fn update_playlist_with_database(
    app_database: &AppDatabase,
    playlist_id: &str,
    name: &str,
    description: Option<&str>,
    artwork_path: Option<&str>,
) -> Result<PlaylistSummary, PlaylistError> {
    PlaylistStore::new(app_database.clone()).update_playlist(
        playlist_id,
        name,
        description,
        artwork_path,
    )
}

#[tauri::command]
pub fn delete_playlist(
    database_state: State<'_, DatabaseState>,
    playlist_id: String,
) -> Result<(), String> {
    delete_playlist_with_database(&database_state.app_database, &playlist_id)
        .map_err(|error: PlaylistError| error.to_string())
}

pub fn delete_playlist_with_database(
    app_database: &AppDatabase,
    playlist_id: &str,
) -> Result<(), PlaylistError> {
    PlaylistStore::new(app_database.clone()).delete_playlist(playlist_id)
}

#[tauri::command]
pub fn turn_playlist_to_mixtape(
    database_state: State<'_, DatabaseState>,
    playlist_id: String,
) -> Result<PlaylistSummary, String> {
    turn_playlist_to_mixtape_with_database(&database_state.app_database, &playlist_id)
        .map_err(|error: PlaylistError| error.to_string())
}

pub fn turn_playlist_to_mixtape_with_database(
    app_database: &AppDatabase,
    playlist_id: &str,
) -> Result<PlaylistSummary, PlaylistError> {
    PlaylistStore::new(app_database.clone()).turn_to_mixtape(playlist_id)
}

#[tauri::command]
pub fn add_track_to_playlist(
    database_state: State<'_, DatabaseState>,
    playlist_id: String,
    track_id: String,
) -> Result<PlaylistDetail, String> {
    add_track_to_playlist_with_database(&database_state.app_database, &playlist_id, &track_id)
        .map_err(|error: PlaylistError| error.to_string())
}

pub fn add_track_to_playlist_with_database(
    app_database: &AppDatabase,
    playlist_id: &str,
    track_id: &str,
) -> Result<PlaylistDetail, PlaylistError> {
    PlaylistStore::new(app_database.clone()).append_track(playlist_id, track_id)
}

#[tauri::command]
pub fn remove_playlist_entry(
    database_state: State<'_, DatabaseState>,
    playlist_id: String,
    entry_id: String,
) -> Result<PlaylistDetail, String> {
    remove_playlist_entry_with_database(&database_state.app_database, &playlist_id, &entry_id)
        .map_err(|error: PlaylistError| error.to_string())
}

pub fn remove_playlist_entry_with_database(
    app_database: &AppDatabase,
    playlist_id: &str,
    entry_id: &str,
) -> Result<PlaylistDetail, PlaylistError> {
    PlaylistStore::new(app_database.clone()).remove_entry(playlist_id, entry_id)
}

#[tauri::command]
pub fn move_playlist_entry(
    database_state: State<'_, DatabaseState>,
    playlist_id: String,
    entry_id: String,
    target_position: usize,
) -> Result<PlaylistDetail, String> {
    move_playlist_entry_with_database(
        &database_state.app_database,
        &playlist_id,
        &entry_id,
        target_position,
    )
    .map_err(|error: PlaylistError| error.to_string())
}

pub fn move_playlist_entry_with_database(
    app_database: &AppDatabase,
    playlist_id: &str,
    entry_id: &str,
    target_position: usize,
) -> Result<PlaylistDetail, PlaylistError> {
    PlaylistStore::new(app_database.clone()).move_entry(playlist_id, entry_id, target_position)
}

#[tauri::command]
pub fn replace_playlist_entries(
    database_state: State<'_, DatabaseState>,
    playlist_id: String,
    entries: Vec<PlaylistEntryInput>,
) -> Result<PlaylistDetail, String> {
    let records = entries
        .into_iter()
        .map(|entry| PlaylistEntryRecord {
            entry_id: entry.entry_id.unwrap_or_default(),
            track_id: entry.track_id,
            position: entry.position,
        })
        .collect::<Vec<_>>();

    replace_playlist_entries_with_database(&database_state.app_database, &playlist_id, &records)
        .map_err(|error: PlaylistError| error.to_string())
}

pub fn replace_playlist_entries_with_database(
    app_database: &AppDatabase,
    playlist_id: &str,
    entries: &[PlaylistEntryRecord],
) -> Result<PlaylistDetail, PlaylistError> {
    PlaylistStore::new(app_database.clone()).replace_entries(playlist_id, entries)
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistEntryInput {
    pub entry_id: Option<String>,
    pub track_id: String,
    pub position: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistPlaybackHandoffPayload {
    pub playback: PlaybackSnapshot,
    pub queue: PlaybackQueueSnapshot,
    pub playlist_id: String,
    pub active_entry_id: String,
}

#[tauri::command]
pub fn handoff_playlist_to_queue(
    app_handle: AppHandle,
    database_state: State<'_, DatabaseState>,
    playback_runtime_state: State<'_, PlaybackRuntimeState>,
    playlist_id: String,
    start_entry_id: Option<String>,
) -> Result<PlaylistPlaybackHandoffPayload, String> {
    let payload = handoff_playlist_to_queue_with_database(
        &database_state.app_database,
        &playback_runtime_state,
        &playlist_id,
        start_entry_id.as_deref(),
    )
    .map_err(|error: PlaylistError| error.to_string())?;

    emit_playback_queue(&app_handle, &payload.queue)
        .map_err(|error: tauri::Error| error.to_string())?;
    emit_playback_state(&app_handle, &payload.playback)
        .map_err(|error: tauri::Error| error.to_string())?;

    Ok(payload)
}

pub fn handoff_playlist_to_queue_with_database(
    app_database: &AppDatabase,
    playback_runtime_state: &PlaybackRuntimeState,
    playlist_id: &str,
    start_entry_id: Option<&str>,
) -> Result<PlaylistPlaybackHandoffPayload, PlaylistError> {
    let handoff = PlaylistStore::new(app_database.clone())
        .build_queue_handoff(playlist_id, start_entry_id)?;
    let payload = load_playback_track_with_database(
        app_database,
        playback_runtime_state,
        &handoff.active_track_id,
    )
    .map_err(|error: crate::library::ScanError| PlaylistError::InvalidInput(error.to_string()))?;
    let queue = playback_runtime_state.replace_queue(
        handoff.track_ids,
        Some(&handoff.active_track_id),
        "playlist-handoff",
    );

    Ok(PlaylistPlaybackHandoffPayload {
        playback: payload.playback,
        queue,
        playlist_id: handoff.playlist_id,
        active_entry_id: handoff.active_entry_id,
    })
}
