use rusqlite::{params, OptionalExtension};

use crate::library::models::{
    AlbumDetail, AlbumLookupKey, AlbumSummary, AlbumTrackItem, ScanError,
};

pub(crate) fn query_album_summaries(
    connection: &rusqlite::Connection,
    search: Option<&str>,
) -> Result<Vec<AlbumSummary>, ScanError> {
    let sql = "
        SELECT
          MIN(t.album) AS album_title,
          MIN(NULLIF(COALESCE(t.album_artist, t.artist, ''), '')) AS album_artist,
          COUNT(*) AS track_count,
          CASE
            WHEN COUNT(t.duration_seconds) = 0 THEN NULL
            ELSE SUM(t.duration_seconds)
          END AS total_duration_seconds,
          MIN(t.artwork_key) AS artwork_key
        FROM tracks t
        WHERE NULLIF(TRIM(COALESCE(t.album, '')), '') IS NOT NULL
          AND (
            ?1 IS NULL
            OR lower(TRIM(COALESCE(t.album, ''))) LIKE ?1
            OR lower(TRIM(COALESCE(t.album_artist, t.artist, ''))) LIKE ?1
          )
        GROUP BY
          lower(TRIM(t.album)),
          lower(TRIM(COALESCE(t.album_artist, t.artist, '')))
        ORDER BY
          lower(TRIM(MIN(t.album))) ASC,
          lower(TRIM(MIN(COALESCE(t.album_artist, t.artist, '')))) ASC
    ";
    let search_pattern = search.map(|value| format!("%{value}%"));
    let mut statement = connection.prepare(sql)?;
    let rows = statement.query_map(params![search_pattern], |row| {
        let title: String = row.get(0)?;
        let artist: Option<String> = row.get(1)?;
        let track_count: i64 = row.get(2)?;

        Ok(AlbumSummary {
            id: AlbumLookupKey::new(&title, artist.as_deref()).encode(),
            title,
            artist,
            track_count: track_count as usize,
            total_duration_seconds: row.get(3)?,
            artwork_key: row.get(4)?,
        })
    })?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }

    Ok(items)
}

pub(crate) fn query_album_detail(
    connection: &rusqlite::Connection,
    lookup_key: &AlbumLookupKey,
) -> Result<Option<AlbumDetail>, ScanError> {
    let summary = connection
        .query_row(
            "
            SELECT
              MIN(t.album) AS album_title,
              MIN(NULLIF(COALESCE(t.album_artist, t.artist, ''), '')) AS album_artist,
              COUNT(*) AS track_count,
              CASE
                WHEN COUNT(t.duration_seconds) = 0 THEN NULL
                ELSE SUM(t.duration_seconds)
              END AS total_duration_seconds,
              MIN(t.artwork_key) AS artwork_key
            FROM tracks t
            WHERE lower(TRIM(COALESCE(t.album, ''))) = ?1
              AND lower(TRIM(COALESCE(t.album_artist, t.artist, ''))) = ?2
            GROUP BY
              lower(TRIM(t.album)),
              lower(TRIM(COALESCE(t.album_artist, t.artist, '')))
            ",
            params![lookup_key.album_key, lookup_key.artist_key],
            |row| {
                let title: String = row.get(0)?;
                let artist: Option<String> = row.get(1)?;
                let track_count: i64 = row.get(2)?;

                Ok(AlbumSummary {
                    id: lookup_key.encode(),
                    title,
                    artist,
                    track_count: track_count as usize,
                    total_duration_seconds: row.get(3)?,
                    artwork_key: row.get(4)?,
                })
            },
        )
        .optional()?;

    let Some(album) = summary else {
        return Ok(None);
    };

    let mut statement = connection.prepare(
        "
        SELECT
          t.id,
          t.title,
          t.artist,
          t.advisory,
          t.duration_seconds,
          t.artwork_key,
          t.extension,
          t.track_number,
          t.disc_number
        FROM tracks t
        WHERE lower(TRIM(COALESCE(t.album, ''))) = ?1
          AND lower(TRIM(COALESCE(t.album_artist, t.artist, ''))) = ?2
        ORDER BY
          COALESCE(t.disc_number, 0) ASC,
          COALESCE(t.track_number, 0) ASC,
          lower(t.title) ASC,
          t.id ASC
        ",
    )?;

    let rows = statement.query_map(
        params![lookup_key.album_key, lookup_key.artist_key],
        |row| {
            Ok(AlbumTrackItem {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                advisory: row.get(3)?,
                duration_seconds: row.get(4)?,
                artwork_key: row.get(5)?,
                extension: row.get(6)?,
                track_number: row.get(7)?,
                disc_number: row.get(8)?,
            })
        },
    )?;

    let mut tracks = Vec::new();
    for row in rows {
        tracks.push(row?);
    }

    Ok(Some(AlbumDetail { album, tracks }))
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::{query_album_detail, query_album_summaries};
    use crate::library::models::AlbumLookupKey;

    #[test]
    fn album_queries_group_tracks_and_hydrate_details() {
        let connection = Connection::open_in_memory().expect("db should open");
        connection
            .execute_batch(
                "
                CREATE TABLE tracks (
                  id TEXT PRIMARY KEY,
                  title TEXT NOT NULL,
                  artist TEXT,
                  album TEXT,
                  album_artist TEXT,
                  advisory INTEGER,
                  duration_seconds REAL,
                  artwork_key TEXT,
                  extension TEXT NOT NULL,
                  track_number INTEGER,
                  disc_number INTEGER
                );
                INSERT INTO tracks (
                  id, title, artist, album, album_artist, advisory, duration_seconds,
                  artwork_key, extension, track_number, disc_number
                ) VALUES
                  ('1', 'Alpha', 'North', 'Signals', 'North', 1, 180.0, 'signals.png', 'mp3', 1, 1),
                  ('2', 'Bravo', 'North', 'Signals', 'North', 0, 200.0, 'signals.png', 'flac', 2, 1),
                  ('3', 'Charlie', 'South', 'Fields', 'South', NULL, NULL, NULL, 'mp3', 1, 1);
                ",
            )
            .expect("tracks should seed");

        let summaries =
            query_album_summaries(&connection, Some("sig")).expect("albums should query");
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].title, "Signals");
        assert_eq!(summaries[0].artist.as_deref(), Some("North"));
        assert_eq!(summaries[0].track_count, 2);

        let detail = query_album_detail(
            &connection,
            &AlbumLookupKey::new(&summaries[0].title, summaries[0].artist.as_deref()),
        )
        .expect("album detail should query")
        .expect("album detail should exist");

        assert_eq!(detail.album.title, "Signals");
        assert_eq!(detail.tracks.len(), 2);
        assert_eq!(detail.tracks[0].title, "Alpha");
        assert_eq!(detail.tracks[1].extension, "flac");
    }
}
