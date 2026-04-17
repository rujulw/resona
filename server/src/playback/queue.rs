use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const PLAYBACK_QUEUE_CHANGED_EVENT: &str = "playback://queue-changed";

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackQueueSnapshot {
    pub track_ids: Vec<String>,
    pub active_track_id: Option<String>,
    pub source_label: String,
}

pub fn emit_playback_queue(
    app_handle: &AppHandle,
    snapshot: &PlaybackQueueSnapshot,
) -> Result<(), tauri::Error> {
    app_handle.emit(PLAYBACK_QUEUE_CHANGED_EVENT, snapshot.clone())
}
