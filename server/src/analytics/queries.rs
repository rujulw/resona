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
    pub first_played_at: i64,
    pub last_played_at: i64,
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
}

pub fn get_top_tracks(
    conn: &Connection,
    window: AnalyticsWindow,
    limit: usize,
) -> Result<Vec<TopTrackEntry>, rusqlite::Error> {
    let cutoff = window.cutoff_ms();
    let sql = if cutoff.is_some() {
        "SELECT t.id, t.title, t.artist, t.album, t.artwork_key, t.advisory,
                COUNT(*) AS play_count,
                MIN(pe.played_at) AS first_played_at,
                MAX(pe.played_at) AS last_played_at
         FROM play_events pe
         JOIN tracks t ON pe.track_id = t.id
         WHERE pe.played_at >= ?2
         GROUP BY pe.track_id
         ORDER BY play_count DESC
         LIMIT ?1"
    } else {
        "SELECT t.id, t.title, t.artist, t.album, t.artwork_key, t.advisory,
                COUNT(*) AS play_count,
                MIN(pe.played_at) AS first_played_at,
                MAX(pe.played_at) AS last_played_at
         FROM play_events pe
         JOIN tracks t ON pe.track_id = t.id
         GROUP BY pe.track_id
         ORDER BY play_count DESC
         LIMIT ?1"
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
) -> Result<Vec<TopArtistEntry>, rusqlite::Error> {
    let cutoff = window.cutoff_ms();
    // Aggregate by track first, then split artist names in Rust so that
    // "Artist A, Artist B" counts as two separate artists.
    let sql_with_cutoff =
        "SELECT t.artist, COUNT(*) AS play_count,
                MIN(pe.played_at) AS first_played_at,
                MAX(pe.played_at) AS last_played_at
         FROM play_events pe
         JOIN tracks t ON pe.track_id = t.id
         WHERE pe.played_at >= ?1
         GROUP BY pe.track_id, t.artist";
    let sql_all_time =
        "SELECT t.artist, COUNT(*) AS play_count,
                MIN(pe.played_at) AS first_played_at,
                MAX(pe.played_at) AS last_played_at
         FROM play_events pe
         JOIN tracks t ON pe.track_id = t.id
         GROUP BY pe.track_id, t.artist";

    struct TrackRow {
        artist: String,
        play_count: i64,
        first_played_at: i64,
        last_played_at: i64,
    }

    let map_row = |row: &rusqlite::Row<'_>| -> rusqlite::Result<TrackRow> {
        Ok(TrackRow {
            artist: row.get(0)?,
            play_count: row.get(1)?,
            first_played_at: row.get(2)?,
            last_played_at: row.get(3)?,
        })
    };

    let mut stmt = conn.prepare(if cutoff.is_some() { sql_with_cutoff } else { sql_all_time })?;
    let rows: Vec<TrackRow> = if let Some(cutoff_ms) = cutoff {
        stmt.query_map(rusqlite::params![cutoff_ms], map_row)?.collect::<Result<_, _>>()?
    } else {
        stmt.query_map([], map_row)?.collect::<Result<_, _>>()?
    };

    // Split "Artist A, Artist B feat. Artist C" → individual names, aggregate
    use std::collections::HashMap;
    struct ArtistAgg {
        play_count: i64,
        track_count: i64,
        first_played_at: i64,
        last_played_at: i64,
    }
    let mut map: HashMap<String, ArtistAgg> = HashMap::new();
    for row in rows {
        for name in split_artist_names(&row.artist) {
            let entry = map.entry(name).or_insert(ArtistAgg {
                play_count: 0,
                track_count: 0,
                first_played_at: i64::MAX,
                last_played_at: 0,
            });
            entry.play_count += row.play_count;
            entry.track_count += 1;
            entry.first_played_at = entry.first_played_at.min(row.first_played_at);
            entry.last_played_at = entry.last_played_at.max(row.last_played_at);
        }
    }

    let mut results: Vec<TopArtistEntry> = map
        .into_iter()
        .map(|(artist, agg)| TopArtistEntry {
            artist,
            play_count: agg.play_count,
            track_count: agg.track_count,
            first_played_at: agg.first_played_at,
            last_played_at: agg.last_played_at,
        })
        .collect();

    results.sort_by(|a, b| b.play_count.cmp(&a.play_count));
    results.truncate(limit);
    Ok(results)
}

fn split_artist_names(raw: &str) -> Vec<String> {
    // First split on comma, then strip feat./ft./featuring prefixes
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
