use rodio::{Decoder, OutputStream, OutputStreamBuilder, Sink};
use serde::Serialize;
use std::fs::File;
use std::io::BufReader;
use std::sync::{
    mpsc::{self, Receiver, RecvTimeoutError, Sender},
    Arc, Mutex,
};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::library::ResolvedPlaybackTrack;
use crate::presence::sync_presence_with_snapshot;

pub const PLAYBACK_STATE_CHANGED_EVENT: &str = "playback://state-changed";
pub const PLAYBACK_QUEUE_CHANGED_EVENT: &str = "playback://queue-changed";

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSnapshot {
    pub status_label: String,
    pub transport_label: String,
    pub output_owner: String,
    pub progress_seconds: u32,
    pub duration_seconds: u32,
    pub is_playing: bool,
    pub track_id: Option<String>,
    pub track_title: Option<String>,
    pub track_artist: Option<String>,
    pub track_album: Option<String>,
    pub track_advisory: Option<bool>,
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
    pub extension: String,
}

#[derive(Clone)]
pub struct PlaybackRuntimeState {
    shared: Arc<PlaybackRuntimeShared>,
}

struct PlaybackRuntime {
    active_track: Option<ActivePlaybackTrack>,
    status_label: String,
    output_owner: String,
    progress_seconds: u32,
    is_playing: bool,
    transport_label: String,
    native_output_session: u64,
    native_output: Option<NativePlaybackController>,
}

struct PlaybackRuntimeShared {
    inner: Mutex<PlaybackRuntime>,
    app_handle: Mutex<Option<AppHandle>>,
}

#[derive(Clone, Debug)]
struct ActivePlaybackTrack {
    track_id: String,
    title: String,
    artist: Option<String>,
    album: Option<String>,
    advisory: Option<bool>,
    duration_seconds: u32,
    local_path: String,
    extension: String,
}

struct NativePlaybackController {
    command_tx: Sender<NativePlaybackCommand>,
}

enum NativePlaybackCommand {
    Play { path: String, position_seconds: u32 },
    Pause,
    Seek { position_seconds: u32 },
    Stop,
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
}

pub fn emit_playback_state(
    app_handle: &AppHandle,
    snapshot: &PlaybackSnapshot,
) -> Result<(), tauri::Error> {
    sync_presence_with_snapshot(snapshot);
    app_handle.emit(PLAYBACK_STATE_CHANGED_EVENT, snapshot.clone())
}

impl PlaybackRuntime {
    fn snapshot(&self) -> PlaybackSnapshot {
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

    fn apply_action(
        &mut self,
        action: &str,
        shared: &Arc<PlaybackRuntimeShared>,
    ) -> PlaybackSnapshot {
        match action {
            "toggle" => {
                if self.active_track.is_none() {
                    self.status_label = "Nothing playing".to_owned();
                    self.transport_label = "Play requested".to_owned();
                    return self.snapshot();
                }

                if self.is_playing {
                    if let Some(native_output) = &self.native_output {
                        let _ = native_output.command_tx.send(NativePlaybackCommand::Pause);
                    }
                    self.is_playing = false;
                    self.status_label = "Paused".to_owned();
                    self.transport_label = "Paused".to_owned()
                } else {
                    if let Some(active_track) = &self.active_track {
                        if self.progress_seconds >= active_track.duration_seconds {
                            self.progress_seconds = 0;
                        }
                    }

                    if let Err(error) = self.start_native_output(shared) {
                        return self.report_error(Some(error.as_str()));
                    }

                    self.is_playing = true;
                    self.status_label = "Playing".to_owned();
                    self.transport_label = "Playing".to_owned()
                }
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

    fn sync_timing(
        &mut self,
        progress_seconds: Option<u32>,
        duration_seconds: Option<u32>,
    ) -> PlaybackSnapshot {
        if let Some(progress_seconds) = progress_seconds {
            self.progress_seconds = progress_seconds;
        }

        if let (Some(duration_seconds), Some(active_track)) =
            (duration_seconds, self.active_track.as_mut())
        {
            active_track.duration_seconds = duration_seconds;
        }

        self.snapshot()
    }

    fn seek(&mut self, position_seconds: u32) -> PlaybackSnapshot {
        let duration_seconds = self
            .active_track
            .as_ref()
            .map(|track| track.duration_seconds)
            .unwrap_or(position_seconds);
        self.progress_seconds = position_seconds.min(duration_seconds);

        if let Some(native_output) = &self.native_output {
            if native_output
                .command_tx
                .send(NativePlaybackCommand::Seek {
                    position_seconds: self.progress_seconds,
                })
                .is_err()
            {
                return self.report_error(Some("Seek unavailable"));
            }
        }

        if self.is_playing {
            self.status_label = "Playing".to_owned();
            self.transport_label = "Playing".to_owned();
        } else if self.active_track.is_some() {
            self.status_label = "Paused".to_owned();
            self.transport_label = "Paused".to_owned();
        }
        self.snapshot()
    }

    fn complete(&mut self) -> PlaybackSnapshot {
        if let Some(duration_seconds) = self
            .active_track
            .as_ref()
            .map(|track| track.duration_seconds)
        {
            self.stop_native_output();
            self.progress_seconds = duration_seconds;
            self.is_playing = false;
            self.status_label = "Ended".to_owned();
            self.transport_label = "Ended".to_owned();
        }
        self.snapshot()
    }

    fn report_error(&mut self, transport_label: Option<&str>) -> PlaybackSnapshot {
        self.stop_native_output();
        if self.active_track.is_some() {
            self.is_playing = false;
            self.status_label = "Error".to_owned();
            self.transport_label = transport_label.unwrap_or("Playback error").to_owned();
        } else {
            self.status_label = "Nothing playing".to_owned();
            self.transport_label = transport_label.unwrap_or("Playback error").to_owned();
        }
        self.snapshot()
    }

    fn start_native_output(&mut self, shared: &Arc<PlaybackRuntimeShared>) -> Result<(), String> {
        let active_track = self
            .active_track
            .as_ref()
            .cloned()
            .ok_or_else(|| "No active track loaded".to_owned())?;

        self.stop_native_output();
        let session_id = self.native_output_session;
        let (command_tx, command_rx) = mpsc::channel();
        let shared = Arc::clone(shared);
        let initial_position = self.progress_seconds;
        thread::Builder::new()
            .name("resona-native-playback".to_owned())
            .spawn(move || native_playback_loop(shared, command_rx, session_id))
            .map_err(|error| format!("Failed to launch native playback thread: {error}"))?;

        command_tx
            .send(NativePlaybackCommand::Play {
                path: active_track.local_path.clone(),
                position_seconds: initial_position,
            })
            .map_err(|error| format!("Failed to start native playback: {error}"))?;

        self.native_output = Some(NativePlaybackController { command_tx });
        Ok(())
    }

    fn stop_native_output(&mut self) {
        self.native_output_session = self.native_output_session.saturating_add(1);
        if let Some(native_output) = self.native_output.take() {
            let _ = native_output.command_tx.send(NativePlaybackCommand::Stop);
        }
    }
}

fn native_playback_loop(
    shared: Arc<PlaybackRuntimeShared>,
    command_rx: Receiver<NativePlaybackCommand>,
    session_id: u64,
) {
    let mut stream_and_sink: Option<(OutputStream, Sink)> = None;
    let mut last_position_seconds = 0;

    loop {
        match command_rx.recv_timeout(Duration::from_millis(250)) {
            Ok(NativePlaybackCommand::Play {
                path,
                position_seconds,
            }) => match build_native_sink(&path, position_seconds) {
                Ok((stream, sink)) => {
                    last_position_seconds = position_seconds;
                    stream_and_sink = Some((stream, sink));
                    publish_native_snapshot(&shared, session_id, |runtime| {
                        runtime.progress_seconds = position_seconds;
                        runtime.is_playing = true;
                        runtime.status_label = "Playing".to_owned();
                        runtime.transport_label = "Playing".to_owned();
                        Some(runtime.snapshot())
                    });
                }
                Err(error) => {
                    publish_native_snapshot(&shared, session_id, |runtime| {
                        runtime.native_output = None;
                        runtime.is_playing = false;
                        runtime.status_label = "Error".to_owned();
                        runtime.transport_label = error;
                        Some(runtime.snapshot())
                    });
                    break;
                }
            },
            Ok(NativePlaybackCommand::Pause) => {
                if let Some((_, sink)) = &stream_and_sink {
                    sink.pause();
                }
            }
            Ok(NativePlaybackCommand::Seek { position_seconds }) => {
                if let Some((_, sink)) = &stream_and_sink {
                    let _ = sink.try_seek(Duration::from_secs(position_seconds as u64));
                    last_position_seconds = position_seconds;
                }
            }
            Ok(NativePlaybackCommand::Stop) => {
                if let Some((_, sink)) = stream_and_sink.take() {
                    sink.stop();
                }
                break;
            }
            Err(RecvTimeoutError::Disconnected) => break,
            Err(RecvTimeoutError::Timeout) => {}
        }

        if let Some((_, sink)) = &stream_and_sink {
            let position_seconds = sink.get_pos().as_secs() as u32;
            if position_seconds != last_position_seconds {
                last_position_seconds = position_seconds;
                publish_native_snapshot(&shared, session_id, |runtime| {
                    let duration_seconds = runtime
                        .active_track
                        .as_ref()
                        .map(|track| track.duration_seconds)
                        .unwrap_or(position_seconds);
                    runtime.progress_seconds = position_seconds.min(duration_seconds);
                    Some(runtime.snapshot())
                });
            }

            if sink.empty() {
                publish_native_snapshot(&shared, session_id, |runtime| {
                    let duration_seconds = runtime
                        .active_track
                        .as_ref()
                        .map(|track| track.duration_seconds)
                        .unwrap_or(runtime.progress_seconds);
                    runtime.native_output = None;
                    runtime.progress_seconds = duration_seconds;
                    runtime.is_playing = false;
                    runtime.status_label = "Ended".to_owned();
                    runtime.transport_label = "Ended".to_owned();
                    Some(runtime.snapshot())
                });
                break;
            }
        }
    }
}

fn build_native_sink(path: &str, position_seconds: u32) -> Result<(OutputStream, Sink), String> {
    let stream = OutputStreamBuilder::open_default_stream()
        .map_err(|error| format!("Failed to open native output stream: {error}"))?;
    let sink = Sink::connect_new(stream.mixer());
    let file = BufReader::new(
        File::open(path).map_err(|error| format!("Failed to open local playback file: {error}"))?,
    );
    let source = Decoder::try_from(file)
        .map_err(|error| format!("Failed to decode local playback file: {error}"))?;

    sink.append(source);
    if position_seconds > 0 {
        sink.try_seek(Duration::from_secs(position_seconds as u64))
            .map_err(|error| format!("Failed to seek native output: {error}"))?;
    }
    sink.play();
    Ok((stream, sink))
}

fn publish_native_snapshot<F>(shared: &Arc<PlaybackRuntimeShared>, session_id: u64, mutate: F)
where
    F: FnOnce(&mut PlaybackRuntime) -> Option<PlaybackSnapshot>,
{
    let snapshot = {
        let mut runtime = shared
            .inner
            .lock()
            .expect("playback runtime lock should not be poisoned");
        if runtime.native_output_session != session_id {
            return;
        }
        mutate(&mut runtime)
    };

    let Some(snapshot) = snapshot else {
        return;
    };

    let app_handle = {
        let handle_slot = shared
            .app_handle
            .lock()
            .expect("playback app handle lock should not be poisoned");
        handle_slot.clone()
    };

    if let Some(app_handle) = app_handle {
        let _ = emit_playback_state(&app_handle, &snapshot);
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
            "rust playback runtime owns transport queue progress source state and native local output"
        );
        assert_eq!(
            contract.source_resolution_order,
            vec!["local", "cache", "remote"]
        );
        assert_eq!(contract.commands[0].name, "load_playback_track");
        assert_eq!(contract.commands[1].name, "playback_action");
        assert_eq!(contract.commands[2].name, "seek_playback");
        assert_eq!(contract.commands[3].name, "sync_playback_timing");
        assert_eq!(contract.events[0].name, PLAYBACK_STATE_CHANGED_EVENT);
        assert_eq!(contract.events[1].name, PLAYBACK_QUEUE_CHANGED_EVENT);
    }

    #[test]
    fn playback_runtime_defaults_to_idle_snapshot() {
        let snapshot = default_playback_snapshot();

        assert_eq!(snapshot.status_label, "Nothing playing");
        assert_eq!(snapshot.transport_label, "Idle");
        assert_eq!(snapshot.output_owner, "frontend");
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
            advisory: Some(true),
            duration_seconds: Some(182.0),
            local_path: "/tmp/alpha.mp3".to_owned(),
            extension: "mp3".to_owned(),
        });

        assert_eq!(loaded.playback.status_label, "Ready");
        assert_eq!(loaded.playback.output_owner, "rust");
        assert_eq!(loaded.playback.track_title.as_deref(), Some("Alpha"));
        assert_eq!(loaded.playback.track_advisory, Some(true));
        assert_eq!(loaded.source.local_path, "/tmp/alpha.mp3");
        assert_eq!(loaded.source.extension, "mp3");

        let playing = runtime.apply_action("toggle");
        assert!(playing.is_playing);
        assert_eq!(playing.status_label, "Playing");

        let paused = runtime.apply_action("toggle");
        assert!(!paused.is_playing);
        assert_eq!(paused.transport_label, "Paused");
    }

    #[test]
    fn playback_runtime_accepts_flac_tracks_through_native_output_path() {
        let runtime = PlaybackRuntimeState::default();
        let loaded = runtime.load_track(ResolvedPlaybackTrack {
            track_id: "track-flac".to_owned(),
            title: "Signal".to_owned(),
            artist: Some("North".to_owned()),
            album: Some("Frames".to_owned()),
            advisory: Some(false),
            duration_seconds: Some(192.0),
            local_path: "/tmp/signal.flac".to_owned(),
            extension: "flac".to_owned(),
        });

        assert_eq!(loaded.playback.status_label, "Ready");
        assert_eq!(loaded.playback.output_owner, "rust");
        assert_eq!(loaded.playback.track_title.as_deref(), Some("Signal"));
        assert_eq!(loaded.source.local_path, "/tmp/signal.flac");
        assert_eq!(loaded.source.extension, "flac");

        let snapshot = runtime.snapshot();
        assert_eq!(snapshot.track_id.as_deref(), Some("track-flac"));
        assert_eq!(snapshot.track_advisory, Some(false));
        assert_eq!(snapshot.duration_seconds, 192);
        assert_eq!(snapshot.output_owner, "rust");
    }

    #[test]
    fn playback_runtime_syncs_timing_seek_completion_and_errors() {
        let runtime = PlaybackRuntimeState::default();
        runtime.load_track(ResolvedPlaybackTrack {
            track_id: "track-1".to_owned(),
            title: "Alpha".to_owned(),
            artist: Some("North".to_owned()),
            album: Some("Signals".to_owned()),
            advisory: None,
            duration_seconds: Some(182.0),
            local_path: "/tmp/alpha.mp3".to_owned(),
            extension: "mp3".to_owned(),
        });

        let timed = runtime.sync_timing(Some(41), Some(200));
        assert_eq!(timed.progress_seconds, 41);
        assert_eq!(timed.duration_seconds, 200);

        let seeked = runtime.seek(12);
        assert_eq!(seeked.progress_seconds, 12);
        assert_eq!(seeked.status_label, "Paused");

        runtime.apply_action("toggle");
        let failed = runtime.report_error(Some("Playback blocked"));
        assert_eq!(failed.status_label, "Error");
        assert_eq!(failed.transport_label, "Playback blocked");
        assert!(!failed.is_playing);

        let completed = runtime.complete();
        assert_eq!(completed.status_label, "Ended");
        assert_eq!(completed.transport_label, "Ended");
        assert_eq!(completed.progress_seconds, 200);
    }
}
