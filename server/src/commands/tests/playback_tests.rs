use super::{test_database_state, unique_test_suffix};
use crate::commands::{
    describe_playback_contract, load_playback_track_with_database, playback_action_with_runtime,
    playback_state_for_action, report_playback_error_with_runtime,
    scan_local_library_with_database, seek_playback_with_runtime,
    sync_playback_timing_with_runtime,
};
use crate::playback::PlaybackRuntimeState;

#[test]
fn playback_action_returns_expected_transport_messages() {
    let previous = playback_state_for_action("previous");
    let toggle = playback_state_for_action("toggle");
    let next = playback_state_for_action("next");

    assert_eq!(previous.transport_label, "Previous unavailable");
    assert_eq!(toggle.transport_label, "Play requested");
    assert_eq!(next.transport_label, "Next unavailable");
}

#[test]
fn playback_contract_exposes_v1_1_runtime_boundary() {
    let payload = describe_playback_contract();

    assert_eq!(
        payload.runtime_boundary,
        "tauri commands mutate playback runtime and tauri events broadcast playback snapshots"
    );
    assert_eq!(payload.commands.len(), 8);
    assert_eq!(payload.events.len(), 2);
    assert_eq!(payload.commands[0].name, "load_playback_track");
    assert_eq!(payload.commands[3].name, "sync_playback_timing");
    assert_eq!(payload.events[0].name, "playback://state-changed");
}

#[test]
fn load_playback_track_populates_runtime_snapshot() {
    let database_state = test_database_state();
    let playback_runtime_state = PlaybackRuntimeState::default();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-load-playback"));

    std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
    std::fs::File::create(root.join("disc").join("alpha.mp3")).expect("track should be created");

    scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("portfolio"),
    )
    .expect("scan should succeed");

    let page = crate::commands::query_library_with_database(
        &database_state.app_database,
        Some(10),
        None,
        None,
        Some("title".to_owned()),
        Some("asc".to_owned()),
    )
    .expect("query should succeed");

    let payload = load_playback_track_with_database(
        &database_state.app_database,
        &playback_runtime_state,
        &page.items[0].id,
    )
    .expect("load should succeed");

    assert_eq!(payload.playback.status_label, "Ready");
    assert_eq!(
        payload.playback.track_id.as_deref(),
        Some(page.items[0].id.as_str())
    );
    assert!(payload.source.local_path.ends_with("disc/alpha.mp3"));
    assert_eq!(payload.source.extension, "mp3");

    let toggled = playback_action_with_runtime(&playback_runtime_state, "toggle");
    assert!(toggled.is_playing);
    assert_eq!(toggled.status_label, "Playing");
}

#[test]
fn load_playback_track_supports_indexed_flac_files() {
    let database_state = test_database_state();
    let playback_runtime_state = PlaybackRuntimeState::default();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-load-flac-playback"));

    std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
    std::fs::File::create(root.join("disc").join("alpha.flac"))
        .expect("flac track should be created");

    scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("portfolio"),
    )
    .expect("scan should succeed");

    let page = crate::commands::query_library_with_database(
        &database_state.app_database,
        Some(10),
        None,
        None,
        Some("title".to_owned()),
        Some("asc".to_owned()),
    )
    .expect("query should succeed");

    let payload = load_playback_track_with_database(
        &database_state.app_database,
        &playback_runtime_state,
        &page.items[0].id,
    )
    .expect("load should succeed");

    assert_eq!(payload.playback.status_label, "Ready");
    assert_eq!(payload.playback.output_owner, "rust");
    assert!(payload.source.local_path.ends_with("disc/alpha.flac"));
    assert_eq!(payload.source.extension, "flac");
}

#[test]
fn playback_runtime_commands_cover_backend_owned_state_sync() {
    let database_state = test_database_state();
    let playback_runtime_state = PlaybackRuntimeState::default();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-playback-sync"));

    std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
    std::fs::File::create(root.join("disc").join("alpha.mp3")).expect("track should be created");

    scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("portfolio"),
    )
    .expect("scan should succeed");

    let page = crate::commands::query_library_with_database(
        &database_state.app_database,
        Some(10),
        None,
        None,
        Some("title".to_owned()),
        Some("asc".to_owned()),
    )
    .expect("query should succeed");

    load_playback_track_with_database(
        &database_state.app_database,
        &playback_runtime_state,
        &page.items[0].id,
    )
    .expect("load should succeed");

    let timed = sync_playback_timing_with_runtime(&playback_runtime_state, Some(33), Some(182));
    assert_eq!(timed.progress_seconds, 33);
    assert_eq!(timed.duration_seconds, 182);

    let seeked = seek_playback_with_runtime(&playback_runtime_state, 12);
    assert_eq!(seeked.progress_seconds, 12);
    assert_eq!(seeked.transport_label, "Paused");

    let failed =
        report_playback_error_with_runtime(&playback_runtime_state, Some("Playback blocked"));
    assert_eq!(failed.status_label, "Error");
    assert_eq!(failed.transport_label, "Playback blocked");

    let completed = crate::commands::complete_playback_with_runtime(&playback_runtime_state);
    assert_eq!(completed.status_label, "Ended");
    assert_eq!(completed.progress_seconds, 182);
}

#[test]
fn native_playback_smoke_covers_launch_play_seek_pause_and_completion() {
    let database_state = test_database_state();
    let playback_runtime_state = PlaybackRuntimeState::default();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-native-smoke"));

    std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
    std::fs::File::create(root.join("disc").join("alpha.mp3")).expect("track should be created");

    scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("portfolio"),
    )
    .expect("scan should succeed");

    let page = crate::commands::query_library_with_database(
        &database_state.app_database,
        Some(10),
        None,
        None,
        Some("title".to_owned()),
        Some("asc".to_owned()),
    )
    .expect("query should succeed");

    let launched = load_playback_track_with_database(
        &database_state.app_database,
        &playback_runtime_state,
        &page.items[0].id,
    )
    .expect("load should succeed");
    assert_eq!(launched.playback.status_label, "Ready");
    assert_eq!(launched.playback.output_owner, "rust");

    let playing = playback_action_with_runtime(&playback_runtime_state, "toggle");
    assert_eq!(playing.status_label, "Playing");
    assert!(playing.is_playing);
    assert_eq!(playing.output_owner, "rust");

    let timed = sync_playback_timing_with_runtime(&playback_runtime_state, Some(0), Some(182));
    assert_eq!(timed.duration_seconds, 182);

    let seeked = seek_playback_with_runtime(&playback_runtime_state, 61);
    assert_eq!(seeked.progress_seconds, 61);
    assert_eq!(seeked.transport_label, "Playing");
    assert_eq!(seeked.output_owner, "rust");

    let paused = playback_action_with_runtime(&playback_runtime_state, "toggle");
    assert_eq!(paused.status_label, "Paused");
    assert!(!paused.is_playing);
    assert_eq!(paused.output_owner, "rust");

    let completed = crate::commands::complete_playback_with_runtime(&playback_runtime_state);
    assert_eq!(completed.status_label, "Ended");
    assert_eq!(completed.transport_label, "Ended");
    assert_eq!(completed.duration_seconds, 182);
    assert_eq!(completed.progress_seconds, 182);
    assert_eq!(completed.output_owner, "rust");
}
