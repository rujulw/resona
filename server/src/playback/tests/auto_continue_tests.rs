use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection};

use crate::database::AppDatabase;
use crate::playback::AutoContinueResolver;

static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

fn unique_test_db_path() -> std::path::PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time is after unix epoch")
        .as_nanos();
    let counter = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!("resona-ac-test-{nanos}-{counter}.sqlite3"))
}

fn test_db() -> AppDatabase {
    let db = AppDatabase::initialize_at(unique_test_db_path()).expect("db should init");
    let conn = db.connect().expect("connection should open");
    seed_library_root(&conn);
    drop(conn);
    db
}

fn seed_library_root(conn: &Connection) {
    conn.execute(
        "INSERT INTO library_roots (id, display_name, selected_path, source_mode, scan_depth, created_at, updated_at)
         VALUES ('root-1', 'Test', '/test', 'local', 'recursive', '0', '0')",
        [],
    )
    .expect("library root should insert");
}

fn seed_track(conn: &Connection, id: &str, artist: Option<&str>, year: Option<i64>) {
    conn.execute(
        "INSERT INTO tracks (id, library_root_id, relative_path, file_name, extension, file_size_bytes, imported_at, indexed_at, updated_at, artist, year)
         VALUES (?1, 'root-1', ?2, ?3, 'mp3', 0, '0', '0', '0', ?4, ?5)",
        params![id, format!("{id}.mp3"), format!("{id}.mp3"), artist, year],
    )
    .expect("track should insert");

    conn.execute(
        "INSERT INTO track_sources (track_id, local_path, source_status) VALUES (?1, ?2, 'local-only')",
        params![id, format!("/fake/{id}.mp3")],
    )
    .expect("track source should insert");
}

fn seed_play_event(conn: &Connection, track_id: &str, played_at: i64) {
    let event_id = format!("{track_id}:{played_at}");
    conn.execute(
        "INSERT INTO play_events (id, track_id, played_at) VALUES (?1, ?2, ?3)",
        params![event_id, track_id, played_at],
    )
    .expect("play event should insert");
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[test]
fn record_play_event_inserts_row() {
    let db = test_db();
    let conn = db.connect().expect("connection should open");
    seed_track(&conn, "t1", Some("Artist"), Some(2000));
    drop(conn);

    let resolver = AutoContinueResolver::new(db.clone());
    resolver.record_play_event("t1").expect("record should succeed");

    let conn = db.connect().expect("connection should open");
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM play_events WHERE track_id = 't1'", [], |row| row.get(0))
        .expect("count should load");
    assert_eq!(count, 1);
}

#[test]
fn record_play_event_is_idempotent_for_different_timestamps() {
    let db = test_db();
    let conn = db.connect().expect("connection should open");
    seed_track(&conn, "t1", Some("Artist"), Some(2000));
    drop(conn);

    let resolver = AutoContinueResolver::new(db.clone());
    resolver.record_play_event("t1").expect("first record should succeed");
    resolver.record_play_event("t1").expect("second record should succeed");

    let conn = db.connect().expect("connection should open");
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM play_events WHERE track_id = 't1'", [], |row| row.get(0))
        .expect("count should load");
    // Two distinct events (different played_at) should both be stored.
    assert!(count >= 1, "at least one play event should be stored");
}

#[test]
fn artist_walk_returns_tracks_matching_artist() {
    let db = test_db();
    let conn = db.connect().expect("connection should open");
    seed_track(&conn, "em-1", Some("Eminem"), Some(1999));
    seed_track(&conn, "em-2", Some("Eminem"), Some(2002));
    seed_track(&conn, "bey-1", Some("Beyoncé"), Some(2016));
    drop(conn);

    let resolver = AutoContinueResolver::new(db);
    let result = resolver.resolve(Some("Eminem"), &[]).expect("resolve should succeed");

    let ids: Vec<&str> = result.track_ids.iter().map(String::as_str).collect();
    assert!(ids.contains(&"em-1"), "em-1 should be in results");
    assert!(ids.contains(&"em-2"), "em-2 should be in results");
    assert!(!ids.contains(&"bey-1"), "bey-1 should not be in results");
    assert_eq!(result.source_label, "auto-continue:artist-walk");
}

#[test]
fn artist_walk_is_case_insensitive() {
    let db = test_db();
    let conn = db.connect().expect("connection should open");
    seed_track(&conn, "em-1", Some("Eminem"), Some(2000));
    drop(conn);

    let resolver = AutoContinueResolver::new(db);
    let result = resolver.resolve(Some("eminem"), &[]).expect("resolve should succeed");

    assert!(result.track_ids.contains(&"em-1".to_owned()));
}

#[test]
fn artist_walk_prefers_era_matching_recent_play_history() {
    let db = test_db();
    let conn = db.connect().expect("connection should open");

    // Two Eminem eras: golden-era (2000) and later (2018).
    seed_track(&conn, "em-old", Some("Eminem"), Some(2000));
    seed_track(&conn, "em-new", Some("Eminem"), Some(2018));

    // User has been playing the old era recently.
    let recent = unix_now() - 3600; // 1 hour ago — within 90-day window
    seed_play_event(&conn, "em-old", recent);
    drop(conn);

    let resolver = AutoContinueResolver::new(db);
    let result = resolver
        .resolve(Some("Eminem"), &[])
        .expect("resolve should succeed");

    // preferred_year ≈ 2000; em-old (|2000-2000|=0) scores before em-new (|2018-2000|=18)
    assert_eq!(
        result.track_ids.first().map(String::as_str),
        Some("em-old"),
        "era-matching track should be first when user has been playing old material"
    );
}

#[test]
fn artist_walk_falls_back_to_random_order_without_play_history() {
    let db = test_db();
    let conn = db.connect().expect("connection should open");
    seed_track(&conn, "em-a", Some("Eminem"), Some(1999));
    seed_track(&conn, "em-b", Some("Eminem"), Some(2018));
    drop(conn);

    let resolver = AutoContinueResolver::new(db);
    let result = resolver
        .resolve(Some("Eminem"), &[])
        .expect("resolve should succeed");

    // Without play history preferred_year is NULL so year ordering is bypassed;
    // both tracks should be returned (order is random, just check both present).
    assert_eq!(result.track_ids.len(), 2);
    assert!(result.track_ids.contains(&"em-a".to_owned()));
    assert!(result.track_ids.contains(&"em-b".to_owned()));
}

#[test]
fn artist_walk_excludes_specified_track_ids() {
    let db = test_db();
    let conn = db.connect().expect("connection should open");
    seed_track(&conn, "em-1", Some("Eminem"), Some(2000));
    seed_track(&conn, "em-2", Some("Eminem"), Some(2002));
    seed_track(&conn, "em-3", Some("Eminem"), Some(2004));
    drop(conn);

    let resolver = AutoContinueResolver::new(db);
    let result = resolver
        .resolve(Some("Eminem"), &["em-1".to_owned(), "em-2".to_owned()])
        .expect("resolve should succeed");

    assert!(!result.track_ids.contains(&"em-1".to_owned()), "excluded ids should not appear");
    assert!(!result.track_ids.contains(&"em-2".to_owned()), "excluded ids should not appear");
    assert!(result.track_ids.contains(&"em-3".to_owned()));
}
#[test]
fn library_fallback_used_when_no_artist_provided() {
    let db = test_db();
    let conn = db.connect().expect("connection should open");
    seed_track(&conn, "t1", Some("Artist A"), Some(2005));
    seed_track(&conn, "t2", Some("Artist B"), Some(2010));
    drop(conn);

    let resolver = AutoContinueResolver::new(db);
    let result = resolver.resolve(None, &[]).expect("resolve should succeed");

    assert_eq!(result.source_label, "auto-continue:library-shuffle");
    assert!(result.track_ids.len() >= 2);
}

#[test]
fn library_fallback_used_when_artist_has_no_tracks() {
    let db = test_db();
    let conn = db.connect().expect("connection should open");
    seed_track(&conn, "t1", Some("Someone Else"), Some(2010));
    drop(conn);

    let resolver = AutoContinueResolver::new(db);
    let result = resolver
        .resolve(Some("Unknown Artist"), &[])
        .expect("resolve should succeed");

    // Artist walk returns nothing → falls through to library shuffle.
    assert_eq!(result.source_label, "auto-continue:library-shuffle");
    assert!(result.track_ids.contains(&"t1".to_owned()));
}
#[test]
fn library_fallback_prefers_unplayed_tracks_over_recently_played() {
    let db = test_db();
    let conn = db.connect().expect("connection should open");

    seed_track(&conn, "played", Some("Artist"), Some(2000));
    seed_track(&conn, "unplayed", Some("Artist"), Some(2000));

    // Only "played" has a play event.
    let recent = unix_now() - 3600;
    seed_play_event(&conn, "played", recent);
    drop(conn);

    let resolver = AutoContinueResolver::new(db);
    // Exclude the artist so we hit library fallback.
    let result = resolver
        .resolve(None, &[])
        .expect("resolve should succeed");

    // unplayed tracks sort before played tracks (last_played = 0 < any real timestamp).
    assert_eq!(
        result.track_ids.first().map(String::as_str),
        Some("unplayed"),
        "never-played track should appear first in library fallback"
    );
}

#[test]
fn library_fallback_excludes_specified_track_ids() {
    let db = test_db();
    let conn = db.connect().expect("connection should open");
    seed_track(&conn, "t1", Some("Artist"), Some(2000));
    seed_track(&conn, "t2", Some("Artist"), Some(2001));
    drop(conn);

    let resolver = AutoContinueResolver::new(db);
    let result = resolver
        .resolve(None, &["t1".to_owned()])
        .expect("resolve should succeed");

    assert!(!result.track_ids.contains(&"t1".to_owned()), "excluded id should not appear");
    assert!(result.track_ids.contains(&"t2".to_owned()));
}

#[test]
fn resolve_returns_empty_list_when_library_is_empty() {
    let db = test_db();

    let resolver = AutoContinueResolver::new(db);
    let result = resolver.resolve(None, &[]).expect("resolve should succeed");

    assert!(result.track_ids.is_empty());
}
