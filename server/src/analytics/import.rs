use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyStreamEntry {
    pub ts: String,
    #[serde(rename = "trackName")]
    pub track_name: String,
    #[serde(rename = "artistName")]
    pub artist_name: String,
    #[serde(rename = "msPlayed")]
    pub ms_played: u64,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyImportResult {
    pub matched: usize,
    pub skipped_short: usize,
    pub skipped_no_match: usize,
    pub skipped_duplicate: usize,
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

pub fn import_spotify_history(
    conn: &mut Connection,
    json_path: &str,
    options: SpotifyImportOptions,
) -> Result<SpotifyImportResult, String> {
    let raw = std::fs::read_to_string(json_path)
        .map_err(|e| format!("Failed to read Spotify export file: {e}"))?;
    let entries: Vec<SpotifyStreamEntry> = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse Spotify export JSON: {e}"))?;

    let local_tracks = load_local_tracks(conn)?;
    let mut result = SpotifyImportResult::default();
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to open transaction: {e}"))?;

    for entry in &entries {
        if entry.ms_played < options.min_ms_played {
            result.skipped_short += 1;
            continue;
        }

        let played_at = parse_spotify_ts(&entry.ts);
        let norm_title = normalize(&entry.track_name);
        let norm_artist = normalize(&entry.artist_name);

        let matched = local_tracks.iter().find(|t| {
            normalize(&t.title) == norm_title && artist_match(&normalize(&t.artist), &norm_artist)
        });

        let Some(track) = matched else {
            result.skipped_no_match += 1;
            continue;
        };

        let duplicate: bool = tx
            .query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM play_events
                   WHERE track_id = ?1
                     AND ABS(played_at - ?2) <= 60000
                     AND source = 'spotify-import'
                 )",
                rusqlite::params![track.id, played_at],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if duplicate {
            result.skipped_duplicate += 1;
            continue;
        }

        let id = format!("spotify-{}-{}", track.id, played_at);
        tx.execute(
            "INSERT OR IGNORE INTO play_events (id, track_id, played_at, source)
             VALUES (?1, ?2, ?3, 'spotify-import')",
            rusqlite::params![id, track.id, played_at],
        )
        .map_err(|e| format!("Failed to insert play event: {e}"))?;

        result.matched += 1;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit import: {e}"))?;

    Ok(result)
}

struct LocalTrack {
    id: String,
    title: String,
    artist: String,
}

fn load_local_tracks(conn: &Connection) -> Result<Vec<LocalTrack>, String> {
    let mut stmt = conn
        .prepare("SELECT id, title, artist FROM tracks WHERE title IS NOT NULL AND artist IS NOT NULL")
        .map_err(|e| format!("Failed to prepare track query: {e}"))?;

    let tracks = stmt
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

    Ok(tracks)
}

fn normalize(s: &str) -> String {
    let lower = s.to_lowercase();
    // strip (feat. ...), (ft. ...), [...]
    let stripped = regex_strip_features(&lower);
    // remove punctuation except hyphen
    let clean: String = stripped
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || c.is_whitespace())
        .collect();
    // collapse whitespace
    clean.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn regex_strip_features(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '(' || c == '[' {
            let close = if c == '(' { ')' } else { ']' };
            // consume until matching close
            while let Some(inner) = chars.next() {
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

fn artist_match(local: &str, spotify: &str) -> bool {
    local == spotify || local.starts_with(spotify) || spotify.starts_with(local)
}

fn parse_spotify_ts(ts: &str) -> i64 {
    // Spotify format: "2023-11-14T21:30:00Z" or "2023-11-14 21:30:00"
    let normalized = ts.replace(' ', "T");
    let normalized = if normalized.ends_with('Z') {
        normalized
    } else {
        format!("{normalized}Z")
    };

    // Manual parse: YYYY-MM-DDTHH:MM:SSZ
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

    // Days since Unix epoch via a simple Gregorian calculation
    let days = days_since_epoch(year, month, day)?;
    Some((days * 86400 + hour * 3600 + min * 60 + sec) * 1000)
}

fn days_since_epoch(year: i64, month: i64, day: i64) -> Option<i64> {
    if month < 1 || month > 12 || day < 1 || day > 31 {
        return None;
    }
    // Use the algorithm from POSIX mktime / Julian Day
    let a = (14 - month) / 12;
    let y = year + 4800 - a;
    let m = month + 12 * a - 3;
    let jdn = day + (153 * m + 2) / 5 + 365 * y + y / 4 - y / 100 + y / 400 - 32045;
    // Unix epoch is JDN 2440588
    Some(jdn - 2_440_588)
}
