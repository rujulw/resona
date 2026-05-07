use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::params;
use serde::Serialize;

use crate::database::AppDatabase;

const ARTIST_WALK_LIMIT: usize = 15;
const LIBRARY_FALLBACK_LIMIT: usize = 15;
// Window for computing year preference: 90 days in seconds
const YEAR_PREF_WINDOW_SECS: i64 = 7_776_000;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoContinuePayload {
    pub track_ids: Vec<String>,
    pub source_label: String,
}

pub struct AutoContinueResolver {
    app_database: AppDatabase,
}

impl AutoContinueResolver {
    pub fn new(app_database: AppDatabase) -> Self {
        Self { app_database }
    }

    pub fn record_play_event(&self, track_id: &str) -> Result<(), String> {
        let connection = self
            .app_database
            .connect()
            .map_err(|e| e.to_string())?;
        let now = unix_now();
        let event_id = format!("{track_id}:{now}");
        connection
            .execute(
                "INSERT OR IGNORE INTO play_events (id, track_id, played_at) VALUES (?1, ?2, ?3)",
                params![event_id, track_id, now],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // Resolves the next batch of track IDs for auto-continue playback.
    //
    // Strategy:
    //   1. If `artist` is provided: fetch tracks by that artist, scored by proximity
    //      to the user's historically preferred era for that artist (computed from
    //      play_events in the last 90 days). Older-leaning listeners get older tracks.
    //   2. Fallback: recency-weighted library shuffle — tracks ordered by least recently
    //      played (never-played first), with RANDOM() as tiebreaker.
    //
    // Tracks in `exclude_ids` are always omitted (current queue / recently active).
    pub fn resolve(
        &self,
        artist: Option<&str>,
        exclude_ids: &[String],
    ) -> Result<AutoContinuePayload, String> {
        if let Some(artist) = artist {
            let ids = self.resolve_artist_walk(artist, exclude_ids)?;
            if !ids.is_empty() {
                return Ok(AutoContinuePayload {
                    track_ids: ids,
                    source_label: "auto-continue:artist-walk".to_owned(),
                });
            }
        }

        let ids = self.resolve_library_fallback(exclude_ids)?;
        Ok(AutoContinuePayload {
            track_ids: ids,
            source_label: "auto-continue:library-shuffle".to_owned(),
        })
    }

    fn resolve_artist_walk(
        &self,
        artist: &str,
        exclude_ids: &[String],
    ) -> Result<Vec<String>, String> {
        let connection = self
            .app_database
            .connect()
            .map_err(|e| e.to_string())?;
        let cutoff = unix_now() - YEAR_PREF_WINDOW_SECS;

        // Compute the user's preferred year for this artist from recent play history.
        // AVG of years of recently played tracks by this artist gives a centroid era.
        let preferred_year: Option<i64> = connection
            .query_row(
                "
                SELECT CAST(AVG(t.year) AS INTEGER)
                FROM play_events pe
                JOIN tracks t ON t.id = pe.track_id
                WHERE LOWER(COALESCE(t.artist, t.album_artist, '')) = LOWER(?1)
                  AND t.year IS NOT NULL
                  AND pe.played_at > ?2
                ",
                params![artist, cutoff],
                |row| row.get(0),
            )
            .unwrap_or(None);

        let exclude_clause = build_exclude_clause(exclude_ids);
        let sql = format!(
            "
            SELECT t.id
            FROM tracks t
            JOIN track_sources ts ON ts.track_id = t.id AND ts.local_path IS NOT NULL
            WHERE LOWER(COALESCE(t.artist, t.album_artist, '')) = LOWER(?1)
              {exclude_clause}
            ORDER BY
              CASE
                WHEN t.year IS NOT NULL AND ?2 IS NOT NULL THEN ABS(t.year - ?2)
                ELSE 9999
              END ASC,
              RANDOM()
            LIMIT {ARTIST_WALK_LIMIT}
            "
        );

        let mut stmt = connection.prepare(&sql).map_err(|e| e.to_string())?;
        let ids = stmt
            .query_map(params![artist, preferred_year], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<String>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(ids)
    }

    fn resolve_library_fallback(&self, exclude_ids: &[String]) -> Result<Vec<String>, String> {
        let connection = self
            .app_database
            .connect()
            .map_err(|e| e.to_string())?;
        let exclude_clause = build_exclude_clause(exclude_ids);
        let sql = format!(
            "
            SELECT t.id
            FROM tracks t
            JOIN track_sources ts ON ts.track_id = t.id AND ts.local_path IS NOT NULL
            LEFT JOIN (
              SELECT track_id, MAX(played_at) AS last_played
              FROM play_events
              GROUP BY track_id
            ) pe ON pe.track_id = t.id
            WHERE 1=1
              {exclude_clause}
            ORDER BY COALESCE(pe.last_played, 0) ASC, RANDOM()
            LIMIT {LIBRARY_FALLBACK_LIMIT}
            "
        );

        let mut stmt = connection.prepare(&sql).map_err(|e| e.to_string())?;
        let ids = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<String>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(ids)
    }
}

// Build a safe NOT IN clause. IDs are internally generated opaque strings, but
// we still escape single quotes to be defensive.
fn build_exclude_clause(ids: &[String]) -> String {
    if ids.is_empty() {
        return String::new();
    }
    let placeholders = ids
        .iter()
        .map(|id| format!("'{}'", id.replace('\'', "''")))
        .collect::<Vec<_>>()
        .join(", ");
    format!("AND t.id NOT IN ({placeholders})")
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
