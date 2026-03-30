use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::database::AppDatabase;

use super::normalization::{discover_mp3_files, normalize_track};
use super::{LibraryQuery, LocalLibraryScanner, SortDirection, TrackSortKey};

static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

fn unique_temp_dir() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let counter = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!("resona-scan-test-{nanos}-{counter}"))
}

fn create_test_library(paths: &[&str]) -> PathBuf {
    let root = unique_temp_dir();

    for relative_path in paths {
        let file_path = root.join(relative_path);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).expect("parent directories should be created");
        }

        let mut file = fs::File::create(&file_path).expect("test mp3 should be created");
        file.write_all(relative_path.as_bytes())
            .expect("test mp3 should be writable");
    }

    root
}

#[test]
fn discovers_nested_mp3_files_only() {
    let root = unique_temp_dir();
    let nested = root.join("disc-one");
    fs::create_dir_all(&nested).expect("directories should be created");
    fs::File::create(root.join("track-a.mp3")).expect("mp3 file should be created");
    fs::File::create(nested.join("track-b.MP3")).expect("mp3 file should be created");
    fs::File::create(root.join("cover.jpg")).expect("non-mp3 file should be created");

    let discovered = discover_mp3_files(&root).expect("scan should succeed");

    assert_eq!(discovered.len(), 2);
}

#[test]
fn normalizes_track_with_filename_fallback() {
    let root = unique_temp_dir();
    fs::create_dir_all(&root).expect("root should be created");
    let file_path = root.join("My   Track.mp3");
    fs::File::create(&file_path).expect("mp3 file should be created");

    let track = normalize_track(&root, &file_path, "library-root").expect("track should normalize");

    assert_eq!(track.relative_path, "My   Track.mp3");
    assert_eq!(track.title, "My Track");
    assert_eq!(track.extension, "mp3");
}

#[test]
fn persists_recursive_scan_results_into_sqlite() {
    let root = create_test_library(&["alpha.mp3", "nested/beta.mp3"]);
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    let summary = scanner
        .scan_path(&root, Some("Test Library"))
        .expect("scan should persist");

    assert_eq!(summary.discovered_tracks, 2);
    assert_eq!(summary.inserted_tracks, 2);
    assert_eq!(summary.updated_tracks, 0);

    let persisted = scanner.library_summary().expect("summary should load");
    assert_eq!(persisted.library_roots, 1);
    assert_eq!(persisted.tracks, 2);
}

#[test]
fn rescanning_updates_inserted_updated_and_removed_counts() {
    let root = create_test_library(&["alpha.mp3", "nested/beta.mp3"]);
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    let first = scanner
        .scan_path(&root, Some("Test Library"))
        .expect("first scan should persist");
    assert_eq!(first.inserted_tracks, 2);
    assert_eq!(first.updated_tracks, 0);
    assert_eq!(first.removed_tracks, 0);

    fs::remove_file(root.join("alpha.mp3")).expect("alpha should be removed");
    let mut replacement =
        fs::File::create(root.join("nested/gamma.mp3")).expect("gamma should be created");
    replacement
        .write_all(b"replacement payload")
        .expect("gamma should be writable");

    let second = scanner
        .scan_path(&root, Some("Test Library"))
        .expect("second scan should persist");

    assert_eq!(second.discovered_tracks, 2);
    assert_eq!(second.inserted_tracks, 1);
    assert_eq!(second.updated_tracks, 1);
    assert_eq!(second.removed_tracks, 1);

    let persisted = scanner.library_summary().expect("summary should load");
    assert_eq!(persisted.tracks, 2);
}

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
