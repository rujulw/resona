use crate::concept_albums::tests::support::{test_database, write_test_png};
use crate::concept_albums::ConceptAlbumStore;

#[test]
fn concept_album_metadata_persists_and_reloads() {
    let database = test_database("concept-album-metadata");
    let store = ConceptAlbumStore::new(database.clone());
    let artwork_path = std::env::temp_dir().join("resona-concept-album-cover.png");
    write_test_png(&artwork_path);

    let created = store
        .create_concept_album(
            "  Neon   Stories ",
            Some("  North  "),
            Some("  midnight   sequence "),
            Some(artwork_path.to_str().expect("path should be utf-8")),
        )
        .expect("concept album should create");

    assert_eq!(created.title, "Neon Stories");
    assert_eq!(created.artist.as_deref(), Some("North"));
    assert_eq!(created.description.as_deref(), Some("midnight sequence"));
    assert!(created.artwork_key.is_some());

    let listed = store
        .list_concept_albums()
        .expect("concept albums should list");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, created.id);

    let updated = store
        .update_concept_album(&created.id, "Act II", None, None, None)
        .expect("concept album should update");
    assert_eq!(updated.title, "Act II");
    assert_eq!(updated.artist, None);
    assert_eq!(updated.description, None);
    assert_eq!(updated.artwork_key, created.artwork_key);

    let loaded = store
        .get_concept_album(&created.id)
        .expect("concept album should load")
        .expect("concept album should exist");
    assert_eq!(loaded.concept_album.title, "Act II");
    assert!(loaded.entries.is_empty());
}
