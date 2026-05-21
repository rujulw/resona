use crate::library::ResolvedPlaybackTrack;
use crate::playback::PlaybackRuntimeState;

#[test]
fn playback_runtime_loads_track_and_toggles_play_pause() {
    let runtime = PlaybackRuntimeState::default();
    runtime.load_track(ResolvedPlaybackTrack {
        track_id: "track-1".to_owned(),
        title: "Alpha".to_owned(),
        artist: Some("North".to_owned()),
        album: Some("Signals".to_owned()),
        advisory: Some(true),
        duration_seconds: Some(182.0),
        local_path: "/tmp/alpha.mp3".to_owned(),
        extension: "mp3".to_owned(), artwork_key: None,
    });

    let playing = runtime.apply_action("toggle");
    assert!(playing.is_playing);
    assert_eq!(playing.status_label, "Playing");

    let paused = runtime.apply_action("toggle");
    assert!(!paused.is_playing);
    assert_eq!(paused.transport_label, "Paused");
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
        extension: "mp3".to_owned(), artwork_key: None,
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
