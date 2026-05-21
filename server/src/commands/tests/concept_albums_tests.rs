use super::{test_database_state, unique_test_suffix, write_test_mp3, write_test_png};
use crate::commands::{
    add_track_to_concept_album_with_database, create_concept_album_with_database,
    delete_concept_album_with_database, describe_concept_album_contract,
    get_concept_album_with_database, list_concept_albums_with_database,
    move_concept_album_entry_with_database, query_library_with_database,
    remove_concept_album_entry_with_database, replace_concept_album_entries_with_database,
    scan_local_library_with_database, update_concept_album_with_database,
};
use crate::concept_albums::ConceptAlbumEntryRecord;

#[test]
fn concept_album_contract_exposes_editable_release_boundaries() {
    let payload = describe_concept_album_contract();

    assert_eq!(payload.ordering_mode, "dense-zero-based-position");
    assert_eq!(
        payload.duplicate_policy,
        "allowed-as-distinct-sequenced-entries"
    );
    assert!(payload
        .editable_release_boundary
        .contains("app-authored release objects"));
    assert!(payload.album_reuse_rule.contains("library albums"));
    assert!(payload.playlist_reuse_rule.contains("playlist ordering"));
    assert_eq!(
        payload.planned_commands[3].name,
        "replace_concept_album_entries"
    );
}

#[test]
fn concept_album_commands_persist_metadata() {
    let database_state = test_database_state();
    let artwork_path = std::env::temp_dir().join(unique_test_suffix("resona-concept-album-cover"));
    let artwork_path = artwork_path.with_extension("png");
    write_test_png(&artwork_path);

    let created = create_concept_album_with_database(
        &database_state.app_database,
        "  Neon   Stories ",
        Some("  North "),
        Some("  midnight   sequence "),
        Some(artwork_path.to_str().expect("artwork path should be utf-8")),
    )
    .expect("concept album should create");

    assert_eq!(created.title, "Neon Stories");
    assert_eq!(created.artist.as_deref(), Some("North"));
    assert_eq!(created.description.as_deref(), Some("midnight sequence"));
    assert!(created.artwork_key.is_some());
    assert_eq!(created.entry_count, 0);

    let listed = list_concept_albums_with_database(&database_state.app_database)
        .expect("concept albums should list");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, created.id);

    let updated = update_concept_album_with_database(
        &database_state.app_database,
        &created.id,
        "Act II",
        None,
        None,
        None,
    )
    .expect("concept album should update");
    assert_eq!(updated.title, "Act II");
    assert_eq!(updated.artist, None);
    assert_eq!(updated.description, None);
    assert_eq!(updated.artwork_key, created.artwork_key);

    let loaded = get_concept_album_with_database(&database_state.app_database, &created.id)
        .expect("concept album should load")
        .expect("concept album should exist");
    assert_eq!(loaded.concept_album.title, "Act II");
    assert!(loaded.entries.is_empty());

    delete_concept_album_with_database(&database_state.app_database, &created.id)
        .expect("concept album should delete");
    assert!(
        list_concept_albums_with_database(&database_state.app_database)
            .expect("concept albums should reload")
            .is_empty()
    );
}

#[test]
fn concept_album_entry_commands_cover_add_move_remove_and_replace() {
    let database_state = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-concept-album-entry"));

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
        Some("concept-album-fixtures"),
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

    let created = create_concept_album_with_database(
        &database_state.app_database,
        "Signal Run",
        Some("North"),
        None,
        None,
    )
    .expect("concept album should create");

    let with_first = add_track_to_concept_album_with_database(
        &database_state.app_database,
        &created.id,
        &tracks.items[0].id,
    )
    .expect("first track should append");
    let with_second = add_track_to_concept_album_with_database(
        &database_state.app_database,
        &created.id,
        &tracks.items[1].id,
    )
    .expect("second track should append");

    assert_eq!(with_second.entries.len(), 2);
    assert_eq!(with_second.entries[0].title, "Alpha");
    assert_eq!(with_second.entries[1].title, "Beta");

    let moved = move_concept_album_entry_with_database(
        &database_state.app_database,
        &created.id,
        &with_second.entries[1].entry_id,
        0,
    )
    .expect("entry should move");
    assert_eq!(moved.entries[0].title, "Beta");
    assert_eq!(moved.entries[0].position, 0);
    assert_eq!(moved.entries[1].position, 1);

    let removed = remove_concept_album_entry_with_database(
        &database_state.app_database,
        &created.id,
        &moved.entries[0].entry_id,
    )
    .expect("entry should remove");
    assert_eq!(removed.entries.len(), 1);
    assert_eq!(removed.entries[0].position, 0);

    let replaced = replace_concept_album_entries_with_database(
        &database_state.app_database,
        &created.id,
        &[
            ConceptAlbumEntryRecord {
                entry_id: String::new(),
                track_id: tracks.items[1].id.clone(),
                position: 0,
            },
            ConceptAlbumEntryRecord {
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
