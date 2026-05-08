mod auto_continue;
mod controls;
mod queue;
mod state;
mod transport;

#[cfg(test)]
mod tests;

use serde::Serialize;

pub use auto_continue::{AutoContinuePayload, AutoContinueResolver};
pub use queue::{emit_playback_queue, PlaybackQueueSnapshot, PLAYBACK_QUEUE_CHANGED_EVENT};
pub use state::{LoadedPlaybackTrackPayload, PlaybackRuntimeState};
pub use transport::{
    emit_playback_state, PlaybackSnapshot, PlaybackSourcePayload, PLAYBACK_STATE_CHANGED_EVENT,
};

#[cfg(test)]
pub use state::default_playback_snapshot;

#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackContract {
    pub current_owner: &'static str,
    pub migration_target: &'static str,
    pub runtime_boundary: &'static str,
    pub source_resolution_order: Vec<&'static str>,
    pub commands: Vec<PlaybackCommandContract>,
    pub events: Vec<PlaybackEventContract>,
    pub guarantees: Vec<&'static str>,
}

#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackCommandContract {
    pub name: &'static str,
    pub summary: &'static str,
    pub request_shape: &'static str,
    pub response_shape: &'static str,
    pub authority: &'static str,
}

#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackEventContract {
    pub name: &'static str,
    pub summary: &'static str,
    pub payload_shape: &'static str,
    pub delivery: &'static str,
}

pub fn playback_contract() -> PlaybackContract {
    PlaybackContract {
        current_owner: "frontend-audio-element during v1 baseline",
        migration_target: "rust playback runtime owns transport queue progress source state and native local output",
        runtime_boundary: "tauri commands mutate playback runtime and tauri events broadcast playback snapshots",
        source_resolution_order: vec!["local", "cache", "remote"],
        commands: vec![
            PlaybackCommandContract {
                name: "load_playback_track",
                summary: "Resolve a track and replace the active playback item without forcing autoplay.",
                request_shape: "{ trackId, queueTrackIds?, startPositionSeconds? }",
                response_shape: "PlaybackSnapshot",
                authority: "rust playback runtime with native local output",
            },
            PlaybackCommandContract {
                name: "playback_action",
                summary: "Apply a transport action such as play pause previous next stop or toggle.",
                request_shape: "{ action }",
                response_shape: "PlaybackSnapshot",
                authority: "rust playback runtime",
            },
            PlaybackCommandContract {
                name: "seek_playback",
                summary: "Move the active playback position to an explicit second offset.",
                request_shape: "{ positionSeconds }",
                response_shape: "PlaybackSnapshot",
                authority: "rust playback runtime",
            },
            PlaybackCommandContract {
                name: "sync_playback_timing",
                summary: "Report renderer-observed playback timing back into the backend snapshot.",
                request_shape: "{ progressSeconds?, durationSeconds? }",
                response_shape: "PlaybackSnapshot",
                authority: "rust playback runtime",
            },
            PlaybackCommandContract {
                name: "complete_playback",
                summary: "Mark the active playback item as ended when the renderer reaches the end.",
                request_shape: "{}",
                response_shape: "PlaybackSnapshot",
                authority: "rust playback runtime",
            },
            PlaybackCommandContract {
                name: "report_playback_error",
                summary: "Record a renderer playback failure without letting the shell invent its own error state.",
                request_shape: "{ transportLabel? }",
                response_shape: "PlaybackSnapshot",
                authority: "rust playback runtime",
            },
            PlaybackCommandContract {
                name: "replace_playback_queue",
                summary: "Replace the backend-owned playback queue with a deterministic ordered track list.",
                request_shape: "{ trackIds, activeTrackId? }",
                response_shape: "PlaybackQueueSnapshot",
                authority: "rust playback runtime",
            },
            PlaybackCommandContract {
                name: "get_playback_snapshot",
                summary: "Read the current backend playback state without mutating transport.",
                request_shape: "{}",
                response_shape: "PlaybackSnapshot",
                authority: "rust playback runtime",
            },
        ],
        events: vec![
            PlaybackEventContract {
                name: PLAYBACK_STATE_CHANGED_EVENT,
                summary: "Broadcasts the latest backend playback snapshot after transport or source changes.",
                payload_shape: "PlaybackSnapshot",
                delivery: "emit to all frontend listeners after each committed playback state change",
            },
            PlaybackEventContract {
                name: PLAYBACK_QUEUE_CHANGED_EVENT,
                summary: "Broadcasts queue ownership changes when the backend replaces or advances the queue.",
                payload_shape: "PlaybackQueueSnapshot",
                delivery: "emit to all frontend listeners when queue order or active index changes",
            },
        ],
        guarantees: vec![
            "queue order remains stable even when the visible tracks table is filtered or resorted",
            "playback state snapshots include track identity transport status timing and source authority",
            "frontend shell renders playback state and dispatches commands but does not own transport truth after migration",
            "local playback remains the first supported source while cache and remote inputs reuse the same command surface later",
            "native local playback output runs in rust while the shell remains a renderer controller for playback ui",
        ],
    }
}
