use crate::playlists::{PlaylistEntryRecord, PlaylistError, PlaylistStore};

use super::support::{seed_track, test_database};

#[test]
fn entry_operations_keep_positions_dense_and_allow_duplicate_tracks() {
    let database = test_database("playlist-entries");
    let store = PlaylistStore::new(database.clone());
    let alpha_id = seed_track(&database, "alpha", "Alpha");
    let beta_id = seed_track(&database, "beta", "Beta");

    let created = store
        .create_playlist("Mix", None, None)
        .expect("playlist should create");

    let with_first = store
        .append_track(&created.id, &alpha_id)
        .expect("first track should append");
    let with_second = store
        .append_track(&created.id, &beta_id)
        .expect("second track should append");

    assert_eq!(with_second.entries.len(), 2);
    assert_eq!(with_second.entries[0].title, "Alpha");
    assert_eq!(with_second.entries[1].title, "Beta");

    let moved = store
        .move_entry(&created.id, &with_second.entries[1].entry_id, 0)
        .expect("entry should move");
    assert_eq!(moved.entries[0].title, "Beta");
    assert_eq!(moved.entries[0].position, 0);
    assert_eq!(moved.entries[1].position, 1);

    let removed = store
        .remove_entry(&created.id, &moved.entries[0].entry_id)
        .expect("entry should remove");
    assert_eq!(removed.entries.len(), 1);
    assert_eq!(removed.entries[0].position, 0);

    let replaced = store
        .replace_entries(
            &created.id,
            &[
                PlaylistEntryRecord {
                    entry_id: String::new(),
                    track_id: beta_id.clone(),
                    position: 0,
                },
                PlaylistEntryRecord {
                    entry_id: String::new(),
                    track_id: beta_id.clone(),
                    position: 1,
                },
            ],
        )
        .expect("entries should replace");

    assert_eq!(replaced.entries.len(), 2);
    assert_eq!(replaced.entries[0].track_id, beta_id);
    assert_eq!(replaced.entries[1].track_id, beta_id);
    assert_ne!(replaced.entries[0].entry_id, replaced.entries[1].entry_id);

    let _ = with_first;
}

#[test]
fn queue_handoff_uses_playlist_order_and_selected_entry() {
    let database = test_database("playlist-handoff");
    let store = PlaylistStore::new(database.clone());
    let alpha_id = seed_track(&database, "queue-alpha", "Alpha");
    let beta_id = seed_track(&database, "queue-beta", "Beta");
    let created = store
        .create_playlist("Desk Set", None, None)
        .expect("playlist should create");

    let with_first = store
        .append_track(&created.id, &alpha_id)
        .expect("first track should append");
    let with_second = store
        .append_track(&created.id, &beta_id)
        .expect("second track should append");

    let handoff = store
        .build_queue_handoff(&created.id, Some(&with_second.entries[1].entry_id))
        .expect("playlist handoff should succeed");

    assert_eq!(handoff.playlist_id, created.id);
    assert_eq!(handoff.track_ids, vec![alpha_id, beta_id.clone()]);
    assert_eq!(handoff.active_track_id, beta_id);
    assert_eq!(handoff.active_entry_id, with_second.entries[1].entry_id);

    let _ = with_first;
}

#[test]
fn replace_entries_rejects_sparse_positions() {
    let database = test_database("playlist-validation");
    let store = PlaylistStore::new(database.clone());
    let track_id = seed_track(&database, "validation-alpha", "Alpha");
    let created = store
        .create_playlist("Sparse", None, None)
        .expect("playlist should create");

    let error = store
        .replace_entries(
            &created.id,
            &[PlaylistEntryRecord {
                entry_id: String::new(),
                track_id,
                position: 1,
            }],
        )
        .expect_err("sparse positions should fail");

    assert!(matches!(error, PlaylistError::InvalidInput(_)));
    assert_eq!(
        error.to_string(),
        "playlist entry positions must be dense and zero-based"
    );
}
