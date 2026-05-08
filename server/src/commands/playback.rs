use tauri::{AppHandle, State};

use super::DatabaseState;
use crate::database::AppDatabase;
use crate::library::{LocalLibraryScanner, ScanError};
use crate::playback::LoadedPlaybackTrackPayload;
use crate::playback::{
    emit_playback_state, playback_contract, AutoContinuePayload, AutoContinueResolver,
    PlaybackContract, PlaybackRuntimeState, PlaybackSnapshot,
};

#[tauri::command]
pub fn describe_playback_contract() -> PlaybackContract {
    playback_contract()
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
    .map_err(|error: ScanError| error.to_string())?;

    emit_playback_state(&app_handle, &payload.playback)
        .map_err(|error: tauri::Error| error.to_string())?;

    Ok(payload)
}

pub fn load_playback_track_with_database(
    app_database: &AppDatabase,
    playback_runtime_state: &PlaybackRuntimeState,
    track_id: &str,
) -> Result<LoadedPlaybackTrackPayload, ScanError> {
    let track = LocalLibraryScanner::new(app_database.clone())
        .resolve_playback_track(track_id)?
        .ok_or_else(|| {
            ScanError::InvalidRoot(format!(
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
    emit_playback_state(&app_handle, &snapshot).map_err(|error: tauri::Error| error.to_string())?;
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
    emit_playback_state(&app_handle, &snapshot).map_err(|error: tauri::Error| error.to_string())?;
    Ok(snapshot)
}

#[tauri::command]
pub fn seek_playback(
    app_handle: AppHandle,
    playback_runtime_state: State<'_, PlaybackRuntimeState>,
    position_seconds: u32,
) -> Result<PlaybackSnapshot, String> {
    let snapshot = playback_runtime_state.seek(position_seconds);
    emit_playback_state(&app_handle, &snapshot).map_err(|error: tauri::Error| error.to_string())?;
    Ok(snapshot)
}

#[tauri::command]
pub fn complete_playback(
    app_handle: AppHandle,
    playback_runtime_state: State<'_, PlaybackRuntimeState>,
) -> Result<PlaybackSnapshot, String> {
    let snapshot = playback_runtime_state.complete();
    emit_playback_state(&app_handle, &snapshot).map_err(|error: tauri::Error| error.to_string())?;
    Ok(snapshot)
}

#[tauri::command]
pub fn report_playback_error(
    app_handle: AppHandle,
    playback_runtime_state: State<'_, PlaybackRuntimeState>,
    transport_label: Option<String>,
) -> Result<PlaybackSnapshot, String> {
    let snapshot = playback_runtime_state.report_error(transport_label.as_deref());
    emit_playback_state(&app_handle, &snapshot).map_err(|error: tauri::Error| error.to_string())?;
    Ok(snapshot)
}

#[tauri::command]
pub fn record_play_event(
    database_state: State<'_, DatabaseState>,
    track_id: String,
) -> Result<(), String> {
    AutoContinueResolver::new(database_state.app_database.clone()).record_play_event(&track_id)
}

#[tauri::command]
pub fn resolve_auto_continue(
    database_state: State<'_, DatabaseState>,
    artist: Option<String>,
    exclude_track_ids: Vec<String>,
) -> Result<AutoContinuePayload, String> {
    AutoContinueResolver::new(database_state.app_database.clone())
        .resolve(artist.as_deref(), &exclude_track_ids)
}

#[cfg(test)]
pub fn playback_state_for_action(action: &str) -> PlaybackSnapshot {
    let runtime = PlaybackRuntimeState::default();
    runtime.apply_action(action)
}
