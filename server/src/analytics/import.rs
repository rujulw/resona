use std::collections::HashMap;
use std::io::BufReader;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

// Actual field names from Spotify GDPR extended streaming history export.
#[derive(Clone, Debug, Deserialize)]
pub struct SpotifyStreamEntry {
    pub ts: String,
    pub master_metadata_track_name: Option<String>,
    pub master_metadata_album_artist_name: Option<String>,
    pub ms_played: u64,
    // Non-null for podcast and video episodes — used to filter them out.
    pub episode_name: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyImportResult {
    pub files_processed: usize,
    pub matched: usize,
    pub ghost_stored: usize,
    pub skipped_short: usize,
    pub skipped_podcast: usize,
    pub skipped_no_track_metadata: usize,
    pub skipped_duplicate: usize,
}

impl SpotifyImportResult {
    fn merge(&mut self, other: SpotifyImportResult) {
        self.files_processed += other.files_processed;
        self.matched += other.matched;
        self.ghost_stored += other.ghost_stored;
        self.skipped_short += other.skipped_short;
        self.skipped_podcast += other.skipped_podcast;
        self.skipped_no_track_metadata += other.skipped_no_track_metadata;
        self.skipped_duplicate += other.skipped_duplicate;
    }
}

#[derive(Clone, Debug)]
pub struct SpotifyImportOptions {
    pub min_ms_played: u64,
}

impl Default for SpotifyImportOptions {
    fn default() -> Self {
        Self {
            min_ms_played: 30_000,
        }
    }
}

/// Import all `Streaming_History_Audio_*.json` files found in `dir_path`.
/// Files are processed in filename order (chronological across years).
/// Video files (`Streaming_History_Video_*.json`) are skipped at the folder level.
pub fn import_spotify_history_folder(
    conn: &mut Connection,
    dir_path: &str,
    options: SpotifyImportOptions,
) -> Result<SpotifyImportResult, String> {
    let dir = std::path::Path::new(dir_path);
    let mut audio_files: Vec<std::path::PathBuf> = std::fs::read_dir(dir)
        .map_err(|e| format!("Cannot read folder: {e}"))?
        .flatten()
        .filter_map(|e| {
            let path = e.path();
            if !path.is_file() {
                return None;
            }
            let name = path.file_name()?.to_str()?.to_lowercase();
            if name.starts_with("streaming_history_audio") && name.ends_with(".json") {
                Some(path)
            } else {
                None
            }
        })
        .collect();

    if audio_files.is_empty() {
        return Err(format!(
            "No Streaming_History_Audio_*.json files found in the selected folder"
        ));
    }

    // Process chronologically (2023 before 2024 etc.) so duplicate detection is stable.
    audio_files.sort();

    let mut aggregated = SpotifyImportResult::default();
    for file_path in &audio_files {
        let path_str = file_path
            .to_str()
            .ok_or_else(|| "File path is not valid UTF-8".to_string())?;
        let result = import_spotify_history(conn, path_str, options.clone())?;
        aggregated.merge(result);
    }

    Ok(aggregated)
}

pub fn import_spotify_history(
    conn: &mut Connection,
    json_path: &str,
    options: SpotifyImportOptions,
) -> Result<SpotifyImportResult, String> {
    let file = std::fs::File::open(json_path)
        .map_err(|e| format!("Failed to open Spotify export file: {e}"))?;
    // Stream-parse via BufReader — avoids loading the whole file as a String.
    let reader = BufReader::new(file);
    let entries: Vec<SpotifyStreamEntry> = serde_json::from_reader(reader)
        .map_err(|e| format!("Failed to parse Spotify export JSON: {e}"))?;

    // Build normalized (title, artist) → track_id map once for O(1) per-entry lookup.
    let local_track_map = build_local_track_map(conn)?;
    let mut result = SpotifyImportResult {
        files_processed: 1,
        ..Default::default()
    };
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to open transaction: {e}"))?;

    for entry in &entries {
        // Podcasts and video episodes have a non-null episode_name — skip them entirely.
        if entry.episode_name.is_some() {
            result.skipped_podcast += 1;
            continue;
        }

        if entry.ms_played < options.min_ms_played {
            result.skipped_short += 1;
            continue;
        }

        let (Some(track_name), Some(artist_name)) = (
            entry.master_metadata_track_name.as_deref(),
            entry.master_metadata_album_artist_name.as_deref(),
        ) else {
            result.skipped_no_track_metadata += 1;
            continue;
        };

        let played_at = parse_spotify_ts(&entry.ts);
        let norm_title = normalize(track_name);
        let norm_artist = normalize(artist_name);

        // Exact key lookup first; fall back to prefix-match scan only when needed.
        let matched_id = local_track_map
            .get(&(norm_title.clone(), norm_artist.clone()))
            .or_else(|| {
                local_track_map
                    .keys()
                    .find(|(t, a)| {
                        *t == norm_title
                            && (a.starts_with(norm_artist.as_str())
                                || norm_artist.starts_with(a.as_str()))
                    })
                    .and_then(|k| local_track_map.get(k))
            });

        if let Some(track_id) = matched_id {
            let duplicate: bool = tx
                .query_row(
                    "SELECT EXISTS(
                       SELECT 1 FROM play_events
                       WHERE track_id = ?1
                         AND ABS(played_at - ?2) <= 60000
                         AND source = 'spotify-import'
                     )",
                    rusqlite::params![track_id, played_at],
                    |row| row.get(0),
                )
                .unwrap_or(false);

            if duplicate {
                result.skipped_duplicate += 1;
                continue;
            }

            let id = format!("spotify-{}-{}", track_id, played_at);
            tx.execute(
                "INSERT OR IGNORE INTO play_events (id, track_id, played_at, source, ms_played)
                 VALUES (?1, ?2, ?3, 'spotify-import', ?4)",
                rusqlite::params![id, track_id, played_at, entry.ms_played as i64],
            )
            .map_err(|e| format!("Failed to insert play event: {e}"))?;
            result.matched += 1;
        } else {
            // No local track found — persist as ghost play so artist analytics still count it,
            // and so it gets absorbed automatically if the track is added to the library later.
            let duplicate: bool = tx
                .query_row(
                    "SELECT EXISTS(
                       SELECT 1 FROM spotify_ghost_plays
                       WHERE title_norm = ?1
                         AND artist_norm = ?2
                         AND ABS(played_at - ?3) <= 60000
                     )",
                    rusqlite::params![&norm_title, &norm_artist, played_at],
                    |row| row.get(0),
                )
                .unwrap_or(false);

            if duplicate {
                result.skipped_duplicate += 1;
                continue;
            }

            let id = ghost_play_id(&norm_title, &norm_artist, played_at);
            tx.execute(
                "INSERT OR IGNORE INTO spotify_ghost_plays
                 (id, title, artist, title_norm, artist_norm, played_at, ms_played)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    id,
                    track_name,
                    artist_name,
                    norm_title,
                    norm_artist,
                    played_at,
                    entry.ms_played as i64
                ],
            )
            .map_err(|e| format!("Failed to insert ghost play: {e}"))?;
            result.ghost_stored += 1;
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit import: {e}"))?;

    Ok(result)
}

/// Migrate ghost plays that match a newly-added local track into play_events.
/// Called from the library scanner inside its scan transaction.
pub fn absorb_ghost_plays(
    tx: &rusqlite::Transaction<'_>,
    track_id: &str,
    title_norm: &str,
    artist_norm: &str,
) -> Result<usize, rusqlite::Error> {
    let mut stmt = tx.prepare(
        "SELECT id, played_at, ms_played, artist_norm
         FROM spotify_ghost_plays
         WHERE title_norm = ?1",
    )?;

    let candidates: Vec<(String, i64, i64, String)> = stmt
        .query_map(rusqlite::params![title_norm], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?
        .filter_map(|r| r.ok())
        .collect();

    let mut absorbed = 0usize;
    for (ghost_id, played_at, ms_played, ghost_artist_norm) in candidates {
        if !artist_norm_match(artist_norm, &ghost_artist_norm) {
            continue;
        }

        let already_exists: bool = tx
            .query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM play_events
                   WHERE track_id = ?1
                     AND ABS(played_at - ?2) <= 60000
                     AND source = 'spotify-import'
                 )",
                rusqlite::params![track_id, played_at],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !already_exists {
            let event_id = format!("spotify-{}-{}", track_id, played_at);
            tx.execute(
                "INSERT OR IGNORE INTO play_events (id, track_id, played_at, source, ms_played)
                 VALUES (?1, ?2, ?3, 'spotify-import', ?4)",
                rusqlite::params![event_id, track_id, played_at, ms_played],
            )?;
            absorbed += 1;
        }

        tx.execute(
            "DELETE FROM spotify_ghost_plays WHERE id = ?1",
            [&ghost_id],
        )?;
    }

    Ok(absorbed)
}

struct LocalTrack {
    id: String,
    title: String,
    artist: String,
}

fn build_local_track_map(conn: &Connection) -> Result<HashMap<(String, String), String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, artist FROM tracks
             WHERE title IS NOT NULL AND artist IS NOT NULL",
        )
        .map_err(|e| format!("Failed to prepare track query: {e}"))?;

    let tracks: Vec<LocalTrack> = stmt
        .query_map([], |row| {
            Ok(LocalTrack {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query tracks: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

    let mut map = HashMap::with_capacity(tracks.len());
    for t in tracks {
        let key = (normalize(&t.title), normalize(&t.artist));
        map.insert(key, t.id);
    }
    Ok(map)
}

pub fn normalize(s: &str) -> String {
    let lower = s.to_lowercase();
    let stripped = strip_parentheticals(&lower);
    let clean: String = stripped
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || c.is_whitespace())
        .collect();
    clean.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn strip_parentheticals(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '(' || c == '[' {
            let close = if c == '(' { ')' } else { ']' };
            for inner in chars.by_ref() {
                if inner == close {
                    break;
                }
            }
        } else {
            result.push(c);
        }
    }
    result
}

fn artist_norm_match(local: &str, spotify: &str) -> bool {
    local == spotify || local.starts_with(spotify) || spotify.starts_with(local)
}

fn ghost_play_id(title_norm: &str, artist_norm: &str, played_at: i64) -> String {
    // FNV-1a 64-bit to produce a compact deterministic ID without external crates.
    let mut h: u64 = 14_695_981_039_346_656_037;
    for b in title_norm
        .as_bytes()
        .iter()
        .chain(b"\x00")
        .chain(artist_norm.as_bytes())
    {
        h ^= *b as u64;
        h = h.wrapping_mul(1_099_511_628_211);
    }
    format!("gp-{:x}-{}", h, played_at)
}

fn parse_spotify_ts(ts: &str) -> i64 {
    let normalized = ts.replace(' ', "T");
    let normalized = if normalized.ends_with('Z') {
        normalized
    } else {
        format!("{normalized}Z")
    };
    parse_iso8601_ms(&normalized).unwrap_or(0)
}

fn parse_iso8601_ms(s: &str) -> Option<i64> {
    let s = s.trim_end_matches('Z');
    let (date, time) = s.split_once('T')?;
    let mut date_parts = date.split('-');
    let year: i64 = date_parts.next()?.parse().ok()?;
    let month: i64 = date_parts.next()?.parse().ok()?;
    let day: i64 = date_parts.next()?.parse().ok()?;
    let mut time_parts = time.split(':');
    let hour: i64 = time_parts.next()?.parse().ok()?;
    let min: i64 = time_parts.next()?.parse().ok()?;
    let sec: i64 = time_parts.next()?.parse().ok()?;
    let days = days_since_epoch(year, month, day)?;
    Some((days * 86400 + hour * 3600 + min * 60 + sec) * 1000)
}

fn days_since_epoch(year: i64, month: i64, day: i64) -> Option<i64> {
    if month < 1 || month > 12 || day < 1 || day > 31 {
        return None;
    }
    let a = (14 - month) / 12;
    let y = year + 4800 - a;
    let m = month + 12 * a - 3;
    let jdn = day + (153 * m + 2) / 5 + 365 * y + y / 4 - y / 100 + y / 400 - 32045;
    Some(jdn - 2_440_588)
}
