use std::sync::{mpsc, Arc};
use std::thread;

use super::state::{NativePlaybackController, PlaybackRuntime, PlaybackRuntimeShared};
use super::transport::{native_playback_loop, NativePlaybackCommand};
use super::PlaybackSnapshot;

impl PlaybackRuntime {
    pub(super) fn apply_action(
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
                    self.transport_label = "Paused".to_owned();
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
                    self.transport_label = "Playing".to_owned();
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

    pub(super) fn sync_timing(
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

    pub(super) fn seek(&mut self, position_seconds: u32) -> PlaybackSnapshot {
        let duration_seconds = self
            .active_track
            .as_ref()
            .map(|track| track.duration_seconds)
            .unwrap_or(position_seconds);
        self.progress_seconds = position_seconds.min(duration_seconds);

        if let (Some(native_output), Some(active_track)) = (&self.native_output, &self.active_track) {
            if native_output
                .command_tx
                .send(NativePlaybackCommand::Seek {
                    path: active_track.local_path.clone(),
                    position_seconds: self.progress_seconds,
                    level: self.volume_level,
                    start_paused: !self.is_playing,
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

    pub(super) fn complete(&mut self) -> PlaybackSnapshot {
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

    pub(super) fn report_error(&mut self, transport_label: Option<&str>) -> PlaybackSnapshot {
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

    pub(super) fn start_native_output(
        &mut self,
        shared: &Arc<PlaybackRuntimeShared>,
    ) -> Result<(), String> {
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
                level: self.volume_level,
                start_paused: false,
            })
            .map_err(|error| format!("Failed to start native playback: {error}"))?;

        self.native_output = Some(NativePlaybackController { command_tx });
        Ok(())
    }

    pub(super) fn stop_native_output(&mut self) {
        self.native_output_session = self.native_output_session.saturating_add(1);
        if let Some(native_output) = self.native_output.take() {
            let _ = native_output.command_tx.send(NativePlaybackCommand::Stop);
        }
    }
}
