use rusqlite::params;

use crate::library::models::{
    AlbumLookupKey, ArtistDetail, ArtistListItem, ArtistPlaylistItem, DiscographyAlbum,
    DiscographyItemKind, ScanError,
};

// Generates a SQL condition: `col` is the primary/first-listed artist for ?1.
// Handles exact match plus known separators that follow the artist name.
fn is_primary(col: &str) -> String {
    format!(
        "(
          lower({col}) = lower(?1)
          OR lower({col}) LIKE lower(?1) || ',%'
          OR lower({col}) LIKE lower(?1) || ' feat.%'
          OR lower({col}) LIKE lower(?1) || ' feat %'
          OR lower({col}) LIKE lower(?1) || ' ft.%'
          OR lower({col}) LIKE lower(?1) || ' &%'
          OR lower({col}) LIKE lower(?1) || ' x %'
          OR lower({col}) LIKE lower(?1) || ' /%'
        )",
        col = col
    )
}

// Generates a SQL condition: ?1 appears in `col` as a non-primary (featured) artist.
// Requires that ?1 is preceded by a known separator, and excludes cases where ?1 leads.
fn is_feature(col: &str) -> String {
    format!(
        "NOT {primary}
        AND (
          lower({col}) LIKE '%, '    || lower(?1)
          OR lower({col}) LIKE '%, '    || lower(?1) || ',%'
          OR lower({col}) LIKE '%, '    || lower(?1) || ' %'
          OR lower({col}) LIKE '%feat. ' || lower(?1)
          OR lower({col}) LIKE '%feat. ' || lower(?1) || ',%'
          OR lower({col}) LIKE '%feat. ' || lower(?1) || ' %'
          OR lower({col}) LIKE '%feat '  || lower(?1)
          OR lower({col}) LIKE '%feat '  || lower(?1) || ',%'
          OR lower({col}) LIKE '%ft. '   || lower(?1)
          OR lower({col}) LIKE '%ft. '   || lower(?1) || ',%'
          OR lower({col}) LIKE '% & '    || lower(?1)
          OR lower({col}) LIKE '% & '    || lower(?1) || ',%'
          OR lower({col}) LIKE '% x '    || lower(?1)
          OR lower({col}) LIKE '% / '    || lower(?1)
        )",
        primary = is_primary(col),
        col = col
    )
}

pub(crate) fn query_artist_list(
    connection: &rusqlite::Connection,
    search: Option<&str>,
) -> Result<Vec<ArtistListItem>, ScanError> {
    let search_pattern = search.map(|s| format!("%{s}%"));
    let mut statement = connection.prepare(
        "
        SELECT
          artist,
          COUNT(DISTINCT COALESCE(album, '')) AS album_count,
          COUNT(*) AS track_count
        FROM tracks
        WHERE artist IS NOT NULL
          AND (?1 IS NULL OR lower(artist) LIKE ?1)
        GROUP BY artist
        ORDER BY lower(artist) ASC
        ",
    )?;

    let rows = statement.query_map(params![search_pattern], |row| {
        Ok(ArtistListItem {
            name: row.get(0)?,
            album_count: row.get::<_, i64>(1)? as usize,
            track_count: row.get::<_, i64>(2)? as usize,
        })
    })?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }

    Ok(items)
}

pub(crate) fn query_artist_detail(
    connection: &rusqlite::Connection,
    artist_name: &str,
) -> Result<Option<ArtistDetail>, ScanError> {
    // Count all tracks where the artist is primary or featured
    let track_count_sql = format!(
        "SELECT COUNT(*) FROM tracks WHERE {primary} OR ({feature})",
        primary = is_primary("artist"),
        feature = is_feature("artist"),
    );
    let track_count: i64 =
        connection.query_row(&track_count_sql, params![artist_name], |row| row.get(0))?;

    if track_count == 0 {
        return Ok(None);
    }

    // Discography: albums where artist is primary (>1 track), sorted year DESC nulls last
    let disc_sql = format!(
        "
        SELECT
          COALESCE(t.album, '') AS title,
          COUNT(*) AS track_count,
          MAX(t.artwork_key) AS artwork_key,
          MAX(t.year) AS year
        FROM tracks t
        WHERE {primary} AND t.artist IS NOT NULL
        GROUP BY COALESCE(t.album, '')
        HAVING COUNT(*) > 1
        ",
        primary = is_primary("t.artist"),
    );
    let mut disc_stmt = connection.prepare(&disc_sql)?;

    let disc_rows = disc_stmt.query_map(params![artist_name], |row| {
        let title: String = row.get(0)?;
        let id = AlbumLookupKey::new(&title, Some(artist_name)).encode();
        Ok(DiscographyAlbum {
            id,
            title,
            year: row.get(3)?,
            track_count: row.get::<_, i64>(1)? as usize,
            artwork_key: row.get(2)?,
            kind: DiscographyItemKind::Album,
        })
    })?;

    let mut albums: Vec<DiscographyAlbum> = Vec::new();
    for row in disc_rows {
        albums.push(row?);
    }

    // Concept albums attributed to this artist (>1 track)
    {
        let mut concept_stmt = connection.prepare(
            "
            SELECT
              ca.id,
              ca.title,
              ca.artwork_key,
              COUNT(cae.id) AS entry_count
            FROM concept_albums ca
            LEFT JOIN concept_album_entries cae ON cae.concept_album_id = ca.id
            WHERE lower(COALESCE(ca.artist, '')) = lower(?1)
            GROUP BY ca.id
            HAVING COUNT(cae.id) > 1
            ",
        )?;
        let rows = concept_stmt.query_map(params![artist_name], |row| {
            Ok(DiscographyAlbum {
                id: row.get(0)?,
                title: row.get(1)?,
                year: None,
                artwork_key: row.get(2)?,
                track_count: row.get::<_, i64>(3)? as usize,
                kind: DiscographyItemKind::ConceptAlbum,
            })
        })?;
        for row in rows {
            albums.push(row?);
        }
    }

    // Sort by year DESC, nulls last
    albums.sort_by(|a, b| match (a.year, b.year) {
        (Some(ay), Some(by)) => by.cmp(&ay),
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, None) => std::cmp::Ordering::Equal,
    });

    // Featured on: albums where artist appears as a feature AND has no primary tracks (>1 track total)
    let feat_sql = format!(
        "
        SELECT
          COALESCE(t.album, '') AS title,
          COUNT(*) AS artist_track_count,
          MAX(t.artwork_key) AS artwork_key,
          (
            SELECT t2.artist FROM tracks t2
            WHERE COALESCE(t2.album, '') = COALESCE(t.album, '')
              AND t2.artist IS NOT NULL
            GROUP BY t2.artist
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) AS primary_artist,
          (
            SELECT COUNT(*) FROM tracks t3
            WHERE COALESCE(t3.album, '') = COALESCE(t.album, '')
          ) AS total_track_count
        FROM tracks t
        WHERE {feature} AND t.album IS NOT NULL
        GROUP BY COALESCE(t.album, '')
        HAVING NOT EXISTS (
          SELECT 1 FROM tracks t2
          WHERE {primary_t2} AND COALESCE(t2.album, '') = COALESCE(t.album, '')
        )
        AND (
          SELECT COUNT(*) FROM tracks t3
          WHERE COALESCE(t3.album, '') = COALESCE(t.album, '')
        ) > 1
        ORDER BY lower(COALESCE(t.album, '')) ASC
        ",
        feature = is_feature("t.artist"),
        primary_t2 = is_primary("t2.artist"),
    );
    let mut feat_stmt = connection.prepare(&feat_sql)?;

    let feat_rows = feat_stmt.query_map(params![artist_name], |row| {
        let title: String = row.get(0)?;
        let primary_artist: Option<String> = row.get(3)?;
        let id = AlbumLookupKey::new(&title, primary_artist.as_deref()).encode();
        Ok(DiscographyAlbum {
            id,
            title,
            year: None,
            track_count: row.get::<_, i64>(1)? as usize,
            artwork_key: row.get(2)?,
            kind: DiscographyItemKind::Album,
        })
    })?;

    let mut features = Vec::new();
    for row in feat_rows {
        features.push(row?);
    }

    // Appears on: playlists containing any track by this artist (primary or feature), with >1 entry total
    let pl_sql = format!(
        "
        SELECT DISTINCT p.id, p.name, p.artwork_key
        FROM playlists p
        JOIN playlist_entries pe ON p.id = pe.playlist_id
        JOIN tracks t ON pe.track_id = t.id
        WHERE ({primary} OR ({feature}))
          AND (SELECT COUNT(*) FROM playlist_entries pe2 WHERE pe2.playlist_id = p.id) > 1
        ORDER BY lower(p.name)
        ",
        primary = is_primary("t.artist"),
        feature = is_feature("t.artist"),
    );
    let mut pl_stmt = connection.prepare(&pl_sql)?;

    let pl_rows = pl_stmt.query_map(params![artist_name], |row| {
        Ok(ArtistPlaylistItem {
            id: row.get(0)?,
            title: row.get(1)?,
            artwork_key: row.get(2)?,
        })
    })?;

    let mut playlists = Vec::new();
    for row in pl_rows {
        playlists.push(row?);
    }

    Ok(Some(ArtistDetail {
        name: artist_name.to_owned(),
        albums,
        features,
        playlists,
        track_count: track_count as usize,
        image_config: None,
    }))
}

pub(crate) fn query_artists_images_dir(
    connection: &rusqlite::Connection,
) -> Result<Option<String>, ScanError> {
    query_setting(connection, "artists_images_dir")
}

pub(crate) fn upsert_artists_images_dir(
    connection: &rusqlite::Connection,
    dir_path: &str,
) -> Result<(), ScanError> {
    upsert_setting(connection, "artists_images_dir", dir_path)
}

pub(crate) fn query_artists_profile_images_dir(
    connection: &rusqlite::Connection,
) -> Result<Option<String>, ScanError> {
    query_setting(connection, "artists_profile_images_dir")
}

pub(crate) fn upsert_artists_profile_images_dir(
    connection: &rusqlite::Connection,
    dir_path: &str,
) -> Result<(), ScanError> {
    upsert_setting(connection, "artists_profile_images_dir", dir_path)
}

fn query_setting(
    connection: &rusqlite::Connection,
    key: &str,
) -> Result<Option<String>, ScanError> {
    match connection.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    ) {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(ScanError::Sqlite(e)),
    }
}

fn upsert_setting(
    connection: &rusqlite::Connection,
    key: &str,
    value: &str,
) -> Result<(), ScanError> {
    connection.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}
