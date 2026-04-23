use rusqlite::params;

use super::queries::{ensure_playlist_exists, load_playlist_summary, timestamp_now, touch_playlist};
use super::types::{PlaylistError, PlaylistSummary};
use super::PlaylistStore;

impl PlaylistStore {
    pub fn turn_to_mixtape(&self, playlist_id: &str) -> Result<PlaylistSummary, PlaylistError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_playlist_exists(&transaction, playlist_id)?;

        let now = timestamp_now();
        transaction.execute(
            "
            UPDATE playlists
            SET is_mixtape = 1, updated_at = ?2
            WHERE id = ?1
            ",
            params![playlist_id, now],
        )?;

        touch_playlist(&transaction, playlist_id)?;
        transaction.commit()?;

        let summary = load_playlist_summary(&connection, playlist_id)?
            .ok_or_else(|| PlaylistError::NotFound(format!("playlist {playlist_id} was not found after update")))?;
        
        Ok(summary)
    }
}
