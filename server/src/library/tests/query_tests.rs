use std::fs;
use std::io::Write;

use crate::albums::AlbumStore;
use crate::database::AppDatabase;
use crate::library::{LibraryQuery, LocalLibraryScanner, SortDirection, TrackSortKey};

use super::support::{create_test_library, unique_temp_dir, write_test_mp3};

#[test]
fn query_library_filters_tracks_by_search_term() {
    let root = create_test_library(&[
        "ambient/alpha-drift.mp3",
        "ambient/bravo-signal.mp3",
        "field/charlie-mist.mp3",
    ]);
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    scanner
        .scan_path(&root, Some("Search Library"))
        .expect("scan should persist");

    let page = scanner
        .query_library(&LibraryQuery {
            page_size: 20,
            cursor: None,
            search: Some("bravo".to_owned()),
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        })
        .expect("query should succeed");

    assert_eq!(page.total, 1);
    assert_eq!(page.items.len(), 1);
    assert!(page.items[0].title.to_lowercase().contains("bravo"));
}

#[test]
fn query_library_supports_cursor_pagination_across_pages() {
    let root = create_test_library(&["disc/a-track.mp3", "disc/b-track.mp3", "disc/c-track.mp3"]);
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    scanner
        .scan_path(&root, Some("Paged Library"))
        .expect("scan should persist");

    let first_page = scanner
        .query_library(&LibraryQuery {
            page_size: 2,
            cursor: None,
            search: None,
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        })
        .expect("first page should load");

    assert_eq!(first_page.items.len(), 2);
    assert!(first_page.next_cursor.is_some());

    let second_page = scanner
        .query_library(&LibraryQuery {
            page_size: 2,
            cursor: first_page.next_cursor.clone(),
            search: None,
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        })
        .expect("second page should load");

    assert_eq!(second_page.total, 3);
    assert_eq!(second_page.items.len(), 1);
    assert!(second_page.next_cursor.is_none());
    assert_ne!(first_page.items[0].id, second_page.items[0].id);
    assert_ne!(first_page.items[1].id, second_page.items[0].id);
}

#[test]
fn query_library_supports_descending_sort() {
    let root = create_test_library(&["disc/a-track.mp3", "disc/b-track.mp3", "disc/c-track.mp3"]);
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    scanner
        .scan_path(&root, Some("Sorted Library"))
        .expect("scan should persist");

    let page = scanner
        .query_library(&LibraryQuery {
            page_size: 10,
            cursor: None,
            search: None,
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Desc,
        })
        .expect("query should succeed");

    assert_eq!(page.items.len(), 3);
    let titles = page
        .items
        .iter()
        .map(|item| item.title.clone())
        .collect::<Vec<_>>();
    let mut expected = titles.clone();
    expected.sort_by(|left, right| right.cmp(left));
    assert_eq!(titles, expected);
}

#[test]
fn query_library_searches_album_and_artist_metadata() {
    let root = unique_temp_dir();
    write_test_mp3(
        &root.join("north/alpha.mp3"),
        Some("Alpha"),
        Some("Night Drive"),
        Some("North"),
        false,
        Some(true),
    );
    write_test_mp3(
        &root.join("south/bravo.mp3"),
        Some("Bravo"),
        Some("Daylight"),
        Some("South"),
        false,
        Some(false),
    );
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    scanner
        .scan_path(&root, Some("Metadata Library"))
        .expect("scan should persist");

    let artist_page = scanner
        .query_library(&LibraryQuery {
            page_size: 10,
            cursor: None,
            search: Some("south".to_owned()),
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        })
        .expect("artist search should succeed");
    let album_page = scanner
        .query_library(&LibraryQuery {
            page_size: 10,
            cursor: None,
            search: Some("night".to_owned()),
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        })
        .expect("album search should succeed");

    assert_eq!(artist_page.total, 1);
    assert_eq!(artist_page.items[0].title, "Bravo");
    assert_eq!(artist_page.items[0].advisory, Some(false));
    assert_eq!(album_page.total, 1);
    assert_eq!(album_page.items[0].title, "Alpha");
    assert_eq!(album_page.items[0].advisory, Some(true));
}

#[test]
fn query_library_reflects_rescan_changes_in_results() {
    let root = create_test_library(&["disc/alpha.mp3", "disc/bravo.mp3"]);
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    scanner
        .scan_path(&root, Some("Rescan Library"))
        .expect("first scan should persist");

    fs::remove_file(root.join("disc/alpha.mp3")).expect("alpha should be removed");
    let mut replacement =
        fs::File::create(root.join("disc/charlie.mp3")).expect("charlie should be created");
    replacement
        .write_all(b"replacement payload")
        .expect("charlie should be writable");

    scanner
        .scan_path(&root, Some("Rescan Library"))
        .expect("second scan should persist");

    let page = scanner
        .query_library(&LibraryQuery {
            page_size: 10,
            cursor: None,
            search: None,
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        })
        .expect("query should succeed");

    let titles = page
        .items
        .iter()
        .map(|item| item.title.clone())
        .collect::<Vec<_>>();

    assert_eq!(page.total, 2);
    assert_eq!(titles, vec!["bravo".to_owned(), "charlie".to_owned()]);
    assert!(!titles.iter().any(|title| title == "alpha"));
}

#[test]
fn album_queries_group_release_rows_and_hydrate_track_order() {
    let root = unique_temp_dir();
    write_test_mp3(
        &root.join("north/disc1/alpha.mp3"),
        Some("Alpha"),
        Some("Signals"),
        Some("North"),
        false,
        Some(true),
    );
    write_test_mp3(
        &root.join("north/disc1/bravo.mp3"),
        Some("Bravo"),
        Some("Signals"),
        Some("North"),
        false,
        Some(false),
    );
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database.clone());
    let album_store = AlbumStore::new(database);

    scanner
        .scan_path(&root, Some("Album Library"))
        .expect("scan should persist");

    let albums = album_store
        .list_albums(Some("sig"))
        .expect("album summaries should load");
    assert_eq!(albums.len(), 1);
    assert_eq!(albums[0].title, "Signals");
    assert_eq!(albums[0].artist.as_deref(), Some("North"));
    assert_eq!(albums[0].track_count, 2);

    let detail = album_store
        .get_album(&albums[0].id)
        .expect("album detail should load")
        .expect("album detail should exist");
    assert_eq!(detail.album.title, "Signals");
    assert_eq!(detail.tracks.len(), 2);
    assert_eq!(detail.tracks[0].title, "Alpha");
    assert_eq!(detail.tracks[1].title, "Bravo");
}
