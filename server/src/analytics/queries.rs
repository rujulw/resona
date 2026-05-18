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
        "SELECT t.id, t.title, t.artist, t.album, t.artwork_key,
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
        "SELECT t.id, t.title, t.artist, t.album, t.artwork_key,
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
        play_count: row.get(5)?,
        first_played_at: row.get(6)?,
        last_played_at: row.get(7)?,
    })
}

pub fn get_top_artists(
    conn: &Connection,
    window: AnalyticsWindow,
    limit: usize,
) -> Result<Vec<TopArtistEntry>, rusqlite::Error> {
    let cutoff = window.cutoff_ms();
    let sql = if cutoff.is_some() {
        "SELECT t.artist,
                COUNT(*) AS play_count,
                COUNT(DISTINCT pe.track_id) AS track_count,
                MIN(pe.played_at) AS first_played_at,
                MAX(pe.played_at) AS last_played_at
         FROM play_events pe
         JOIN tracks t ON pe.track_id = t.id
         WHERE pe.played_at >= ?2
         GROUP BY t.artist
         ORDER BY play_count DESC
         LIMIT ?1"
    } else {
        "SELECT t.artist,
                COUNT(*) AS play_count,
                COUNT(DISTINCT pe.track_id) AS track_count,
                MIN(pe.played_at) AS first_played_at,
                MAX(pe.played_at) AS last_played_at
         FROM play_events pe
         JOIN tracks t ON pe.track_id = t.id
         GROUP BY t.artist
         ORDER BY play_count DESC
         LIMIT ?1"
    };

    let mut stmt = conn.prepare(sql)?;
    let rows = if let Some(cutoff_ms) = cutoff {
        stmt.query_map(rusqlite::params![limit as i64, cutoff_ms], map_top_artist)?
    } else {
        stmt.query_map(rusqlite::params![limit as i64], map_top_artist)?
    };

    rows.collect()
}

fn map_top_artist(row: &rusqlite::Row<'_>) -> rusqlite::Result<TopArtistEntry> {
    Ok(TopArtistEntry {
        artist: row.get(0)?,
        play_count: row.get(1)?,
        track_count: row.get(2)?,
        first_played_at: row.get(3)?,
        last_played_at: row.get(4)?,
    })
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
