use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension, Transaction};
use sha2::{Digest, Sha256};

use super::types::{
    PlaylistDetail, PlaylistEntryItem, PlaylistEntryRecord, PlaylistError, PlaylistSummary,
};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

pub(super) fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value.and_then(|text| {
        let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    })
}

pub(super) fn timestamp_now() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_secs()
        .to_string()
}

pub(super) fn generated_identifier(namespace: &str, seed: &str) -> String {
    let counter = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();

    let mut hasher = Sha256::new();
    hasher.update(namespace.as_bytes());
    hasher.update([0]);
    hasher.update(seed.as_bytes());
    hasher.update([0]);
    hasher.update(nanos.to_string().as_bytes());
    hasher.update([0]);
    hasher.update(counter.to_string().as_bytes());
    format!("{namespace}-{:x}", hasher.finalize())
}

pub(super) fn load_playlists(
    connection: &rusqlite::Connection,
) -> Result<Vec<PlaylistSummary>, PlaylistError> {
    let mut statement = connection.prepare(
        "
        SELECT
          playlists.id,
          playlists.name,
          playlists.description,
          playlists.artwork_key,
          playlists.created_at,
          playlists.updated_at,
          COUNT(playlist_entries.id) AS entry_count
        FROM playlists
        LEFT JOIN playlist_entries ON playlist_entries.playlist_id = playlists.id
        GROUP BY
          playlists.id,
          playlists.name,
          playlists.description,
          playlists.artwork_key,
          playlists.created_at,
          playlists.updated_at
        ORDER BY lower(playlists.name) ASC, playlists.created_at ASC
        ",
    )?;

    let rows = statement.query_map([], |row| {
        Ok(PlaylistSummary {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            artwork_key: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            entry_count: row.get::<_, i64>(6)? as usize,
        })
    })?;

    let mut playlists = Vec::new();
    for row in rows {
        playlists.push(row?);
    }

    Ok(playlists)
}

pub(super) fn load_playlist_summary(
    connection: &rusqlite::Connection,
    playlist_id: &str,
) -> Result<Option<PlaylistSummary>, PlaylistError> {
    connection
        .query_row(
            "
            SELECT
              playlists.id,
              playlists.name,
              playlists.description,
              playlists.artwork_key,
              playlists.created_at,
              playlists.updated_at,
              COUNT(playlist_entries.id) AS entry_count
            FROM playlists
            LEFT JOIN playlist_entries ON playlist_entries.playlist_id = playlists.id
            WHERE playlists.id = ?1
            GROUP BY
              playlists.id,
              playlists.name,
              playlists.description,
              playlists.artwork_key,
              playlists.created_at,
              playlists.updated_at
            ",
            [playlist_id],
            |row| {
                Ok(PlaylistSummary {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    artwork_key: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    entry_count: row.get::<_, i64>(6)? as usize,
                })
            },
        )
        .optional()
        .map_err(PlaylistError::from)
}

pub(super) fn load_playlist_detail(
    connection: &rusqlite::Connection,
    playlist_id: &str,
) -> Result<Option<PlaylistDetail>, PlaylistError> {
    let Some(playlist) = load_playlist_summary(connection, playlist_id)? else {
        return Ok(None);
    };

    let mut statement = connection.prepare(
        "
        SELECT
          playlist_entries.id,
          playlist_entries.playlist_id,
          playlist_entries.track_id,
          playlist_entries.position,
          playlist_entries.added_at,
          playlist_entries.updated_at,
          tracks.title,
          tracks.artist,
          tracks.album,
          tracks.advisory,
          tracks.artwork_key,
          tracks.extension,
          tracks.duration_seconds
        FROM playlist_entries
        INNER JOIN tracks ON tracks.id = playlist_entries.track_id
        WHERE playlist_entries.playlist_id = ?1
        ORDER BY playlist_entries.position ASC, playlist_entries.id ASC
        ",
    )?;

    let rows = statement.query_map([playlist_id], |row| {
        Ok(PlaylistEntryItem {
            entry_id: row.get(0)?,
            playlist_id: row.get(1)?,
            track_id: row.get(2)?,
            position: row.get::<_, i64>(3)? as usize,
            added_at: row.get(4)?,
            updated_at: row.get(5)?,
            title: row.get(6)?,
            artist: row.get(7)?,
            album: row.get(8)?,
            advisory: row.get(9)?,
            artwork_key: row.get(10)?,
            extension: row.get(11)?,
            duration_seconds: row.get(12)?,
        })
    })?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(row?);
    }

    Ok(Some(PlaylistDetail { playlist, entries }))
}

pub(super) fn ensure_playlist_exists(
    transaction: &Transaction<'_>,
    playlist_id: &str,
) -> Result<(), PlaylistError> {
    let exists = transaction.query_row(
        "SELECT EXISTS(SELECT 1 FROM playlists WHERE id = ?1)",
        [playlist_id],
        |row| row.get::<_, i64>(0),
    )?;

    if exists == 0 {
        Err(PlaylistError::NotFound(format!(
            "playlist {playlist_id} was not found"
        )))
    } else {
        Ok(())
    }
}

pub(super) fn ensure_track_exists(
    transaction: &Transaction<'_>,
    track_id: &str,
) -> Result<(), PlaylistError> {
    let exists = transaction.query_row(
        "SELECT EXISTS(SELECT 1 FROM tracks WHERE id = ?1)",
        [track_id],
        |row| row.get::<_, i64>(0),
    )?;

    if exists == 0 {
        Err(PlaylistError::NotFound(format!(
            "track {track_id} was not found"
        )))
    } else {
        Ok(())
    }
}

pub(super) fn load_entry_ids_in_order(
    transaction: &Transaction<'_>,
    playlist_id: &str,
) -> Result<Vec<String>, PlaylistError> {
    let mut statement = transaction.prepare(
        "
        SELECT id
        FROM playlist_entries
        WHERE playlist_id = ?1
        ORDER BY position ASC, id ASC
        ",
    )?;

    let rows = statement.query_map([playlist_id], |row| row.get::<_, String>(0))?;
    let mut entry_ids = Vec::new();
    for row in rows {
        entry_ids.push(row?);
    }
    Ok(entry_ids)
}

pub(super) fn rewrite_positions(
    transaction: &Transaction<'_>,
    playlist_id: &str,
    ordered_entry_ids: &[String],
) -> Result<(), PlaylistError> {
    let offset = ordered_entry_ids.len() as i64 + 1;
    transaction.execute(
        "
        UPDATE playlist_entries
        SET position = position + ?2
        WHERE playlist_id = ?1
        ",
        params![playlist_id, offset],
    )?;

    let now = timestamp_now();
    for (position, entry_id) in ordered_entry_ids.iter().enumerate() {
        transaction.execute(
            "
            UPDATE playlist_entries
            SET position = ?3, updated_at = ?4
            WHERE playlist_id = ?1 AND id = ?2
            ",
            params![playlist_id, entry_id, position as i64, now],
        )?;
    }

    Ok(())
}

pub(super) fn touch_playlist(
    transaction: &Transaction<'_>,
    playlist_id: &str,
) -> Result<(), PlaylistError> {
    transaction.execute(
        "UPDATE playlists SET updated_at = ?2 WHERE id = ?1",
        params![playlist_id, timestamp_now()],
    )?;
    Ok(())
}

pub(super) fn validate_entry_positions(
    entries: &[PlaylistEntryRecord],
) -> Result<(), PlaylistError> {
    let mut positions = entries
        .iter()
        .map(|entry| entry.position)
        .collect::<Vec<_>>();
    positions.sort_unstable();
    for (expected, actual) in positions.into_iter().enumerate() {
        if expected != actual {
            return Err(PlaylistError::InvalidInput(
                "playlist entry positions must be dense and zero-based".to_owned(),
            ));
        }
    }
    Ok(())
}
