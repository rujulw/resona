use std::collections::HashMap;

use rusqlite::Connection;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopTrackEntry {
    pub track_id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub artwork_key: Option<String>,
    pub advisory: Option<bool>,
    pub play_count: i64,
    pub first_played_at: i64,
    pub last_played_at: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopArtistEntry {
    pub artist: String,
    pub play_count: i64,
    pub track_count: i64,
    pub total_ms_played: i64,
    pub first_played_at: i64,
    pub last_played_at: i64,
    pub image_path: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackPlayStats {
    pub track_id: String,
    pub play_count: i64,
    pub first_played_at: i64,
    pub last_played_at: i64,
}

#[derive(Clone, Copy, Debug)]
pub enum AnalyticsWindow {
    AllTime,
    Days(u32),
}

impl AnalyticsWindow {
    fn cutoff_ms(self) -> Option<i64> {
        match self {
            Self::AllTime => None,
            Self::Days(days) => {
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0);
                Some(now_ms - (days as i64) * 86_400_000)
            }
        }
    }

    /// 4-week window is local-only: only counts plays recorded directly in the app.
    /// 6-month and all-time windows include Spotify import history.
    fn is_local_only(self) -> bool {
        matches!(self, Self::Days(d) if d <= 35)
    }
}

pub fn get_top_tracks(
    conn: &Connection,
    window: AnalyticsWindow,
    limit: usize,
) -> Result<Vec<TopTrackEntry>, rusqlite::Error> {
    let cutoff = window.cutoff_ms();
    let local_only = window.is_local_only();

    // 4-week window is local-only; 6-month and all-time include Spotify import history.
    let sql = match (cutoff.is_some(), local_only) {
        (false, _) =>
            "SELECT t.id, t.title, t.artist, t.album, t.artwork_key, t.advisory,
                    COUNT(*) AS play_count,
                    MIN(pe.played_at) AS first_played_at,
                    MAX(pe.played_at) AS last_played_at
             FROM play_events pe
             JOIN tracks t ON pe.track_id = t.id
             GROUP BY pe.track_id
             ORDER BY play_count DESC
             LIMIT ?1",
        (true, false) =>
            "SELECT t.id, t.title, t.artist, t.album, t.artwork_key, t.advisory,
                    COUNT(*) AS play_count,
                    MIN(pe.played_at) AS first_played_at,
                    MAX(pe.played_at) AS last_played_at
             FROM play_events pe
             JOIN tracks t ON pe.track_id = t.id
             WHERE pe.played_at >= ?2
             GROUP BY pe.track_id
             ORDER BY play_count DESC
             LIMIT ?1",
        (true, true) =>
            "SELECT t.id, t.title, t.artist, t.album, t.artwork_key, t.advisory,
                    COUNT(*) AS play_count,
                    MIN(pe.played_at) AS first_played_at,
                    MAX(pe.played_at) AS last_played_at
             FROM play_events pe
             JOIN tracks t ON pe.track_id = t.id
             WHERE pe.played_at >= ?2
               AND (pe.source IS NULL OR pe.source = 'local')
             GROUP BY pe.track_id
             ORDER BY play_count DESC
             LIMIT ?1",
    };

    let mut stmt = conn.prepare(sql)?;
    let rows = if let Some(cutoff_ms) = cutoff {
        stmt.query_map(rusqlite::params![limit as i64, cutoff_ms], map_top_track)?
    } else {
        stmt.query_map(rusqlite::params![limit as i64], map_top_track)?
    };

    rows.collect()
}

fn map_top_track(row: &rusqlite::Row<'_>) -> rusqlite::Result<TopTrackEntry> {
    Ok(TopTrackEntry {
        track_id: row.get(0)?,
        title: row.get(1)?,
        artist: row.get(2)?,
        album: row.get(3)?,
        artwork_key: row.get(4)?,
        advisory: row.get::<_, Option<i64>>(5)?.map(|v| v != 0),
        play_count: row.get(6)?,
        first_played_at: row.get(7)?,
        last_played_at: row.get(8)?,
    })
}

pub fn get_top_artists(
    conn: &Connection,
    window: AnalyticsWindow,
    limit: usize,
    image_map: &HashMap<String, String>,
) -> Result<Vec<TopArtistEntry>, rusqlite::Error> {
    let cutoff = window.cutoff_ms();
    let local_only = window.is_local_only();

    // COALESCE(pe.ms_played, track_duration_ms, 0): local plays before migration 0014
    // have NULL ms_played so fall back to stored track duration.
    let local_sql_all = "
        SELECT t.artist,
               COUNT(*) AS play_count,
               SUM(COALESCE(pe.ms_played,
                   CAST(t.duration_seconds * 1000.0 AS INTEGER), 0)) AS total_ms,
               MIN(pe.played_at) AS first_played_at,
               MAX(pe.played_at) AS last_played_at
        FROM play_events pe
        JOIN tracks t ON pe.track_id = t.id
        GROUP BY pe.track_id, t.artist";

    let local_sql_cutoff = "
        SELECT t.artist,
               COUNT(*) AS play_count,
               SUM(COALESCE(pe.ms_played,
                   CAST(t.duration_seconds * 1000.0 AS INTEGER), 0)) AS total_ms,
               MIN(pe.played_at) AS first_played_at,
               MAX(pe.played_at) AS last_played_at
        FROM play_events pe
        JOIN tracks t ON pe.track_id = t.id
        WHERE pe.played_at >= ?1
        GROUP BY pe.track_id, t.artist";

    // 4-week window: only local plays, no ghost plays.
    let local_sql_cutoff_local_only = "
        SELECT t.artist,
               COUNT(*) AS play_count,
               SUM(COALESCE(pe.ms_played,
                   CAST(t.duration_seconds * 1000.0 AS INTEGER), 0)) AS total_ms,
               MIN(pe.played_at) AS first_played_at,
               MAX(pe.played_at) AS last_played_at
        FROM play_events pe
        JOIN tracks t ON pe.track_id = t.id
        WHERE pe.played_at >= ?1
          AND (pe.source IS NULL OR pe.source = 'local')
        GROUP BY pe.track_id, t.artist";

    // Ghost plays are Spotify import history — excluded from the 4-week window.
    let ghost_sql_all = "
        SELECT artist,
               COUNT(*) AS play_count,
               SUM(ms_played) AS total_ms,
               MIN(played_at) AS first_played_at,
               MAX(played_at) AS last_played_at
        FROM spotify_ghost_plays
        GROUP BY title_norm, artist_norm";

    let ghost_sql_cutoff = "
        SELECT artist,
               COUNT(*) AS play_count,
               SUM(ms_played) AS total_ms,
               MIN(played_at) AS first_played_at,
               MAX(played_at) AS last_played_at
        FROM spotify_ghost_plays
        WHERE played_at >= ?1
        GROUP BY title_norm, artist_norm";

    struct Row {
        artist: String,
        play_count: i64,
        total_ms: i64,
        first_played_at: i64,
        last_played_at: i64,
    }

    let map_row = |row: &rusqlite::Row<'_>| -> rusqlite::Result<Row> {
        Ok(Row {
            artist: row.get(0)?,
            play_count: row.get(1)?,
            total_ms: row.get::<_, Option<i64>>(2)?.unwrap_or(0),
            first_played_at: row.get(3)?,
            last_played_at: row.get(4)?,
        })
    };

    // Collect local rows
    let local_sql = match (cutoff.is_some(), local_only) {
        (false, _) => local_sql_all,
        (true, false) => local_sql_cutoff,
        (true, true) => local_sql_cutoff_local_only,
    };
    let mut local_stmt = conn.prepare(local_sql)?;
    let local_rows: Vec<Row> = if let Some(c) = cutoff {
        local_stmt.query_map(rusqlite::params![c], map_row)?
    } else {
        local_stmt.query_map([], map_row)?
    }
    .collect::<Result<_, _>>()?;

    // Ghost plays only included for 6-month and all-time windows.
    let ghost_rows: Vec<Row> = if !local_only {
        let ghost_sql = if cutoff.is_some() { ghost_sql_cutoff } else { ghost_sql_all };
        let mut ghost_stmt = conn.prepare(ghost_sql)?;
        if let Some(c) = cutoff {
            ghost_stmt.query_map(rusqlite::params![c], map_row)?
        } else {
            ghost_stmt.query_map([], map_row)?
        }
        .collect::<Result<_, _>>()?
    } else {
        Vec::new()
    };

    // Aggregate both sets into a single map, splitting multi-artist strings.
    struct ArtistAgg {
        play_count: i64,
        track_count: i64,
        total_ms: i64,
        first_played_at: i64,
        last_played_at: i64,
    }

    let mut map: HashMap<String, ArtistAgg> = HashMap::new();

    for row in local_rows.into_iter().chain(ghost_rows) {
        for name in split_artist_names(&row.artist) {
            let entry = map.entry(name).or_insert(ArtistAgg {
                play_count: 0,
                track_count: 0,
                total_ms: 0,
                first_played_at: i64::MAX,
                last_played_at: 0,
            });
            entry.play_count += row.play_count;
            entry.track_count += 1;
            entry.total_ms += row.total_ms;
            entry.first_played_at = entry.first_played_at.min(row.first_played_at);
            entry.last_played_at = entry.last_played_at.max(row.last_played_at);
        }
    }

    // Remove artists excluded via artist_analytics_overrides.
    let excluded: std::collections::HashSet<String> = {
        let mut stmt = conn.prepare(
            "SELECT artist_name FROM artist_analytics_overrides WHERE excluded = 1",
        )?;
        let names: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<Result<_, _>>()?;
        names.into_iter().collect()
    };
    map.retain(|name, _| !excluded.contains(name));

    let mut results: Vec<TopArtistEntry> = map
        .into_iter()
        .map(|(artist, agg)| {
            let image_path = image_map.get(&artist.to_lowercase()).cloned();
            TopArtistEntry {
                artist,
                play_count: agg.play_count,
                track_count: agg.track_count,
                total_ms_played: agg.total_ms,
                first_played_at: agg.first_played_at,
                last_played_at: agg.last_played_at,
                image_path,
            }
        })
        .collect();

    results.sort_by(|a, b| b.play_count.cmp(&a.play_count));
    results.truncate(limit);
    Ok(results)
}

fn split_artist_names(raw: &str) -> Vec<String> {
    raw.split(',')
        .flat_map(|part| split_featuring(part.trim()))
        .filter(|s| !s.is_empty())
        .collect()
}

fn split_featuring(s: &str) -> Vec<String> {
    let lower = s.to_lowercase();
    for marker in &[" feat. ", " feat ", " ft. ", " ft ", " featuring "] {
        if let Some(pos) = lower.find(marker) {
            let before = s[..pos].trim().to_string();
            let rest = s[pos + marker.len()..].trim();
            let mut result = vec![before];
            result.extend(split_featuring(rest));
            return result;
        }
    }
    vec![s.trim().to_string()]
}

pub fn set_artist_analytics_excluded(
    conn: &Connection,
    artist_name: &str,
    excluded: bool,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO artist_analytics_overrides (artist_name, excluded)
         VALUES (?1, ?2)
         ON CONFLICT(artist_name) DO UPDATE SET excluded = ?2",
        rusqlite::params![artist_name, excluded as i64],
    )?;
    Ok(())
}

pub fn list_excluded_artists(conn: &Connection) -> Result<Vec<String>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT artist_name FROM artist_analytics_overrides WHERE excluded = 1 ORDER BY artist_name ASC",
    )?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    rows.collect()
}

pub fn get_track_play_stats(
    conn: &Connection,
    track_id: &str,
) -> Result<Option<TrackPlayStats>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT COUNT(*), MIN(played_at), MAX(played_at)
         FROM play_events
         WHERE track_id = ?1",
    )?;

    stmt.query_row(rusqlite::params![track_id], |row| {
        let count: i64 = row.get(0)?;
        if count == 0 {
            return Ok(None);
        }
        Ok(Some(TrackPlayStats {
            track_id: track_id.to_owned(),
            play_count: count,
            first_played_at: row.get(1)?,
            last_played_at: row.get(2)?,
        }))
    })
}
