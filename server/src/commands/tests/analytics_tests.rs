use std::collections::HashMap;

use super::{test_database_state, unique_test_suffix, write_test_mp3};
use crate::analytics::{
    get_top_artists, get_top_tracks, get_track_play_stats, import_spotify_history,
    import_spotify_history_folder, AnalyticsWindow, SpotifyImportOptions,
};
use crate::commands::{query_library_with_database, scan_local_library_with_database};

fn opts() -> SpotifyImportOptions {
    SpotifyImportOptions { min_ms_played: 30_000 }
}

/// Write a minimal Spotify GDPR streaming history JSON file.
/// `entries`: (ts, track_name, artist_name, ms_played, episode_name)
fn write_spotify_json(
    path: &std::path::Path,
    entries: &[(&str, &str, &str, u64, Option<&str>)],
) {
    let items: Vec<String> = entries
        .iter()
        .map(|(ts, track, artist, ms, ep)| {
            let ep_json = ep.map_or("null".to_owned(), |e| format!(r#""{e}""#));
            format!(
                r#"{{"ts":"{ts}","master_metadata_track_name":"{track}","master_metadata_album_artist_name":"{artist}","ms_played":{ms},"episode_name":{ep_json}}}"#
            )
        })
        .collect();
    std::fs::write(path, format!("[{}]", items.join(","))).expect("spotify json should write");
}

// ── Empty-DB baseline ────────────────────────────────────────────────────────

#[test]
fn empty_db_returns_no_top_tracks() {
    let db = test_database_state();
    let conn = db.app_database.connect().expect("connect");
    let tracks = get_top_tracks(&conn, AnalyticsWindow::AllTime, 50).expect("query");
    assert!(tracks.is_empty());
}

#[test]
fn empty_db_returns_no_top_artists() {
    let db = test_database_state();
    let conn = db.app_database.connect().expect("connect");
    let artists = get_top_artists(&conn, AnalyticsWindow::AllTime, 50, &HashMap::new())
        .expect("query");
    assert!(artists.is_empty());
}

#[test]
fn track_play_stats_returns_none_for_unknown_track() {
    let db = test_database_state();
    let conn = db.app_database.connect().expect("connect");
    let stats = get_track_play_stats(&conn, "no-such-id").expect("query");
    assert!(stats.is_none());
}

// ── Import: matching ─────────────────────────────────────────────────────────

#[test]
fn import_matches_local_track_by_normalized_title_and_artist() {
    let db = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("analytics-match"));
    std::fs::create_dir_all(&root).expect("dir");
    write_test_mp3(&root.join("alpha.mp3"), Some("Alpha"), Some("Signals"), Some("North"), None);
    scan_local_library_with_database(&db.app_database, &root.display().to_string(), Some("t"))
        .expect("scan");

    let json = root.join("history.json");
    write_spotify_json(&json, &[
        ("2024-03-01T10:00:00Z", "Alpha", "North", 180_000, None),
    ]);

    let mut conn = db.app_database.connect().expect("connect");
    let result = import_spotify_history(&mut conn, &json.display().to_string(), opts())
        .expect("import");

    assert_eq!(result.matched, 1);
    assert_eq!(result.ghost_stored, 0);
    assert_eq!(result.files_processed, 1);
}

#[test]
fn import_matches_track_despite_parenthetical_in_spotify_title() {
    let db = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("analytics-paren"));
    std::fs::create_dir_all(&root).expect("dir");
    // Local tag has clean title; Spotify has "(Remastered 2011)" suffix.
    write_test_mp3(&root.join("alpha.mp3"), Some("Stronger"), Some("Graduation"), Some("Kanye West"), None);
    scan_local_library_with_database(&db.app_database, &root.display().to_string(), Some("t"))
        .expect("scan");

    let json = root.join("history.json");
    write_spotify_json(&json, &[
        ("2024-03-01T10:00:00Z", "Stronger (Remastered 2011)", "Kanye West", 312_000, None),
    ]);

    let mut conn = db.app_database.connect().expect("connect");
    let result = import_spotify_history(&mut conn, &json.display().to_string(), opts())
        .expect("import");

    assert_eq!(result.matched, 1);
}

#[test]
fn import_matches_track_when_spotify_artist_has_featuring_suffix() {
    let db = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("analytics-feat"));
    std::fs::create_dir_all(&root).expect("dir");
    // Local artist is the primary name; Spotify album_artist includes feat.
    write_test_mp3(&root.join("alpha.mp3"), Some("Monster"), Some("MBDTF"), Some("Kanye West"), None);
    scan_local_library_with_database(&db.app_database, &root.display().to_string(), Some("t"))
        .expect("scan");

    let json = root.join("history.json");
    write_spotify_json(&json, &[
        ("2024-03-01T10:00:00Z", "Monster", "Kanye West feat. Rick Ross", 352_000, None),
    ]);

    let mut conn = db.app_database.connect().expect("connect");
    let result = import_spotify_history(&mut conn, &json.display().to_string(), opts())
        .expect("import");

    assert_eq!(result.matched, 1);
}

// ── Import: ghost plays ──────────────────────────────────────────────────────

#[test]
fn import_stores_ghost_play_when_no_local_match_exists() {
    let db = test_database_state();
    let dir = std::env::temp_dir().join(unique_test_suffix("analytics-ghost"));
    std::fs::create_dir_all(&dir).expect("dir");

    let json = dir.join("history.json");
    write_spotify_json(&json, &[
        ("2024-03-01T10:00:00Z", "Unknown Song", "Unknown Artist", 240_000, None),
    ]);

    let mut conn = db.app_database.connect().expect("connect");
    let result = import_spotify_history(&mut conn, &json.display().to_string(), opts())
        .expect("import");

    assert_eq!(result.ghost_stored, 1);
    assert_eq!(result.matched, 0);
}

#[test]
fn ghost_plays_count_toward_top_artists_for_historical_windows() {
    let db = test_database_state();
    let dir = std::env::temp_dir().join(unique_test_suffix("analytics-ghost-artist"));
    std::fs::create_dir_all(&dir).expect("dir");

    let json = dir.join("history.json");
    // Three ghost plays for "Ghost Artist" — no local tracks
    write_spotify_json(&json, &[
        ("2023-01-01T10:00:00Z", "Song A", "Ghost Artist", 200_000, None),
        ("2023-02-01T10:00:00Z", "Song B", "Ghost Artist", 200_000, None),
        ("2023-03-01T10:00:00Z", "Song C", "Ghost Artist", 200_000, None),
    ]);

    let mut conn = db.app_database.connect().expect("connect");
    import_spotify_history(&mut conn, &json.display().to_string(), opts()).expect("import");

    let conn2 = db.app_database.connect().expect("connect");
    let artists = get_top_artists(&conn2, AnalyticsWindow::AllTime, 10, &HashMap::new())
        .expect("query");

    let ghost_artist = artists.iter().find(|a| a.artist == "Ghost Artist");
    assert!(ghost_artist.is_some(), "ghost artist should appear in all-time artists");
    assert_eq!(ghost_artist.unwrap().play_count, 3);
}

// ── Import: skip conditions ──────────────────────────────────────────────────

#[test]
fn import_skips_podcast_and_video_entries() {
    let db = test_database_state();
    let dir = std::env::temp_dir().join(unique_test_suffix("analytics-podcast"));
    std::fs::create_dir_all(&dir).expect("dir");

    let json = dir.join("history.json");
    write_spotify_json(&json, &[
        ("2024-03-01T10:00:00Z", "Episode 1", "Some Podcast", 1_800_000, Some("Episode 1")),
        ("2024-03-02T10:00:00Z", "Episode 2", "Some Podcast", 1_800_000, Some("Episode 2")),
    ]);

    let mut conn = db.app_database.connect().expect("connect");
    let result = import_spotify_history(&mut conn, &json.display().to_string(), opts())
        .expect("import");

    assert_eq!(result.skipped_podcast, 2);
    assert_eq!(result.matched, 0);
    assert_eq!(result.ghost_stored, 0);
}

#[test]
fn import_skips_plays_below_minimum_ms_threshold() {
    let db = test_database_state();
    let dir = std::env::temp_dir().join(unique_test_suffix("analytics-short"));
    std::fs::create_dir_all(&dir).expect("dir");

    let json = dir.join("history.json");
    write_spotify_json(&json, &[
        ("2024-03-01T10:00:00Z", "Short Skipped", "Artist", 5_000, None),
        ("2024-03-01T11:00:00Z", "Long Kept", "Artist", 200_000, None),
    ]);

    let mut conn = db.app_database.connect().expect("connect");
    let result = import_spotify_history(&mut conn, &json.display().to_string(), opts())
        .expect("import");

    assert_eq!(result.skipped_short, 1);
    assert_eq!(result.ghost_stored, 1, "long play has no local match so becomes ghost");
}

#[test]
fn import_skips_entries_with_no_track_metadata() {
    let db = test_database_state();
    let dir = std::env::temp_dir().join(unique_test_suffix("analytics-nometa"));
    std::fs::create_dir_all(&dir).expect("dir");

    // Write raw JSON with null track metadata (can't use write_spotify_json helper)
    let json = dir.join("history.json");
    std::fs::write(
        &json,
        r#"[{"ts":"2024-03-01T10:00:00Z","master_metadata_track_name":null,"master_metadata_album_artist_name":null,"ms_played":180000,"episode_name":null}]"#,
    ).expect("write");

    let mut conn = db.app_database.connect().expect("connect");
    let result = import_spotify_history(&mut conn, &json.display().to_string(), opts())
        .expect("import");

    assert_eq!(result.skipped_no_track_metadata, 1);
}

// ── Import: deduplication ────────────────────────────────────────────────────

#[test]
fn import_is_idempotent_reimporting_same_file_twice() {
    let db = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("analytics-idempotent"));
    std::fs::create_dir_all(&root).expect("dir");
    write_test_mp3(&root.join("alpha.mp3"), Some("Alpha"), Some("Signals"), Some("North"), None);
    scan_local_library_with_database(&db.app_database, &root.display().to_string(), Some("t"))
        .expect("scan");

    let json = root.join("history.json");
    write_spotify_json(&json, &[
        ("2024-03-01T10:00:00Z", "Alpha", "North", 180_000, None),
        ("2024-03-02T10:00:00Z", "Alpha", "North", 180_000, None),
    ]);

    let mut conn = db.app_database.connect().expect("connect");
    let first = import_spotify_history(&mut conn, &json.display().to_string(), opts())
        .expect("first import");

    let mut conn2 = db.app_database.connect().expect("connect");
    let second = import_spotify_history(&mut conn2, &json.display().to_string(), opts())
        .expect("second import");

    assert_eq!(first.matched, 2);
    assert_eq!(second.matched, 0);
    assert_eq!(second.skipped_duplicate, 2, "reimport should deduplicate all entries");
}

// ── Ghost play absorption ────────────────────────────────────────────────────

#[test]
fn ghost_plays_absorbed_into_play_events_when_matching_track_is_scanned() {
    let db = test_database_state();
    let dir = std::env::temp_dir().join(unique_test_suffix("analytics-absorb"));
    std::fs::create_dir_all(&dir).expect("dir");

    // Import before the track exists locally — should create ghost play.
    let json = dir.join("history.json");
    write_spotify_json(&json, &[
        ("2024-03-01T10:00:00Z", "Alpha", "North", 180_000, None),
    ]);
    let mut conn = db.app_database.connect().expect("connect");
    let pre = import_spotify_history(&mut conn, &json.display().to_string(), opts())
        .expect("import");
    assert_eq!(pre.ghost_stored, 1);

    // Now add the matching track to the library.
    write_test_mp3(&dir.join("alpha.mp3"), Some("Alpha"), Some("Signals"), Some("North"), None);
    scan_local_library_with_database(&db.app_database, &dir.display().to_string(), Some("t"))
        .expect("scan");

    // The scanner should have absorbed the ghost into play_events.
    let page = query_library_with_database(&db.app_database, Some(10), None, None, None, None)
        .expect("query library");
    let track_id = &page.items[0].id;

    let conn2 = db.app_database.connect().expect("connect");
    let stats = get_track_play_stats(&conn2, track_id).expect("stats");
    assert!(stats.is_some(), "absorbed ghost should produce play_event");
    assert_eq!(stats.unwrap().play_count, 1);
}

// ── Folder import ────────────────────────────────────────────────────────────

#[test]
fn folder_import_processes_all_audio_files_and_skips_video() {
    let db = test_database_state();
    let dir = std::env::temp_dir().join(unique_test_suffix("analytics-folder"));
    std::fs::create_dir_all(&dir).expect("dir");

    // Two audio files with one ghost play each.
    write_spotify_json(&dir.join("Streaming_History_Audio_2023.json"), &[
        ("2023-06-01T10:00:00Z", "Song A", "Artist A", 200_000, None),
    ]);
    write_spotify_json(&dir.join("Streaming_History_Audio_2024.json"), &[
        ("2024-06-01T10:00:00Z", "Song B", "Artist B", 200_000, None),
    ]);
    // Video file — must be ignored.
    write_spotify_json(&dir.join("Streaming_History_Video_2024.json"), &[
        ("2024-06-01T12:00:00Z", "Video Title", "Video Artist", 600_000, None),
    ]);

    let mut conn = db.app_database.connect().expect("connect");
    let result = import_spotify_history_folder(
        &mut conn,
        &dir.display().to_string(),
        opts(),
    ).expect("folder import");

    assert_eq!(result.files_processed, 2, "video file must not be counted");
    assert_eq!(result.ghost_stored, 2);
}

#[test]
fn folder_import_errors_when_no_audio_files_present() {
    let db = test_database_state();
    let dir = std::env::temp_dir().join(unique_test_suffix("analytics-folder-empty"));
    std::fs::create_dir_all(&dir).expect("dir");
    // Only a video file — no audio files.
    write_spotify_json(&dir.join("Streaming_History_Video_2024.json"), &[
        ("2024-06-01T12:00:00Z", "Video", "Artist", 600_000, None),
    ]);

    let mut conn = db.app_database.connect().expect("connect");
    let result = import_spotify_history_folder(&mut conn, &dir.display().to_string(), opts());
    assert!(result.is_err(), "should error when no audio files found");
}

// ── Analytics window: 4-week source filter ───────────────────────────────────

#[test]
fn four_week_window_excludes_spotify_import_source_plays() {
    let db = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("analytics-window-src"));
    std::fs::create_dir_all(&root).expect("dir");
    write_test_mp3(&root.join("alpha.mp3"), Some("Alpha"), Some("Signals"), Some("North"), None);
    scan_local_library_with_database(&db.app_database, &root.display().to_string(), Some("t"))
        .expect("scan");

    let page = query_library_with_database(&db.app_database, Some(10), None, None, None, None)
        .expect("query");
    let track_id = &page.items[0].id;

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    // Insert one Spotify-import play and one local play, both recent.
    let conn = db.app_database.connect().expect("connect");
    conn.execute(
        "INSERT INTO play_events (id, track_id, played_at, source) VALUES (?1, ?2, ?3, 'spotify-import')",
        rusqlite::params!["pe-spotify", track_id, now_ms - 1_000],
    ).expect("insert spotify");
    conn.execute(
        "INSERT INTO play_events (id, track_id, played_at, source) VALUES (?1, ?2, ?3, 'local')",
        rusqlite::params!["pe-local", track_id, now_ms - 2_000],
    ).expect("insert local");

    // 4-week window (local-only): should see only the local play.
    let tracks_4w = get_top_tracks(&conn, AnalyticsWindow::Days(28), 50).expect("4w query");
    assert_eq!(tracks_4w.len(), 1);
    assert_eq!(tracks_4w[0].play_count, 1, "4-week should count only local plays");

    // All-time: should see both plays.
    let tracks_all = get_top_tracks(&conn, AnalyticsWindow::AllTime, 50).expect("all-time query");
    assert_eq!(tracks_all[0].play_count, 2, "all-time should count all sources");
}

#[test]
fn six_month_window_includes_spotify_import_plays() {
    let db = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("analytics-6m-src"));
    std::fs::create_dir_all(&root).expect("dir");
    write_test_mp3(&root.join("alpha.mp3"), Some("Alpha"), Some("Signals"), Some("North"), None);
    scan_local_library_with_database(&db.app_database, &root.display().to_string(), Some("t"))
        .expect("scan");

    let page = query_library_with_database(&db.app_database, Some(10), None, None, None, None)
        .expect("query");
    let track_id = &page.items[0].id;

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let conn = db.app_database.connect().expect("connect");
    conn.execute(
        "INSERT INTO play_events (id, track_id, played_at, source) VALUES (?1, ?2, ?3, 'spotify-import')",
        rusqlite::params!["pe-spotify-6m", track_id, now_ms - 1_000],
    ).expect("insert");

    let tracks = get_top_tracks(&conn, AnalyticsWindow::Days(180), 50).expect("6m query");
    assert_eq!(tracks[0].play_count, 1, "6-month window should include spotify-import plays");
}

// ── top_tracks aggregation ───────────────────────────────────────────────────

#[test]
fn top_tracks_ranks_by_play_count_descending() {
    let db = test_database_state();
    let root = std::env::temp_dir().join(unique_test_suffix("analytics-rank"));
    std::fs::create_dir_all(&root).expect("dir");
    write_test_mp3(&root.join("a.mp3"), Some("Alpha"), Some("Album"), Some("North"), None);
    write_test_mp3(&root.join("b.mp3"), Some("Bravo"), Some("Album"), Some("North"), None);
    scan_local_library_with_database(&db.app_database, &root.display().to_string(), Some("t"))
        .expect("scan");

    let page = query_library_with_database(&db.app_database, Some(10), None, None, Some("title".into()), Some("asc".into()))
        .expect("query");
    let alpha_id = &page.items[0].id; // Alpha
    let bravo_id = &page.items[1].id; // Bravo

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let conn = db.app_database.connect().expect("connect");
    // Alpha: 1 play, Bravo: 3 plays
    conn.execute(
        "INSERT INTO play_events (id, track_id, played_at, source) VALUES (?1, ?2, ?3, 'local')",
        rusqlite::params!["pe-a1", alpha_id, now_ms - 1_000],
    ).expect("insert");
    for i in 0..3 {
        conn.execute(
            "INSERT INTO play_events (id, track_id, played_at, source) VALUES (?1, ?2, ?3, 'local')",
            rusqlite::params![format!("pe-b{i}"), bravo_id, now_ms - (i as i64 + 1) * 1_000],
        ).expect("insert");
    }

    let tracks = get_top_tracks(&conn, AnalyticsWindow::AllTime, 50).expect("query");
    assert_eq!(tracks[0].title, "Bravo", "most-played track should rank first");
    assert_eq!(tracks[0].play_count, 3);
    assert_eq!(tracks[1].title, "Alpha");
    assert_eq!(tracks[1].play_count, 1);
}

// ── Migration smoke test ─────────────────────────────────────────────────────

#[test]
fn migration_chain_applies_cleanly_and_play_events_has_source_column() {
    // AppDatabase::initialize_at runs all migrations; if any fail the DB won't open.
    let db = test_database_state();
    let conn = db.app_database.connect().expect("all migrations should apply cleanly");

    // Verify migration 0013: source column exists with 'local' default.
    conn.execute(
        "INSERT INTO play_events (id, track_id, played_at) VALUES ('smoke-pe', 'no-track', 0)",
        [],
    ).unwrap_err(); // FK violation — but the column must exist for the parse to succeed
    // Verify by direct schema query instead.
    let source_col_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('play_events') WHERE name = 'source'",
            [],
            |row| row.get(0),
        )
        .expect("pragma query");
    assert_eq!(source_col_exists, 1, "play_events.source column should exist after migration 0013");

    // Verify migration 0014: spotify_ghost_plays table exists.
    let ghost_table_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='spotify_ghost_plays'",
            [],
            |row| row.get(0),
        )
        .expect("sqlite_master query");
    assert_eq!(ghost_table_exists, 1, "spotify_ghost_plays table should exist after migration 0014");
}
