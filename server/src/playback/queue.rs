use std::collections::VecDeque;

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

// VecDeque for tier 0 (user queue) — push_front/push_back/pop_front are all O(1).
// Vec + cursor for tier 1 (context) — advancing is O(1) with no extra allocation.
#[derive(Debug, Default)]
pub struct PlaybackQueue {
    user_queue: VecDeque<String>,
    context_tracks: Vec<String>,
    context_cursor: usize,
    source_label: String,
}

impl PlaybackQueue {
    pub fn replace_context(
        &mut self,
        mut track_ids: Vec<String>,
        active_track_id: Option<&str>,
        source_label: &str,
    ) {
        self.user_queue.clear();
        let cursor = if let Some(id) = active_track_id {
            match track_ids.iter().position(|t| t == id) {
                Some(pos) => pos,
                None => {
                    track_ids.insert(0, id.to_owned());
                    0
                }
            }
        } else {
            0
        };
        self.context_tracks = track_ids;
        self.context_cursor = cursor;
        self.source_label = source_label.to_owned();
    }

    pub fn push_next(&mut self, track_id: String) {
        self.user_queue.push_front(track_id);
    }

    pub fn push_back(&mut self, track_id: String) {
        self.user_queue.push_back(track_id);
    }

    pub fn resolve_next(&mut self) -> Option<String> {
        if let Some(track_id) = self.user_queue.pop_front() {
            return Some(track_id);
        }
        let next = self.context_cursor + 1;
        if next < self.context_tracks.len() {
            self.context_cursor = next;
            return Some(self.context_tracks[self.context_cursor].clone());
        }
        None
    }

    pub fn active_context_track_id(&self) -> Option<&str> {
        self.context_tracks
            .get(self.context_cursor)
            .map(String::as_str)
    }

    pub fn snapshot(&self, active_track_id: Option<&str>) -> PlaybackQueueSnapshot {
        let mut track_ids: Vec<String> = self.user_queue.iter().cloned().collect();
        track_ids.extend_from_slice(&self.context_tracks);
        PlaybackQueueSnapshot {
            track_ids,
            active_track_id: active_track_id.map(ToOwned::to_owned),
            source_label: self.source_label.clone(),
        }
    }

    pub fn replace_user_queue(&mut self, track_ids: Vec<String>) {
        self.user_queue = VecDeque::from(track_ids);
        self.context_tracks.clear();
        self.context_cursor = 0;
    }

    pub fn is_empty(&self) -> bool {
        self.user_queue.is_empty() && self.context_tracks.is_empty()
    }
}
