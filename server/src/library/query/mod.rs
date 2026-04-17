mod sql;

use rusqlite::{params, OptionalExtension};

use super::models::{
    AlbumDetail, AlbumLookupKey, AlbumSummary, AlbumTrackItem, LibraryCursor, LibraryTrackItem,
    ScanError, SortDirection, TrackSortKey,
};

pub(crate) use sql::build_library_query_sql;

pub(crate) fn count_matching_tracks(
    connection: &rusqlite::Connection,
    search: Option<&str>,
) -> Result<usize, ScanError> {
    let count: i64 = if let Some(search) = search {
        let search_pattern = format!("%{search}%");
        connection.query_row(
            "
            SELECT COUNT(*)
            FROM tracks
            WHERE lower(title) LIKE ?1
               OR lower(COALESCE(artist, '')) LIKE ?2
               OR lower(COALESCE(album, '')) LIKE ?3
            ",
            params![search_pattern, search_pattern, search_pattern],
            |row| row.get(0),
        )?
    } else {
        connection.query_row("SELECT COUNT(*) FROM tracks", [], |row| row.get(0))?
    };

    Ok(count as usize)
}

pub(crate) fn query_tracks<P>(
    statement: &mut rusqlite::Statement<'_>,
    params: P,
) -> Result<Vec<LibraryTrackItem>, ScanError>
where
    P: rusqlite::Params,
{
    let rows = statement.query_map(params, |row| {
        Ok(LibraryTrackItem {
            id: row.get(0)?,
            title: row.get(1)?,
            artist: row.get(2)?,
            album: row.get(3)?,
            advisory: row.get(4)?,
            duration_seconds: row.get(5)?,
            artwork_key: row.get(6)?,
            relative_path: row.get(7)?,
            extension: row.get(8)?,
            source_status: row.get(9)?,
            cache_state: row.get(10)?,
            analysis_status: row.get(11)?,
            indexed_at: row.get(12)?,
        })
    })?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }

    Ok(items)
}

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

pub(crate) fn sort_value_for_item(item: &LibraryTrackItem, sort_key: TrackSortKey) -> String {
    match sort_key {
        TrackSortKey::Title => item.title.to_lowercase(),
        TrackSortKey::Artist => item.artist.clone().unwrap_or_default().to_lowercase(),
        TrackSortKey::Album => item.album.clone().unwrap_or_default().to_lowercase(),
        TrackSortKey::IndexedAt => item.indexed_at.clone(),
    }
}

impl LibraryCursor {
    pub(crate) fn encode(&self) -> String {
        let sort_key = match self.sort_key {
            TrackSortKey::Title => "title",
            TrackSortKey::Artist => "artist",
            TrackSortKey::Album => "album",
            TrackSortKey::IndexedAt => "indexed_at",
        };
        let direction = match self.sort_direction {
            SortDirection::Asc => "asc",
            SortDirection::Desc => "desc",
        };

        format!(
            "{sort_key}|{direction}|{}|{}",
            self.sort_value.replace('|', "%7C"),
            self.track_id.replace('|', "%7C"),
        )
    }

    pub(crate) fn decode(value: &str) -> Option<Self> {
        let mut parts = value.splitn(4, '|');
        let sort_key = match parts.next()? {
            "title" => TrackSortKey::Title,
            "artist" => TrackSortKey::Artist,
            "album" => TrackSortKey::Album,
            "indexed_at" => TrackSortKey::IndexedAt,
            _ => return None,
        };
        let sort_direction = match parts.next()? {
            "asc" => SortDirection::Asc,
            "desc" => SortDirection::Desc,
            _ => return None,
        };

        Some(Self {
            sort_key,
            sort_direction,
            sort_value: parts.next()?.replace("%7C", "|"),
            track_id: parts.next()?.replace("%7C", "|"),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_library_query_sql, count_matching_tracks, query_album_detail, query_album_summaries,
        sort_value_for_item, AlbumLookupKey, LibraryCursor,
    };
    use crate::library::models::LibraryTrackItem;
    use crate::library::{SortDirection, TrackSortKey};

    fn sample_item() -> LibraryTrackItem {
        LibraryTrackItem {
            id: "track-1".to_owned(),
            title: "Breathe".to_owned(),
            artist: Some("The Artist".to_owned()),
            album: Some("The Album".to_owned()),
            advisory: Some(true),
            duration_seconds: Some(180.0),
            artwork_key: Some("artwork-key.jpg".to_owned()),
            relative_path: "disc/breathe.mp3".to_owned(),
            extension: "mp3".to_owned(),
            source_status: "local-only".to_owned(),
            cache_state: "none".to_owned(),
            analysis_status: "pending".to_owned(),
            indexed_at: "1700000000".to_owned(),
        }
    }

    #[test]
    fn cursor_round_trip_preserves_sort_metadata() {
        let cursor = LibraryCursor {
            sort_key: TrackSortKey::Artist,
            sort_direction: SortDirection::Desc,
            sort_value: "artist|name".to_owned(),
            track_id: "track|42".to_owned(),
        };

        let encoded = cursor.encode();
        let decoded = LibraryCursor::decode(&encoded).expect("cursor should decode");

        assert_eq!(decoded.sort_key, TrackSortKey::Artist);
        assert_eq!(decoded.sort_direction, SortDirection::Desc);
        assert_eq!(decoded.sort_value, "artist|name");
        assert_eq!(decoded.track_id, "track|42");
    }

    #[test]
    fn sort_value_tracks_the_active_sort_key() {
        let item = sample_item();

        assert_eq!(sort_value_for_item(&item, TrackSortKey::Title), "breathe");
        assert_eq!(
            sort_value_for_item(&item, TrackSortKey::Artist),
            "the artist"
        );
        assert_eq!(sort_value_for_item(&item, TrackSortKey::Album), "the album");
        assert_eq!(
            sort_value_for_item(&item, TrackSortKey::IndexedAt),
            "1700000000"
        );
    }

    #[test]
    fn query_sql_adds_search_cursor_and_stable_ordering_clauses() {
        let sql = build_library_query_sql(true, true, TrackSortKey::Title, SortDirection::Asc);

        assert!(sql.contains("lower(t.title) LIKE ?1"));
        assert!(sql.contains("lower(COALESCE(t.title, '')) > ?4"));
        assert!(sql.contains("AND t.id > ?6"));
        assert!(sql.contains("ORDER BY lower(COALESCE(t.title, '')) ASC, t.id ASC"));
        assert!(sql.contains("LIMIT ?7"));
    }

    #[test]
    fn count_matching_tracks_uses_search_scope_when_present() {
        let connection = rusqlite::Connection::open_in_memory().expect("db should open");
        connection
            .execute_batch(
                "
                CREATE TABLE tracks (
                  id TEXT PRIMARY KEY,
                  title TEXT NOT NULL,
                  artist TEXT,
                  album TEXT
                );
                INSERT INTO tracks (id, title, artist, album) VALUES
                  ('1', 'Alpha Drift', 'North', 'Signals'),
                  ('2', 'Bravo Mist', 'South', 'Signals'),
                  ('3', 'Charlie Bloom', 'West', 'Fields');
                ",
            )
            .expect("tracks should seed");

        let total = count_matching_tracks(&connection, None).expect("total should count");
        let filtered =
            count_matching_tracks(&connection, Some("signals")).expect("search should count");

        assert_eq!(total, 3);
        assert_eq!(filtered, 2);
    }

    #[test]
    fn album_queries_group_tracks_and_hydrate_details() {
        let connection = rusqlite::Connection::open_in_memory().expect("db should open");
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
