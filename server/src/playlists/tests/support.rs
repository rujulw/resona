use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::params;

use crate::database::AppDatabase;

static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn unique_test_db_path(label: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let counter = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);

    std::env::temp_dir().join(format!("resona-{label}-{nanos}-{counter}.sqlite3"))
}

pub fn test_database(label: &str) -> AppDatabase {
    AppDatabase::initialize_at(unique_test_db_path(label)).expect("test database should initialize")
}

pub fn seed_track(database: &AppDatabase, track_suffix: &str, title: &str) -> String {
    let root_id = format!("root-{track_suffix}");
    let track_id = format!("track-{track_suffix}");
    let now = "1700000000";
    let connection = database.connect().expect("database connection should open");

    connection
        .execute(
            "
            INSERT INTO library_roots (
                id, display_name, selected_path, source_mode, scan_depth,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, 'local', 'recursive', ?4, ?4)
            ",
            params![
                root_id,
                format!("Root {track_suffix}"),
                format!("/tmp/resona-{track_suffix}"),
                now
            ],
        )
        .expect("library root should insert");

    connection
        .execute(
            "
            INSERT INTO tracks (
                id, library_root_id, relative_path, file_name, extension, title,
                artist, album, file_size_bytes, imported_at, indexed_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, 'mp3', ?5, 'Artist', 'Album', 4096, ?6, ?6, ?6)
            ",
            params![
                track_id,
                root_id,
                format!("{track_suffix}.mp3"),
                format!("{track_suffix}.mp3"),
                title,
                now
            ],
        )
        .expect("track should insert");

    track_id
}

pub fn write_test_png(file_path: &Path) {
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).expect("parent directories should be created");
    }

    std::fs::write(file_path, [137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4])
        .expect("png bytes should write");
}
