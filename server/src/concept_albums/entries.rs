use rusqlite::{params, OptionalExtension};

use super::queries::{
    ensure_concept_album_exists, ensure_track_exists, generated_identifier,
    load_entry_ids_in_order, rewrite_positions, timestamp_now, touch_concept_album,
    validate_entry_positions,
};
use super::types::{ConceptAlbumDetail, ConceptAlbumEntryRecord, ConceptAlbumError};
use super::ConceptAlbumStore;

impl ConceptAlbumStore {
    pub fn append_track(
        &self,
        concept_album_id: &str,
        track_id: &str,
    ) -> Result<ConceptAlbumDetail, ConceptAlbumError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_concept_album_exists(&transaction, concept_album_id)?;
        ensure_track_exists(&transaction, track_id)?;

        let next_position = load_entry_ids_in_order(&transaction, concept_album_id)?.len();
        let now = timestamp_now();
        let entry_id = generated_identifier(
            "concept-album-entry",
            &format!("{concept_album_id}:{track_id}:{next_position}"),
        );

        transaction.execute(
            "
            INSERT INTO concept_album_entries (
              id, concept_album_id, track_id, position, added_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?5)
            ",
            params![
                entry_id,
                concept_album_id,
                track_id,
                next_position as i64,
                now
            ],
        )?;
        touch_concept_album(&transaction, concept_album_id)?;
        transaction.commit()?;

        self.get_concept_album(concept_album_id)?.ok_or_else(|| {
            ConceptAlbumError::NotFound(format!("concept album {concept_album_id} was not found"))
        })
    }

    pub fn remove_entry(
        &self,
        concept_album_id: &str,
        entry_id: &str,
    ) -> Result<ConceptAlbumDetail, ConceptAlbumError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_concept_album_exists(&transaction, concept_album_id)?;
        let removed_position = transaction
            .query_row(
                "
                SELECT position
                FROM concept_album_entries
                WHERE id = ?1 AND concept_album_id = ?2
                ",
                params![entry_id, concept_album_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()?
            .ok_or_else(|| {
                ConceptAlbumError::NotFound(format!(
                    "concept album entry {entry_id} was not found in concept album {concept_album_id}"
                ))
            })?;

        transaction.execute(
            "DELETE FROM concept_album_entries WHERE id = ?1 AND concept_album_id = ?2",
            params![entry_id, concept_album_id],
        )?;
        transaction.execute(
            "
            UPDATE concept_album_entries
            SET position = position - 1, updated_at = ?3
            WHERE concept_album_id = ?1 AND position > ?2
            ",
            params![concept_album_id, removed_position, timestamp_now()],
        )?;
        touch_concept_album(&transaction, concept_album_id)?;
        transaction.commit()?;

        self.get_concept_album(concept_album_id)?.ok_or_else(|| {
            ConceptAlbumError::NotFound(format!("concept album {concept_album_id} was not found"))
        })
    }

    pub fn move_entry(
        &self,
        concept_album_id: &str,
        entry_id: &str,
        target_position: usize,
    ) -> Result<ConceptAlbumDetail, ConceptAlbumError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_concept_album_exists(&transaction, concept_album_id)?;

        let mut entry_ids = load_entry_ids_in_order(&transaction, concept_album_id)?;
        let current_index = entry_ids
            .iter()
            .position(|current| current == entry_id)
            .ok_or_else(|| {
                ConceptAlbumError::NotFound(format!(
                    "concept album entry {entry_id} was not found in concept album {concept_album_id}"
                ))
            })?;

        if entry_ids.is_empty() {
            return Err(ConceptAlbumError::InvalidInput(format!(
                "concept album {concept_album_id} does not contain any entries"
            )));
        }

        let bounded_target = target_position.min(entry_ids.len().saturating_sub(1));
        if current_index != bounded_target {
            let moved = entry_ids.remove(current_index);
            entry_ids.insert(bounded_target, moved);
            rewrite_positions(&transaction, concept_album_id, &entry_ids)?;
            touch_concept_album(&transaction, concept_album_id)?;
        }
        transaction.commit()?;

        self.get_concept_album(concept_album_id)?.ok_or_else(|| {
            ConceptAlbumError::NotFound(format!("concept album {concept_album_id} was not found"))
        })
    }

    pub fn replace_entries(
        &self,
        concept_album_id: &str,
        entries: &[ConceptAlbumEntryRecord],
    ) -> Result<ConceptAlbumDetail, ConceptAlbumError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_concept_album_exists(&transaction, concept_album_id)?;
        validate_entry_positions(entries)?;

        transaction.execute(
            "DELETE FROM concept_album_entries WHERE concept_album_id = ?1",
            [concept_album_id],
        )?;

        let now = timestamp_now();
        for entry in entries {
            ensure_track_exists(&transaction, &entry.track_id)?;
            let entry_id = if entry.entry_id.is_empty() {
                generated_identifier(
                    "concept-album-entry",
                    &format!("{concept_album_id}:{}:{}", entry.track_id, entry.position),
                )
            } else {
                entry.entry_id.clone()
            };

            transaction.execute(
                "
                INSERT INTO concept_album_entries (
                  id, concept_album_id, track_id, position, added_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?5)
                ",
                params![
                    entry_id,
                    concept_album_id,
                    entry.track_id,
                    entry.position as i64,
                    now
                ],
            )?;
        }

        touch_concept_album(&transaction, concept_album_id)?;
        transaction.commit()?;

        self.get_concept_album(concept_album_id)?.ok_or_else(|| {
            ConceptAlbumError::NotFound(format!("concept album {concept_album_id} was not found"))
        })
    }
}
