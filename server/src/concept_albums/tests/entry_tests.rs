use crate::concept_albums::tests::support::{seed_track, test_database};
use crate::concept_albums::{ConceptAlbumEntryRecord, ConceptAlbumStore};

#[test]
fn concept_album_entry_operations_preserve_dense_order() {
    let database = test_database("concept-album-entries");
    let store = ConceptAlbumStore::new(database.clone());
    let alpha_track_id = seed_track(&database, "alpha", "Alpha");
    let beta_track_id = seed_track(&database, "beta", "Beta");

    let created = store
        .create_concept_album("Signal Run", Some("North"), None, None)
        .expect("concept album should create");

    let with_first = store
        .append_track(&created.id, &alpha_track_id)
        .expect("first entry should append");
    let with_second = store
        .append_track(&created.id, &beta_track_id)
        .expect("second entry should append");

    assert_eq!(with_first.entries.len(), 1);
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
                ConceptAlbumEntryRecord {
                    entry_id: String::new(),
                    track_id: beta_track_id.clone(),
                    position: 0,
                },
                ConceptAlbumEntryRecord {
                    entry_id: String::new(),
                    track_id: beta_track_id.clone(),
                    position: 1,
                },
            ],
        )
        .expect("entries should replace");

    assert_eq!(replaced.entries.len(), 2);
    assert_eq!(replaced.entries[0].track_id, beta_track_id);
    assert_eq!(replaced.entries[1].track_id, beta_track_id);
    assert_ne!(replaced.entries[0].entry_id, replaced.entries[1].entry_id);
}
