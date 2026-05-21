use std::sync::{mpsc::Sender, Arc, Mutex};

use serde::Serialize;
use tauri::AppHandle;

use crate::library::ResolvedPlaybackTrack;

use super::queue::{PlaybackQueue, PlaybackQueueSnapshot};
use super::transport::NativePlaybackCommand;
use super::{PlaybackSnapshot, PlaybackSourcePayload};

#[derive(Clone)]
pub struct PlaybackRuntimeState {
    shared: Arc<PlaybackRuntimeShared>,
}

pub(super) struct PlaybackRuntime {
    pub(super) active_track: Option<ActivePlaybackTrack>,
    pub(super) queue: PlaybackQueue,
    pub(super) status_label: String,
    pub(super) output_owner: String,
    pub(super) progress_seconds: u32,
    pub(super) is_playing: bool,
    pub(super) transport_label: String,
    pub(super) native_output_session: u64,
    pub(super) native_output: Option<NativePlaybackController>,
}

pub(super) struct PlaybackRuntimeShared {
    pub(super) inner: Mutex<PlaybackRuntime>,
    pub(super) app_handle: Mutex<Option<AppHandle>>,
}

#[derive(Clone, Debug)]
pub(super) struct ActivePlaybackTrack {
    pub(super) track_id: String,
    pub(super) title: String,
    pub(super) artist: Option<String>,
    pub(super) album: Option<String>,
    pub(super) advisory: Option<bool>,
    pub(super) duration_seconds: u32,
    pub(super) local_path: String,
    pub(super) extension: String,
}

pub(super) struct NativePlaybackController {
    pub(super) command_tx: Sender<NativePlaybackCommand>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LoadedPlaybackTrackPayload {
    pub playback: PlaybackSnapshot,
    pub source: PlaybackSourcePayload,
}

impl Default for PlaybackRuntimeState {
    fn default() -> Self {
        Self {
            shared: Arc::new(PlaybackRuntimeShared {
                inner: Mutex::new(PlaybackRuntime::default()),
                app_handle: Mutex::new(None),
            }),
        }
    }
}

impl Default for PlaybackRuntime {
    fn default() -> Self {
        Self {
            active_track: None,
            queue: PlaybackQueue::default(),
            status_label: "Nothing playing".to_owned(),
            output_owner: "frontend".to_owned(),
            progress_seconds: 0,
            is_playing: false,
            transport_label: "Idle".to_owned(),
            native_output_session: 0,
            native_output: None,
        }
    }
}

#[cfg(test)]
pub fn default_playback_snapshot() -> PlaybackSnapshot {
    PlaybackRuntime::default().snapshot()
}

impl PlaybackRuntimeState {
    pub fn register_app_handle(&self, app_handle: AppHandle) {
        let mut handle_slot = self
            .shared
            .app_handle
            .lock()
            .expect("playback app handle lock should not be poisoned");
        *handle_slot = Some(app_handle);
    }

    pub fn snapshot(&self) -> PlaybackSnapshot {
        let runtime = self
            .shared
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        runtime.snapshot()
    }

    pub fn load_track(&self, track: ResolvedPlaybackTrack) -> LoadedPlaybackTrackPayload {
        let mut runtime = self
            .shared
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        runtime.load_track(track)
    }

    pub fn apply_action(&self, action: &str) -> PlaybackSnapshot {
        let mut runtime = self
            .shared
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        runtime.apply_action(action, &self.shared)
    }

    pub fn sync_timing(
        &self,
        progress_seconds: Option<u32>,
        duration_seconds: Option<u32>,
    ) -> PlaybackSnapshot {
        let mut runtime = self
            .shared
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        runtime.sync_timing(progress_seconds, duration_seconds)
    }

    pub fn seek(&self, position_seconds: u32) -> PlaybackSnapshot {
        let mut runtime = self
            .shared
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        runtime.seek(position_seconds)
    }

    pub fn complete(&self) -> PlaybackSnapshot {
        let mut runtime = self
            .shared
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        runtime.complete()
    }

    pub fn report_error(&self, transport_label: Option<&str>) -> PlaybackSnapshot {
        let mut runtime = self
            .shared
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        runtime.report_error(transport_label)
    }

    #[cfg(test)]
    pub fn queue_snapshot(&self) -> PlaybackQueueSnapshot {
        let runtime = self
            .shared
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        runtime.queue_snapshot()
    }

    pub fn replace_queue(
        &self,
        track_ids: Vec<String>,
        active_track_id: Option<&str>,
        source_label: &str,
    ) -> PlaybackQueueSnapshot {
        let mut runtime = self
            .shared
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        runtime.replace_queue(track_ids, active_track_id, source_label)
    }

    pub fn mutate_queue(&self, track_id: String, mode: &str) -> PlaybackQueueSnapshot {
        let mut runtime = self
            .shared
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        match mode {
            "next" => runtime.queue.push_next(track_id),
            _ => runtime.queue.push_back(track_id),
        }
        runtime.queue_snapshot()
    }

    pub fn reorder_queue(&self, track_ids: Vec<String>) -> PlaybackQueueSnapshot {
        let mut runtime = self
            .shared
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        let active_track_id = runtime.active_track.as_ref().map(|t| t.track_id.clone());
        let source_label = runtime.queue.source_label().to_owned();
        runtime.replace_queue(track_ids, active_track_id.as_deref(), &source_label)
    }
}

impl PlaybackRuntime {
    pub(super) fn snapshot(&self) -> PlaybackSnapshot {
        match &self.active_track {
            Some(track) => PlaybackSnapshot {
                status_label: self.status_label.clone(),
                transport_label: self.transport_label.clone(),
                output_owner: self.output_owner.clone(),
                progress_seconds: self.progress_seconds,
                duration_seconds: track.duration_seconds,
                is_playing: self.is_playing,
                track_id: Some(track.track_id.clone()),
                track_title: Some(track.title.clone()),
                track_artist: track.artist.clone(),
                track_album: track.album.clone(),
                track_advisory: track.advisory,
            },
            None => PlaybackSnapshot {
                status_label: self.status_label.clone(),
                transport_label: self.transport_label.clone(),
                output_owner: self.output_owner.clone(),
                progress_seconds: 0,
                duration_seconds: 0,
                is_playing: false,
                track_id: None,
                track_title: None,
                track_artist: None,
                track_album: None,
                track_advisory: None,
            },
        }
    }

    fn load_track(&mut self, track: ResolvedPlaybackTrack) -> LoadedPlaybackTrackPayload {
        self.stop_native_output();

        let active_track = ActivePlaybackTrack {
            track_id: track.track_id.clone(),
            title: track.title,
            artist: track.artist,
            album: track.album,
            advisory: track.advisory,
            duration_seconds: track.duration_seconds.unwrap_or(0.0).round() as u32,
            local_path: track.local_path,
            extension: track.extension,
        };

        self.active_track = Some(active_track.clone());
        self.status_label = "Ready".to_owned();
        self.output_owner = "rust".to_owned();
        self.progress_seconds = 0;
        self.is_playing = false;
        self.transport_label = "Ready".to_owned();

        LoadedPlaybackTrackPayload {
            playback: self.snapshot(),
            source: PlaybackSourcePayload {
                track_id: active_track.track_id,
                extension: active_track.extension,
                local_path: active_track.local_path,
            },
        }
    }

    pub(super) fn queue_snapshot(&self) -> PlaybackQueueSnapshot {
        if self.queue.is_empty() {
            return PlaybackQueueSnapshot {
                track_ids: vec![],
                active_track_id: None,
                source_label: "manual-selection".to_owned(),
            };
        }
        let active_id = self.active_track.as_ref().map(|t| t.track_id.as_str());
        self.queue.snapshot(active_id)
    }

    fn replace_queue(
        &mut self,
        track_ids: Vec<String>,
        active_track_id: Option<&str>,
        source_label: &str,
    ) -> PlaybackQueueSnapshot {
        self.queue.replace_context(track_ids, active_track_id, source_label);
        self.queue.snapshot(active_track_id)
    }
}
