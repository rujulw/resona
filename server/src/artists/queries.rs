use rusqlite::params;

use crate::library::models::{
    ArtistDetail, ArtistImageConfig, ArtistListItem, DiscographyAlbum, ScanError,
};

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
    let track_count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM tracks WHERE artist = ?1",
        params![artist_name],
        |row| row.get(0),
    )?;

    if track_count == 0 {
        return Ok(None);
    }

    let mut statement = connection.prepare(
        "
        SELECT
          COALESCE(album, '') AS title,
          COUNT(*) AS track_count,
          MAX(artwork_key) AS artwork_key
        FROM tracks
        WHERE artist = ?1
        GROUP BY COALESCE(album, '')
        ORDER BY lower(COALESCE(album, '')) ASC
        ",
    )?;

    let rows = statement.query_map(params![artist_name], |row| {
        Ok(DiscographyAlbum {
            title: row.get(0)?,
            year: None,
            track_count: row.get::<_, i64>(1)? as usize,
            artwork_key: row.get(2)?,
        })
    })?;

    let mut albums = Vec::new();
    for row in rows {
        albums.push(row?);
    }

    let image_config = query_artist_image_config(connection, artist_name)?;

    Ok(Some(ArtistDetail {
        name: artist_name.to_owned(),
        albums,
        track_count: track_count as usize,
        image_config,
    }))
}

pub(crate) fn query_artist_image_config(
    connection: &rusqlite::Connection,
    artist_name: &str,
) -> Result<Option<ArtistImageConfig>, ScanError> {
    match connection.query_row(
        "SELECT local_image_path FROM artist_image_configs WHERE artist_name = ?1",
        params![artist_name],
        |row| row.get::<_, String>(0),
    ) {
        Ok(local_image_path) => Ok(Some(ArtistImageConfig {
            artist_name: artist_name.to_owned(),
            local_image_path,
        })),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(ScanError::Sqlite(e)),
    }
}

pub(crate) fn upsert_artist_image_config(
    connection: &rusqlite::Connection,
    artist_name: &str,
    local_image_path: &str,
) -> Result<(), ScanError> {
    connection.execute(
        "
        INSERT INTO artist_image_configs (artist_name, local_image_path, updated_at)
        VALUES (?1, ?2, datetime('now'))
        ON CONFLICT(artist_name) DO UPDATE SET
          local_image_path = excluded.local_image_path,
          updated_at = excluded.updated_at
        ",
        params![artist_name, local_image_path],
    )?;
    Ok(())
}
