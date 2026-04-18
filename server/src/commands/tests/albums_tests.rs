use super::{test_database_state, unique_test_suffix, write_test_mp3};
use crate::commands::{
    get_album_with_database, list_albums_with_database, scan_local_library_with_database,
};

#[test]
fn album_commands_hydrate_browse_detail_and_track_order() {
    let database_state = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("resona-albums-command"));

    write_test_mp3(
        &root.join("north").join("alpha.mp3"),
        Some("Alpha"),
        Some("Signals"),
        Some("North"),
        Some(true),
    );
    write_test_mp3(
        &root.join("north").join("bravo.mp3"),
        Some("Bravo"),
        Some("Signals"),
        Some("North"),
        Some(false),
    );

    scan_local_library_with_database(
        &database_state.app_database,
        &root.display().to_string(),
        Some("portfolio"),
    )
    .expect("scan should succeed");

    let albums = list_albums_with_database(&database_state.app_database, Some("sig".to_owned()))
        .expect("album summaries should load");
    assert_eq!(albums.len(), 1);
    assert_eq!(albums[0].title, "Signals");
    assert_eq!(albums[0].artist.as_deref(), Some("North"));
    assert_eq!(albums[0].track_count, 2);

    let detail = get_album_with_database(&database_state.app_database, &albums[0].id)
        .expect("album detail should load")
        .expect("album detail should exist");

    assert_eq!(detail.album.id, albums[0].id);
    assert_eq!(detail.album.title, "Signals");
    assert_eq!(detail.album.artist.as_deref(), Some("North"));
    assert_eq!(detail.tracks.len(), 2);
    assert_eq!(detail.tracks[0].title, "Alpha");
    assert_eq!(detail.tracks[0].artist.as_deref(), Some("North"));
    assert_eq!(detail.tracks[1].title, "Bravo");
    assert_eq!(detail.tracks[1].artist.as_deref(), Some("North"));
}
