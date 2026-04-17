use super::{test_database_state, unique_test_suffix, write_test_mp3, write_test_png};
use crate::commands::{
    add_track_to_playlist_with_database, create_playlist_with_database,
    delete_playlist_with_database, describe_playlist_contract, get_playlist_with_database,
    handoff_playlist_to_queue_with_database, list_playlists_with_database,
    move_playlist_entry_with_database, query_library_with_database,
    remove_playlist_entry_with_database, replace_playlist_entries_with_database,
    scan_local_library_with_database, update_playlist_with_database,
};
use crate::playback::PlaybackRuntimeState;
use crate::playlists::PlaylistEntryRecord;

#[test]
fn playlist_contract_exposes_local_ordering_and_queue_handoff_boundary() {
    let payload = describe_playlist_contract();

    assert_eq!(payload.ordering_mode, "dense-zero-based-position");
    assert_eq!(payload.duplicate_policy, "allowed-as-distinct-entries");
    assert_eq!(
        payload.queue_handoff.mode,
        "replace-backend-queue-from-playlist-order"
    );
    assert_eq!(payload.planned_commands.len(), 4);
    assert_eq!(payload.planned_commands[2].name, "replace_playlist_entries");
    assert!(payload.planned_commands[2]
        .summary
        .contains("full-order replacement"));
    assert!(payload
        .queue_handoff
        .queue_order_rule
        .contains("drag targets"));
}

#[test]
fn playlist_crud_commands_persist_metadata() {
    let database_state = test_database_state();
    let artwork_path = std::env::temp_dir().join(unique_test_suffix("resona-playlist-cover"));
    let artwork_path = artwork_path.with_extension("png");
    write_test_png(&artwork_path);

    let created = create_playlist_with_database(
        &database_state.app_database,
        "  Road   Trip  ",
        Some("  weekend   mix "),
        Some(artwork_path.to_str().expect("artwork path should be utf-8")),
    )
    .expect("playlist should create");

    assert_eq!(created.name, "Road Trip");
    assert_eq!(created.description.as_deref(), Some("weekend mix"));
    assert!(created.artwork_key.is_some());
    assert_eq!(created.entry_count, 0);

    let listed =
        list_playlists_with_database(&database_state.app_database).expect("playlists should list");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, created.id);

    let updated = update_playlist_with_database(
        &database_state.app_database,
        &created.id,
        "Commute",
        None,
        None,
    )
    .expect("playlist should update");
    assert_eq!(updated.name, "Commute");
    assert_eq!(updated.description, None);
    assert_eq!(updated.artwork_key, created.artwork_key);

    let loaded = get_playlist_with_database(&database_state.app_database, &created.id)
        .expect("playlist should load")
        .expect("playlist should exist");
    assert_eq!(loaded.playlist.name, "Commute");
    assert!(loaded.entries.is_empty());

    delete_playlist_with_database(&database_state.app_database, &created.id)
        .expect("playlist should delete");
    assert!(list_playlists_with_database(&database_state.app_database)
        .expect("playlists should reload")
        .is_empty());
}

#[test]
fn playlist_entry_commands_cover_add_move_remove_and_replace() {
    let database_state = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-playlist-entry"));

    write_test_mp3(
        &root.join("alpha.mp3"),
        Some("Alpha"),
        Some("Set A"),
        Some("A"),
        None,
    );
    write_test_mp3(
        &root.join("beta.mp3"),
        Some("Beta"),
        Some("Set B"),
        Some("B"),
        None,
    );

    scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("playlist-fixtures"),
    )
    .expect("scan should succeed");

    let tracks = query_library_with_database(
        &database_state.app_database,
        Some(10),
        None,
        None,
        Some("title".to_owned()),
        Some("asc".to_owned()),
    )
    .expect("tracks should query");

    let created = create_playlist_with_database(&database_state.app_database, "Mix", None, None)
        .expect("playlist should create");

    let with_first = add_track_to_playlist_with_database(
        &database_state.app_database,
        &created.id,
        &tracks.items[0].id,
    )
    .expect("first track should append");
    let with_second = add_track_to_playlist_with_database(
        &database_state.app_database,
        &created.id,
        &tracks.items[1].id,
    )
    .expect("second track should append");

    assert_eq!(with_second.entries.len(), 2);
    assert_eq!(with_second.entries[0].title, "Alpha");
    assert_eq!(with_second.entries[1].title, "Beta");

    let moved = move_playlist_entry_with_database(
        &database_state.app_database,
        &created.id,
        &with_second.entries[1].entry_id,
        0,
    )
    .expect("entry should move");
    assert_eq!(moved.entries[0].title, "Beta");
    assert_eq!(moved.entries[0].position, 0);
    assert_eq!(moved.entries[1].position, 1);

    let removed = remove_playlist_entry_with_database(
        &database_state.app_database,
        &created.id,
        &moved.entries[0].entry_id,
    )
    .expect("entry should remove");
    assert_eq!(removed.entries.len(), 1);
    assert_eq!(removed.entries[0].position, 0);

    let replaced = replace_playlist_entries_with_database(
        &database_state.app_database,
        &created.id,
        &[
            PlaylistEntryRecord {
                entry_id: String::new(),
                track_id: tracks.items[1].id.clone(),
                position: 0,
            },
            PlaylistEntryRecord {
                entry_id: String::new(),
                track_id: tracks.items[1].id.clone(),
                position: 1,
            },
        ],
    )
    .expect("entries should replace");

    assert_eq!(replaced.entries.len(), 2);
    assert_eq!(replaced.entries[0].track_id, tracks.items[1].id);
    assert_eq!(replaced.entries[1].track_id, tracks.items[1].id);
    assert_ne!(replaced.entries[0].entry_id, replaced.entries[1].entry_id);

    let _ = with_first;
}

#[test]
fn playlist_handoff_replaces_queue_from_playlist_order() {
    let database_state = test_database_state();
    let playback_runtime = PlaybackRuntimeState::default();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-playlist-handoff"));

    write_test_mp3(
        &root.join("alpha.mp3"),
        Some("Alpha"),
        Some("Set A"),
        Some("A"),
        None,
    );
    write_test_mp3(
        &root.join("beta.mp3"),
        Some("Beta"),
        Some("Set B"),
        Some("B"),
        None,
    );

    scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("playlist-handoff"),
    )
    .expect("scan should succeed");

    let tracks = query_library_with_database(
        &database_state.app_database,
        Some(10),
        None,
        None,
        Some("title".to_owned()),
        Some("asc".to_owned()),
    )
    .expect("tracks should query");

    let created =
        create_playlist_with_database(&database_state.app_database, "Desk Set", None, None)
            .expect("playlist should create");
    let with_first = add_track_to_playlist_with_database(
        &database_state.app_database,
        &created.id,
        &tracks.items[0].id,
    )
    .expect("first track should append");
    let with_second = add_track_to_playlist_with_database(
        &database_state.app_database,
        &created.id,
        &tracks.items[1].id,
    )
    .expect("second track should append");

    let handoff = handoff_playlist_to_queue_with_database(
        &database_state.app_database,
        &playback_runtime,
        &created.id,
        Some(&with_second.entries[1].entry_id),
    )
    .expect("playlist handoff should succeed");

    assert_eq!(
        handoff.playback.track_id.as_deref(),
        Some(tracks.items[1].id.as_str())
    );
    assert_eq!(handoff.queue.track_ids.len(), 2);
    assert_eq!(handoff.queue.track_ids[0], tracks.items[0].id);
    assert_eq!(handoff.queue.track_ids[1], tracks.items[1].id);
    assert_eq!(
        handoff.queue.active_track_id.as_deref(),
        Some(tracks.items[1].id.as_str())
    );
    assert_eq!(handoff.queue.source_label, "playlist-handoff");
    assert_eq!(playback_runtime.queue_snapshot().track_ids.len(), 2);

    let _ = with_first;
}

#[test]
fn playlist_reorder_does_not_mutate_an_existing_handoff_queue_snapshot() {
    let database_state = test_database_state();
    let playback_runtime = PlaybackRuntimeState::default();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-playlist-handoff-stability"));

    write_test_mp3(
        &root.join("alpha.mp3"),
        Some("Alpha"),
        Some("Set A"),
        Some("A"),
        None,
    );
    write_test_mp3(
        &root.join("beta.mp3"),
        Some("Beta"),
        Some("Set B"),
        Some("B"),
        None,
    );

    scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("playlist-handoff-stability"),
    )
    .expect("scan should succeed");

    let tracks = query_library_with_database(
        &database_state.app_database,
        Some(10),
        None,
        None,
        Some("title".to_owned()),
        Some("asc".to_owned()),
    )
    .expect("tracks should query");

    let created =
        create_playlist_with_database(&database_state.app_database, "Desk Set", None, None)
            .expect("playlist should create");
    let with_first = add_track_to_playlist_with_database(
        &database_state.app_database,
        &created.id,
        &tracks.items[0].id,
    )
    .expect("first track should append");
    let with_second = add_track_to_playlist_with_database(
        &database_state.app_database,
        &created.id,
        &tracks.items[1].id,
    )
    .expect("second track should append");

    let initial_handoff = handoff_playlist_to_queue_with_database(
        &database_state.app_database,
        &playback_runtime,
        &created.id,
        Some(&with_second.entries[1].entry_id),
    )
    .expect("playlist handoff should succeed");
    assert_eq!(
        initial_handoff.queue.track_ids,
        vec![tracks.items[0].id.clone(), tracks.items[1].id.clone()]
    );

    let reordered = replace_playlist_entries_with_database(
        &database_state.app_database,
        &created.id,
        &[
            PlaylistEntryRecord {
                entry_id: with_second.entries[1].entry_id.clone(),
                track_id: tracks.items[1].id.clone(),
                position: 0,
            },
            PlaylistEntryRecord {
                entry_id: with_first.entries[0].entry_id.clone(),
                track_id: tracks.items[0].id.clone(),
                position: 1,
            },
        ],
    )
    .expect("entries should replace");

    assert_eq!(reordered.entries[0].track_id, tracks.items[1].id);
    assert_eq!(reordered.entries[1].track_id, tracks.items[0].id);

    let queue_snapshot = playback_runtime.queue_snapshot();
    assert_eq!(
        queue_snapshot.track_ids,
        vec![tracks.items[0].id.clone(), tracks.items[1].id.clone()]
    );
    assert_eq!(
        queue_snapshot.active_track_id.as_deref(),
        Some(tracks.items[1].id.as_str())
    );

    let reordered_handoff = handoff_playlist_to_queue_with_database(
        &database_state.app_database,
        &playback_runtime,
        &created.id,
        Some(&reordered.entries[0].entry_id),
    )
    .expect("reordered playlist handoff should succeed");
    assert_eq!(
        reordered_handoff.queue.track_ids,
        vec![tracks.items[1].id.clone(), tracks.items[0].id.clone()]
    );
    assert_eq!(
        reordered_handoff.queue.active_track_id.as_deref(),
        Some(tracks.items[1].id.as_str())
    );
}
