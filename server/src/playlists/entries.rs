use rusqlite::{params, OptionalExtension};

use super::queries::{
    ensure_playlist_exists, ensure_track_exists, generated_identifier, load_entry_ids_in_order,
    rewrite_positions, timestamp_now, touch_playlist, validate_entry_positions,
};
use super::types::{PlaylistDetail, PlaylistEntryRecord, PlaylistError, PlaylistQueueHandoff};
use super::PlaylistStore;

impl PlaylistStore {
    pub fn append_track(
        &self,
        playlist_id: &str,
        track_id: &str,
    ) -> Result<PlaylistDetail, PlaylistError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_playlist_exists(&transaction, playlist_id)?;
        ensure_track_exists(&transaction, track_id)?;

        let next_position = load_entry_ids_in_order(&transaction, playlist_id)?.len();
        let now = timestamp_now();
        let entry_id = generated_identifier(
            "playlist-entry",
            &format!("{playlist_id}:{track_id}:{next_position}"),
        );

        transaction.execute(
            "
            INSERT INTO playlist_entries (id, playlist_id, track_id, position, added_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?5)
            ",
            params![entry_id, playlist_id, track_id, next_position as i64, now],
        )?;
        touch_playlist(&transaction, playlist_id)?;
        transaction.commit()?;

        self.get_playlist(playlist_id)?
            .ok_or_else(|| PlaylistError::NotFound(format!("playlist {playlist_id} was not found")))
    }

    pub fn remove_entry(
        &self,
        playlist_id: &str,
        entry_id: &str,
    ) -> Result<PlaylistDetail, PlaylistError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_playlist_exists(&transaction, playlist_id)?;
        let removed_position = transaction
            .query_row(
                "
                SELECT position
                FROM playlist_entries
                WHERE id = ?1 AND playlist_id = ?2
                ",
                params![entry_id, playlist_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()?
            .ok_or_else(|| {
                PlaylistError::NotFound(format!(
                    "playlist entry {entry_id} was not found in playlist {playlist_id}"
                ))
            })?;

        transaction.execute(
            "DELETE FROM playlist_entries WHERE id = ?1 AND playlist_id = ?2",
            params![entry_id, playlist_id],
        )?;
        transaction.execute(
            "
            UPDATE playlist_entries
            SET position = position - 1, updated_at = ?3
            WHERE playlist_id = ?1 AND position > ?2
            ",
            params![playlist_id, removed_position, timestamp_now()],
        )?;
        touch_playlist(&transaction, playlist_id)?;
        transaction.commit()?;

        self.get_playlist(playlist_id)?
            .ok_or_else(|| PlaylistError::NotFound(format!("playlist {playlist_id} was not found")))
    }

    pub fn move_entry(
        &self,
        playlist_id: &str,
        entry_id: &str,
        target_position: usize,
    ) -> Result<PlaylistDetail, PlaylistError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_playlist_exists(&transaction, playlist_id)?;

        let mut entry_ids = load_entry_ids_in_order(&transaction, playlist_id)?;
        let current_index = entry_ids
            .iter()
            .position(|current| current == entry_id)
            .ok_or_else(|| {
                PlaylistError::NotFound(format!(
                    "playlist entry {entry_id} was not found in playlist {playlist_id}"
                ))
            })?;

        if entry_ids.is_empty() {
            return Err(PlaylistError::InvalidInput(format!(
                "playlist {playlist_id} does not contain any entries"
            )));
        }

        let bounded_target = target_position.min(entry_ids.len().saturating_sub(1));
        if current_index != bounded_target {
            let moved = entry_ids.remove(current_index);
            entry_ids.insert(bounded_target, moved);
            rewrite_positions(&transaction, playlist_id, &entry_ids)?;
            touch_playlist(&transaction, playlist_id)?;
        }
        transaction.commit()?;

        self.get_playlist(playlist_id)?
            .ok_or_else(|| PlaylistError::NotFound(format!("playlist {playlist_id} was not found")))
    }

    pub fn replace_entries(
        &self,
        playlist_id: &str,
        entries: &[PlaylistEntryRecord],
    ) -> Result<PlaylistDetail, PlaylistError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_playlist_exists(&transaction, playlist_id)?;
        validate_entry_positions(entries)?;

        transaction.execute(
            "DELETE FROM playlist_entries WHERE playlist_id = ?1",
            [playlist_id],
        )?;

        let now = timestamp_now();
        for entry in entries {
            ensure_track_exists(&transaction, &entry.track_id)?;
            let entry_id = if entry.entry_id.is_empty() {
                generated_identifier(
                    "playlist-entry",
                    &format!("{playlist_id}:{}:{}", entry.track_id, entry.position),
                )
            } else {
                entry.entry_id.clone()
            };

            transaction.execute(
                "
                INSERT INTO playlist_entries (id, playlist_id, track_id, position, added_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?5)
                ",
                params![
                    entry_id,
                    playlist_id,
                    entry.track_id,
                    entry.position as i64,
                    now
                ],
            )?;
        }

        touch_playlist(&transaction, playlist_id)?;
        transaction.commit()?;

        self.get_playlist(playlist_id)?
            .ok_or_else(|| PlaylistError::NotFound(format!("playlist {playlist_id} was not found")))
    }

    pub fn build_queue_handoff(
        &self,
        playlist_id: &str,
        start_entry_id: Option<&str>,
    ) -> Result<PlaylistQueueHandoff, PlaylistError> {
        let detail = self.get_playlist(playlist_id)?.ok_or_else(|| {
            PlaylistError::NotFound(format!("playlist {playlist_id} was not found"))
        })?;

        if detail.entries.is_empty() {
            return Err(PlaylistError::InvalidInput(format!(
                "playlist {playlist_id} does not contain any entries"
            )));
        }

        let active_entry = match start_entry_id {
            Some(entry_id) => detail
                .entries
                .iter()
                .find(|entry| entry.entry_id == entry_id)
                .ok_or_else(|| {
                    PlaylistError::NotFound(format!(
                        "playlist entry {entry_id} was not found in playlist {playlist_id}"
                    ))
                })?,
            None => detail
                .entries
                .first()
                .expect("entries should not be empty after guard"),
        };

        Ok(PlaylistQueueHandoff {
            playlist_id: playlist_id.to_owned(),
            track_ids: detail
                .entries
                .iter()
                .map(|entry| entry.track_id.clone())
                .collect(),
            active_track_id: active_entry.track_id.clone(),
            active_entry_id: active_entry.entry_id.clone(),
        })
    }
}
