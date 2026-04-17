use super::{test_database_state, unique_test_suffix, write_test_flac, write_test_mp3};
use crate::commands::{
    build_shell_state, load_playback_track_with_database, query_library_with_database,
    resolve_track_playback_source_with_database, scan_local_library_with_database,
};
use crate::playback::PlaybackRuntimeState;

#[test]
fn local_scan_command_persists_supported_local_audio_files() {
    let database_state = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-command-scan"));

    std::fs::create_dir_all(root.join("nested")).expect("directories should be created");
    std::fs::File::create(root.join("alpha.mp3")).expect("root mp3 should be created");
    std::fs::File::create(root.join("nested").join("beta.flac"))
        .expect("nested flac should be created");

    let summary = scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("portfolio"),
    )
    .expect("scan should succeed");

    assert_eq!(summary.discovered_tracks, 2);

    let payload = build_shell_state(&database_state.app_database);
    assert_eq!(payload.persistence.track_count, 2);
    assert_eq!(payload.persistence.library_root_count, 1);
}

#[test]
fn query_library_command_returns_paginated_results() {
    let database_state = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-query-library"));

    std::fs::create_dir_all(&root).expect("directories should be created");
    std::fs::File::create(root.join("alpha.mp3")).expect("first track should be created");
    std::fs::File::create(root.join("beta.mp3")).expect("second track should be created");

    scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("portfolio"),
    )
    .expect("scan should succeed");

    let page = query_library_with_database(
        &database_state.app_database,
        Some(1),
        None,
        None,
        Some("title".to_owned()),
        Some("asc".to_owned()),
    )
    .expect("query should succeed");

    assert_eq!(page.items.len(), 1);
    assert_eq!(page.total, 2);
    assert!(page.next_cursor.is_some());
}

#[test]
fn playback_source_command_returns_local_path_for_indexed_track() {
    let database_state = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-playback-source"));

    std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
    std::fs::File::create(root.join("disc").join("alpha.mp3")).expect("track should be created");

    scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("portfolio"),
    )
    .expect("scan should succeed");

    let page = query_library_with_database(
        &database_state.app_database,
        Some(10),
        None,
        None,
        Some("title".to_owned()),
        Some("asc".to_owned()),
    )
    .expect("query should succeed");

    let source = resolve_track_playback_source_with_database(
        &database_state.app_database,
        &page.items[0].id,
    )
    .expect("lookup should succeed")
    .expect("source should exist");

    assert_eq!(source.track_id, page.items[0].id);
    assert!(source.local_path.ends_with("disc/alpha.mp3"));
    assert_eq!(source.extension, "mp3");
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

    let page = query_library_with_database(
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

    let toggled = crate::commands::playback_action_with_runtime(&playback_runtime_state, "toggle");
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

    let page = query_library_with_database(
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
fn flac_smoke_covers_import_metadata_playback_and_queue_behavior() {
    let database_state = test_database_state();
    let playback_runtime_state = PlaybackRuntimeState::default();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-flac-smoke"));

    std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
    std::fs::File::create(root.join("disc").join("alpha.mp3"))
        .expect("mp3 track should be created");
    write_test_flac(
        &root.join("disc").join("signal.flac"),
        Some("Signal"),
        Some("Frames"),
        Some("North"),
        true,
        Some(true),
    );

    let summary = scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("portfolio"),
    )
    .expect("scan should succeed");
    assert_eq!(summary.discovered_tracks, 2);

    let page = query_library_with_database(
        &database_state.app_database,
        Some(10),
        None,
        None,
        Some("title".to_owned()),
        Some("asc".to_owned()),
    )
    .expect("query should succeed");

    let flac_track = page
        .items
        .iter()
        .find(|item| item.relative_path.ends_with("signal.flac"))
        .expect("flac track should be indexed");
    assert_eq!(flac_track.title, "Signal");
    assert_eq!(flac_track.artist.as_deref(), Some("North"));
    assert_eq!(flac_track.album.as_deref(), Some("Frames"));
    assert_eq!(flac_track.advisory, Some(true));
    assert_eq!(flac_track.extension, "flac");
    assert!(flac_track
        .duration_seconds
        .is_some_and(|value| value > 2.9 && value < 3.1));
    assert!(flac_track.artwork_key.is_some());

    let payload = load_playback_track_with_database(
        &database_state.app_database,
        &playback_runtime_state,
        &flac_track.id,
    )
    .expect("load should succeed");
    assert_eq!(payload.playback.track_title.as_deref(), Some("Signal"));
    assert_eq!(payload.playback.track_album.as_deref(), Some("Frames"));
    assert_eq!(payload.playback.track_advisory, Some(true));
    assert_eq!(payload.source.extension, "flac");
    assert!(payload.source.local_path.ends_with("signal.flac"));

    let playing = crate::commands::playback_action_with_runtime(&playback_runtime_state, "toggle");
    assert_eq!(playing.status_label, "Playing");
    assert_eq!(playing.output_owner, "rust");

    let completed = crate::commands::complete_playback_with_runtime(&playback_runtime_state);
    assert_eq!(completed.status_label, "Ended");
    assert_eq!(completed.track_title.as_deref(), Some("Signal"));
    assert_eq!(completed.output_owner, "rust");
}

#[test]
fn explicit_metadata_smoke_covers_ingest_and_playback_render_contract() {
    let database_state = test_database_state();
    let playback_runtime_state = PlaybackRuntimeState::default();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-explicit-smoke"));

    std::fs::create_dir_all(root.join("disc")).expect("directories should be created");
    write_test_mp3(
        &root.join("disc").join("alpha.mp3"),
        Some("Alpha"),
        Some("Signals"),
        Some("North"),
        Some(true),
    );
    write_test_mp3(
        &root.join("disc").join("bravo.mp3"),
        Some("Bravo"),
        Some("Horizons"),
        Some("South"),
        Some(false),
    );
    std::fs::File::create(root.join("disc").join("charlie.mp3"))
        .expect("neutral mp3 track should be created");

    let summary = scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("explicit-smoke"),
    )
    .expect("scan should succeed");
    assert_eq!(summary.discovered_tracks, 3);

    let page = query_library_with_database(
        &database_state.app_database,
        Some(10),
        None,
        None,
        Some("title".to_owned()),
        Some("asc".to_owned()),
    )
    .expect("query should succeed");

    let alpha = page
        .items
        .iter()
        .find(|item| item.title == "Alpha")
        .expect("explicit track should be indexed");
    let bravo = page
        .items
        .iter()
        .find(|item| item.title == "Bravo")
        .expect("clean track should be indexed");
    let charlie = page
        .items
        .iter()
        .find(|item| item.title == "charlie")
        .expect("neutral track should be indexed");

    assert_eq!(alpha.advisory, Some(true));
    assert_eq!(bravo.advisory, Some(false));
    assert_eq!(charlie.advisory, None);

    let payload = load_playback_track_with_database(
        &database_state.app_database,
        &playback_runtime_state,
        &alpha.id,
    )
    .expect("load should succeed");

    assert_eq!(payload.playback.track_title.as_deref(), Some("Alpha"));
    assert_eq!(payload.playback.track_artist.as_deref(), Some("North"));
    assert_eq!(payload.playback.track_album.as_deref(), Some("Signals"));
    assert_eq!(payload.playback.track_advisory, Some(true));
}
