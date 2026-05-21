use std::fs::File;
use std::io::BufReader;
use std::sync::{
    mpsc::{Receiver, RecvTimeoutError},
    Arc,
};
use std::time::Duration;

use rodio::{Decoder, OutputStream, OutputStreamBuilder, Sink};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::presence::sync_presence_with_snapshot;

use super::state::{PlaybackRuntime, PlaybackRuntimeShared};

pub const PLAYBACK_STATE_CHANGED_EVENT: &str = "playback://state-changed";

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
    pub track_artwork_key: Option<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSourcePayload {
    pub track_id: String,
    pub local_path: String,
    pub extension: String,
}

pub(super) enum NativePlaybackCommand {
    Play { path: String, position_seconds: u32 },
    Pause,
    Seek { position_seconds: u32 },
    SetVolume { level: f32 },
    Stop,
}

pub fn emit_playback_state(
    app_handle: &AppHandle,
    snapshot: &PlaybackSnapshot,
) -> Result<(), tauri::Error> {
    sync_presence_with_snapshot(snapshot);
    app_handle.emit(PLAYBACK_STATE_CHANGED_EVENT, snapshot.clone())
}

pub(super) fn native_playback_loop(
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
            Ok(NativePlaybackCommand::SetVolume { level }) => {
                if let Some((_, sink)) = &stream_and_sink {
                    sink.set_volume(level);
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
