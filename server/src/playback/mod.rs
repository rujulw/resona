use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

use crate::library::ResolvedPlaybackTrack;

pub const PLAYBACK_STATE_CHANGED_EVENT: &str = "playback://state-changed";
pub const PLAYBACK_QUEUE_CHANGED_EVENT: &str = "playback://queue-changed";

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSnapshot {
    pub status_label: String,
    pub transport_label: String,
    pub progress_seconds: u32,
    pub duration_seconds: u32,
    pub is_playing: bool,
    pub track_id: Option<String>,
    pub track_title: Option<String>,
    pub track_artist: Option<String>,
    pub track_album: Option<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LoadedPlaybackTrackPayload {
    pub playback: PlaybackSnapshot,
    pub source: PlaybackSourcePayload,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSourcePayload {
    pub track_id: String,
    pub local_path: String,
}

#[derive(Debug)]
pub struct PlaybackRuntimeState {
    inner: Mutex<PlaybackRuntime>,
}

#[derive(Clone, Debug)]
struct PlaybackRuntime {
    active_track: Option<ActivePlaybackTrack>,
    progress_seconds: u32,
    is_playing: bool,
    transport_label: String,
}

#[derive(Clone, Debug)]
struct ActivePlaybackTrack {
    track_id: String,
    title: String,
    artist: Option<String>,
    album: Option<String>,
    duration_seconds: u32,
    local_path: String,
}

impl Default for PlaybackRuntimeState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(PlaybackRuntime::default()),
        }
    }
}

impl Default for PlaybackRuntime {
    fn default() -> Self {
        Self {
            active_track: None,
            progress_seconds: 0,
            is_playing: false,
            transport_label: "Idle".to_owned(),
        }
    }
}

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
        migration_target: "rust playback runtime owns transport queue progress and source state",
        runtime_boundary: "tauri commands mutate playback runtime and tauri events broadcast playback snapshots",
        source_resolution_order: vec!["local", "cache", "remote"],
        commands: vec![
            PlaybackCommandContract {
                name: "load_playback_track",
                summary: "Resolve a track and replace the active playback item without forcing autoplay.",
                request_shape: "{ trackId, queueTrackIds?, startPositionSeconds? }",
                response_shape: "PlaybackSnapshot",
                authority: "rust playback runtime",
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
        ],
    }
}

#[cfg(test)]
pub fn default_playback_snapshot() -> PlaybackSnapshot {
    PlaybackRuntime::default().snapshot()
}

impl PlaybackRuntimeState {
    pub fn snapshot(&self) -> PlaybackSnapshot {
        let runtime = self
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        runtime.snapshot()
    }

    pub fn load_track(&self, track: ResolvedPlaybackTrack) -> LoadedPlaybackTrackPayload {
        let mut runtime = self
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        runtime.load_track(track)
    }

    pub fn apply_action(&self, action: &str) -> PlaybackSnapshot {
        let mut runtime = self
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        runtime.apply_action(action)
    }
}

pub fn emit_playback_state(
    app_handle: &AppHandle,
    snapshot: &PlaybackSnapshot,
) -> Result<(), tauri::Error> {
    app_handle.emit(PLAYBACK_STATE_CHANGED_EVENT, snapshot.clone())
}

impl PlaybackRuntime {
    fn snapshot(&self) -> PlaybackSnapshot {
        match &self.active_track {
            Some(track) => PlaybackSnapshot {
                status_label: if self.is_playing {
                    "Playing".to_owned()
                } else {
                    "Ready".to_owned()
                },
                transport_label: self.transport_label.clone(),
                progress_seconds: self.progress_seconds,
                duration_seconds: track.duration_seconds,
                is_playing: self.is_playing,
                track_id: Some(track.track_id.clone()),
                track_title: Some(track.title.clone()),
                track_artist: track.artist.clone(),
                track_album: track.album.clone(),
            },
            None => PlaybackSnapshot {
                status_label: "Nothing playing".to_owned(),
                transport_label: self.transport_label.clone(),
                progress_seconds: 0,
                duration_seconds: 0,
                is_playing: false,
                track_id: None,
                track_title: None,
                track_artist: None,
                track_album: None,
            },
        }
    }

    fn load_track(&mut self, track: ResolvedPlaybackTrack) -> LoadedPlaybackTrackPayload {
        let active_track = ActivePlaybackTrack {
            track_id: track.track_id.clone(),
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration_seconds: track.duration_seconds.unwrap_or(0.0).round() as u32,
            local_path: track.local_path,
        };

        self.active_track = Some(active_track.clone());
        self.progress_seconds = 0;
        self.is_playing = false;
        self.transport_label = "Ready".to_owned();

        LoadedPlaybackTrackPayload {
            playback: self.snapshot(),
            source: PlaybackSourcePayload {
                track_id: active_track.track_id,
                local_path: active_track.local_path,
            },
        }
    }

    fn apply_action(&mut self, action: &str) -> PlaybackSnapshot {
        match action {
            "toggle" => {
                if self.active_track.is_none() {
                    self.transport_label = "Play requested".to_owned();
                    return self.snapshot();
                }

                self.is_playing = !self.is_playing;
                self.transport_label = if self.is_playing {
                    "Playing".to_owned()
                } else {
                    "Paused".to_owned()
                };
                self.snapshot()
            }
            "previous" => {
                self.transport_label = "Previous unavailable".to_owned();
                self.snapshot()
            }
            "next" => {
                self.transport_label = "Next unavailable".to_owned();
                self.snapshot()
            }
            _ => self.snapshot(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        default_playback_snapshot, playback_contract, PlaybackRuntimeState,
        PLAYBACK_QUEUE_CHANGED_EVENT, PLAYBACK_STATE_CHANGED_EVENT,
    };
    use crate::library::ResolvedPlaybackTrack;

    #[test]
    fn playback_contract_lists_expected_commands_and_events() {
        let contract = playback_contract();

        assert_eq!(
            contract.migration_target,
            "rust playback runtime owns transport queue progress and source state"
        );
        assert_eq!(contract.source_resolution_order, vec!["local", "cache", "remote"]);
        assert_eq!(contract.commands[0].name, "load_playback_track");
        assert_eq!(contract.commands[1].name, "playback_action");
        assert_eq!(contract.events[0].name, PLAYBACK_STATE_CHANGED_EVENT);
        assert_eq!(contract.events[1].name, PLAYBACK_QUEUE_CHANGED_EVENT);
    }

    #[test]
    fn playback_runtime_defaults_to_idle_snapshot() {
        let snapshot = default_playback_snapshot();

        assert_eq!(snapshot.status_label, "Nothing playing");
        assert_eq!(snapshot.transport_label, "Idle");
        assert!(!snapshot.is_playing);
        assert_eq!(snapshot.track_id, None);
    }

    #[test]
    fn playback_runtime_loads_track_and_toggles_play_pause() {
        let runtime = PlaybackRuntimeState::default();
        let loaded = runtime.load_track(ResolvedPlaybackTrack {
            track_id: "track-1".to_owned(),
            title: "Alpha".to_owned(),
            artist: Some("North".to_owned()),
            album: Some("Signals".to_owned()),
            duration_seconds: Some(182.0),
            local_path: "/tmp/alpha.mp3".to_owned(),
        });

        assert_eq!(loaded.playback.status_label, "Ready");
        assert_eq!(loaded.playback.track_title.as_deref(), Some("Alpha"));
        assert_eq!(loaded.source.local_path, "/tmp/alpha.mp3");

        let playing = runtime.apply_action("toggle");
        assert!(playing.is_playing);
        assert_eq!(playing.status_label, "Playing");

        let paused = runtime.apply_action("toggle");
        assert!(!paused.is_playing);
        assert_eq!(paused.transport_label, "Paused");
    }
}
