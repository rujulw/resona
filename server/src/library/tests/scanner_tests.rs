use std::fs;
use std::io::Write;

use crate::database::AppDatabase;
use crate::library::LocalLibraryScanner;

use super::support::{create_test_library, unique_temp_dir, write_test_mp3};

#[test]
fn persists_recursive_scan_results_into_sqlite() {
    let root = create_test_library(&["alpha.mp3", "nested/beta.flac"]);
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
fn scan_persists_artwork_key_and_writes_artwork_asset() {
    let root = unique_temp_dir();
    let track_path = root.join("art/cover-track.mp3");
    write_test_mp3(
        &track_path,
        Some("Cover Track"),
        Some("Sleeve"),
        Some("South"),
        true,
        Some(true),
    );
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database.clone());

    scanner
        .scan_path(&root, Some("Artwork Library"))
        .expect("scan should persist");

    let connection = database.connect().expect("connection should open");
    let (artwork_key, duration_seconds, advisory): (Option<String>, Option<f64>, Option<bool>) =
        connection
            .query_row(
                "SELECT artwork_key, duration_seconds, advisory FROM tracks LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("track metadata should load");

    let artwork_key = artwork_key.expect("artwork key should be stored");
    assert!(duration_seconds.is_some_and(|value| value > 0.0));
    assert_eq!(advisory, Some(true));
    assert!(database
        .app_data_dir()
        .join("artwork")
        .join(artwork_key)
        .exists());
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
