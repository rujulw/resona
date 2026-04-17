use crate::playlists::PlaylistStore;

use super::support::{test_database, write_test_png};

#[test]
fn create_list_update_and_delete_playlist_round_trip_metadata() {
    let database = test_database("playlist-metadata");
    let store = PlaylistStore::new(database.clone());
    let artwork_path = std::env::temp_dir().join("resona-playlist-cover-test.png");
    write_test_png(&artwork_path);

    let created = store
        .create_playlist(
            "  Road   Trip  ",
            Some("  weekend   mix "),
            Some(artwork_path.to_str().expect("artwork path should be utf-8")),
        )
        .expect("playlist should create");

    assert_eq!(created.name, "Road Trip");
    assert_eq!(created.description.as_deref(), Some("weekend mix"));
    assert!(created.artwork_key.is_some());
    assert_eq!(created.entry_count, 0);

    let listed = store.list_playlists().expect("playlists should list");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, created.id);

    let updated = store
        .update_playlist(&created.id, "Commute", None, None)
        .expect("playlist should update");
    assert_eq!(updated.name, "Commute");
    assert_eq!(updated.description, None);
    assert_eq!(updated.artwork_key, created.artwork_key);

    let loaded = store
        .get_playlist(&created.id)
        .expect("playlist should load")
        .expect("playlist should exist");
    assert_eq!(loaded.playlist.name, "Commute");
    assert!(loaded.entries.is_empty());

    store
        .delete_playlist(&created.id)
        .expect("playlist should delete");
    assert!(store
        .list_playlists()
        .expect("playlists should reload")
        .is_empty());
}
