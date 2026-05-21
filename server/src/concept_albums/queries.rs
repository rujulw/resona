use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension, Transaction};
use sha2::{Digest, Sha256};

use super::types::{
    ConceptAlbumDetail, ConceptAlbumEntryItem, ConceptAlbumEntryRecord, ConceptAlbumError,
    ConceptAlbumSummary,
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

pub(super) fn load_concept_albums(
    connection: &rusqlite::Connection,
) -> Result<Vec<ConceptAlbumSummary>, ConceptAlbumError> {
    let mut statement = connection.prepare(
        "
        SELECT
          concept_albums.id,
          concept_albums.title,
          concept_albums.artist,
          concept_albums.description,
          concept_albums.artwork_key,
          concept_albums.created_at,
          concept_albums.updated_at,
          COUNT(concept_album_entries.id) AS entry_count
        FROM concept_albums
        LEFT JOIN concept_album_entries
          ON concept_album_entries.concept_album_id = concept_albums.id
        GROUP BY
          concept_albums.id,
          concept_albums.title,
          concept_albums.artist,
          concept_albums.description,
          concept_albums.artwork_key,
          concept_albums.created_at,
          concept_albums.updated_at
        ORDER BY lower(concept_albums.title) ASC, concept_albums.created_at ASC
        ",
    )?;

    let rows = statement.query_map([], |row| {
        Ok(ConceptAlbumSummary {
            id: row.get(0)?,
            title: row.get(1)?,
            artist: row.get(2)?,
            description: row.get(3)?,
            artwork_key: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
            entry_count: row.get::<_, i64>(7)? as usize,
        })
    })?;

    let mut concept_albums = Vec::new();
    for row in rows {
        concept_albums.push(row?);
    }

    Ok(concept_albums)
}

pub(super) fn load_concept_album_summary(
    connection: &rusqlite::Connection,
    concept_album_id: &str,
) -> Result<Option<ConceptAlbumSummary>, ConceptAlbumError> {
    connection
        .query_row(
            "
            SELECT
              concept_albums.id,
              concept_albums.title,
              concept_albums.artist,
              concept_albums.description,
              concept_albums.artwork_key,
              concept_albums.created_at,
              concept_albums.updated_at,
              COUNT(concept_album_entries.id) AS entry_count
            FROM concept_albums
            LEFT JOIN concept_album_entries
              ON concept_album_entries.concept_album_id = concept_albums.id
            WHERE concept_albums.id = ?1
            GROUP BY
              concept_albums.id,
              concept_albums.title,
              concept_albums.artist,
              concept_albums.description,
              concept_albums.artwork_key,
              concept_albums.created_at,
              concept_albums.updated_at
            ",
            [concept_album_id],
            |row| {
                Ok(ConceptAlbumSummary {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    artist: row.get(2)?,
                    description: row.get(3)?,
                    artwork_key: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                    entry_count: row.get::<_, i64>(7)? as usize,
                })
            },
        )
        .optional()
        .map_err(ConceptAlbumError::from)
}

pub(super) fn load_concept_album_detail(
    connection: &rusqlite::Connection,
    concept_album_id: &str,
) -> Result<Option<ConceptAlbumDetail>, ConceptAlbumError> {
    let Some(concept_album) = load_concept_album_summary(connection, concept_album_id)? else {
        return Ok(None);
    };

    let mut statement = connection.prepare(
        "
        SELECT
          concept_album_entries.id,
          concept_album_entries.concept_album_id,
          concept_album_entries.track_id,
          concept_album_entries.position,
          concept_album_entries.added_at,
          concept_album_entries.updated_at,
          tracks.title,
          tracks.artist,
          tracks.album,
          tracks.advisory,
          tracks.artwork_key,
          tracks.extension,
          tracks.duration_seconds,
          tracks.track_number,
          tracks.disc_number
        FROM concept_album_entries
        INNER JOIN tracks ON tracks.id = concept_album_entries.track_id
        WHERE concept_album_entries.concept_album_id = ?1
        ORDER BY concept_album_entries.position ASC, concept_album_entries.id ASC
        ",
    )?;

    let rows = statement.query_map([concept_album_id], |row| {
        Ok(ConceptAlbumEntryItem {
            entry_id: row.get(0)?,
            concept_album_id: row.get(1)?,
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
            track_number: row.get(13)?,
            disc_number: row.get(14)?,
        })
    })?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(row?);
    }

    Ok(Some(ConceptAlbumDetail {
        concept_album,
        entries,
    }))
}

pub(super) fn ensure_concept_album_exists(
    transaction: &Transaction<'_>,
    concept_album_id: &str,
) -> Result<(), ConceptAlbumError> {
    let exists = transaction.query_row(
        "SELECT EXISTS(SELECT 1 FROM concept_albums WHERE id = ?1)",
        [concept_album_id],
        |row| row.get::<_, i64>(0),
    )?;

    if exists == 0 {
        Err(ConceptAlbumError::NotFound(format!(
            "concept album {concept_album_id} was not found"
        )))
    } else {
        Ok(())
    }
}

pub(super) fn ensure_track_exists(
    transaction: &Transaction<'_>,
    track_id: &str,
) -> Result<(), ConceptAlbumError> {
    let exists = transaction.query_row(
        "SELECT EXISTS(SELECT 1 FROM tracks WHERE id = ?1)",
        [track_id],
        |row| row.get::<_, i64>(0),
    )?;

    if exists == 0 {
        Err(ConceptAlbumError::NotFound(format!(
            "track {track_id} was not found"
        )))
    } else {
        Ok(())
    }
}

pub(super) fn load_entry_ids_in_order(
    transaction: &Transaction<'_>,
    concept_album_id: &str,
) -> Result<Vec<String>, ConceptAlbumError> {
    let mut statement = transaction.prepare(
        "
        SELECT id
        FROM concept_album_entries
        WHERE concept_album_id = ?1
        ORDER BY position ASC, id ASC
        ",
    )?;

    let rows = statement.query_map([concept_album_id], |row| row.get::<_, String>(0))?;
    let mut entry_ids = Vec::new();
    for row in rows {
        entry_ids.push(row?);
    }
    Ok(entry_ids)
}

pub(super) fn rewrite_positions(
    transaction: &Transaction<'_>,
    concept_album_id: &str,
    ordered_entry_ids: &[String],
) -> Result<(), ConceptAlbumError> {
    let offset = ordered_entry_ids.len() as i64 + 1;
    let now = timestamp_now();

    transaction.execute(
        "
        UPDATE concept_album_entries
        SET position = position + ?2, updated_at = ?3
        WHERE concept_album_id = ?1
        ",
        params![concept_album_id, offset, now],
    )?;

    for (position, entry_id) in ordered_entry_ids.iter().enumerate() {
        transaction.execute(
            "
            UPDATE concept_album_entries
            SET position = ?3, updated_at = ?4
            WHERE concept_album_id = ?1 AND id = ?2
            ",
            params![concept_album_id, entry_id, position as i64, now],
        )?;
    }

    Ok(())
}

pub(super) fn touch_concept_album(
    transaction: &Transaction<'_>,
    concept_album_id: &str,
) -> Result<(), ConceptAlbumError> {
    transaction.execute(
        "UPDATE concept_albums SET updated_at = ?2 WHERE id = ?1",
        params![concept_album_id, timestamp_now()],
    )?;
    Ok(())
}

pub(super) fn validate_entry_positions(
    entries: &[ConceptAlbumEntryRecord],
) -> Result<(), ConceptAlbumError> {
    for (index, entry) in entries.iter().enumerate() {
        if entry.position != index {
            return Err(ConceptAlbumError::InvalidInput(
                "concept album entries must use dense zero-based positions".to_owned(),
            ));
        }
    }

    Ok(())
}
