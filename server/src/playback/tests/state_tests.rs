use crate::library::ResolvedPlaybackTrack;
use crate::playback::{default_playback_snapshot, PlaybackRuntimeState};

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
