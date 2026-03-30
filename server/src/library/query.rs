use rusqlite::params;

use super::models::{LibraryCursor, LibraryTrackItem, ScanError, SortDirection, TrackSortKey};

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

pub(crate) fn build_library_query_sql(
    has_search: bool,
    has_cursor: bool,
    sort_key: TrackSortKey,
    sort_direction: SortDirection,
) -> String {
    let sort_expression = match sort_key {
        TrackSortKey::Title => "lower(COALESCE(t.title, ''))",
        TrackSortKey::Artist => "lower(COALESCE(t.artist, ''))",
        TrackSortKey::Album => "lower(COALESCE(t.album, ''))",
        TrackSortKey::IndexedAt => "t.indexed_at",
    };

    let comparison = match sort_direction {
        SortDirection::Asc => ">",
        SortDirection::Desc => "<",
    };

    let direction = match sort_direction {
        SortDirection::Asc => "ASC",
        SortDirection::Desc => "DESC",
    };

    let mut sql = format!(
        "
        SELECT
          t.id,
          t.title,
          t.artist,
          t.album,
          t.duration_seconds,
          t.relative_path,
          ts.source_status,
          ce.cache_state,
          ar.analysis_status,
          t.indexed_at
        FROM tracks t
        JOIN track_sources ts ON ts.track_id = t.id
        JOIN cache_entries ce ON ce.track_id = t.id
        JOIN analysis_results ar ON ar.track_id = t.id
        WHERE 1 = 1
        "
    );

    if has_search {
        sql.push_str(
            "
            AND (
              lower(t.title) LIKE ?1
              OR lower(COALESCE(t.artist, '')) LIKE ?2
              OR lower(COALESCE(t.album, '')) LIKE ?3
            )
            ",
        );
    }

    if has_cursor {
        let base_index = if has_search { 4 } else { 1 };
        sql.push_str(&format!(
            "
            AND (
              {sort_expression} {comparison} ?{base_index}
              OR ({sort_expression} = ?{base_index_plus_one} AND t.id {comparison} ?{base_index_plus_two})
            )
            ",
            base_index = base_index,
            base_index_plus_one = base_index + 1,
            base_index_plus_two = base_index + 2,
        ));
    }

    let limit_param = if has_search && has_cursor {
        7
    } else if has_search || has_cursor {
        4
    } else {
        1
    };

    sql.push_str(&format!(
        "
        ORDER BY {sort_expression} {direction}, t.id {direction}
        LIMIT ?{limit_param}
        "
    ));

    sql
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
            duration_seconds: row.get(4)?,
            relative_path: row.get(5)?,
            source_status: row.get(6)?,
            cache_state: row.get(7)?,
            analysis_status: row.get(8)?,
            indexed_at: row.get(9)?,
        })
    })?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }

    Ok(items)
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
        build_library_query_sql, count_matching_tracks, sort_value_for_item, LibraryCursor,
    };
    use crate::library::models::LibraryTrackItem;
    use crate::library::{SortDirection, TrackSortKey};

    fn sample_item() -> LibraryTrackItem {
        LibraryTrackItem {
            id: "track-1".to_owned(),
            title: "Breathe".to_owned(),
            artist: Some("The Artist".to_owned()),
            album: Some("The Album".to_owned()),
            duration_seconds: Some(180.0),
            relative_path: "disc/breathe.mp3".to_owned(),
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
}
