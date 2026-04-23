use rusqlite::params;

use super::artwork::{import_playlist_artwork, remove_playlist_artwork};
use super::queries::{
    generated_identifier, load_playlist_detail, load_playlist_summary, load_playlists,
    normalize_optional_text, timestamp_now,
};
use super::types::{PlaylistDetail, PlaylistError, PlaylistSummary};
use super::PlaylistStore;

impl PlaylistStore {
    pub fn list_playlists(&self) -> Result<Vec<PlaylistSummary>, PlaylistError> {
        let connection = self.app_database.connect()?;
        load_playlists(&connection)
    }

    pub fn get_playlist(&self, playlist_id: &str) -> Result<Option<PlaylistDetail>, PlaylistError> {
        let connection = self.app_database.connect()?;
        load_playlist_detail(&connection, playlist_id)
    }

    pub fn create_playlist(
        &self,
        name: &str,
        description: Option<&str>,
        artwork_path: Option<&str>,
    ) -> Result<PlaylistSummary, PlaylistError> {
        let normalized_name = normalize_playlist_name(name)?;
        let normalized_description = normalize_optional_text(description);
        let now = timestamp_now();
        let playlist_id = generated_identifier("playlist", &normalized_name);
        let artwork_key = import_playlist_artwork(self.app_database.app_data_dir(), artwork_path)?;
        let connection = self.app_database.connect()?;

        connection.execute(
            "
            INSERT INTO playlists (id, name, description, artwork_key, is_mixtape, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, 0, ?5, ?5)
            ",
            params![
                playlist_id,
                normalized_name,
                normalized_description,
                artwork_key,
                now
            ],
        )?;

        load_playlist_summary(&connection, &playlist_id)?.ok_or_else(|| {
            PlaylistError::NotFound("playlist was created but could not be reloaded".to_owned())
        })
    }

    pub fn update_playlist(
        &self,
        playlist_id: &str,
        name: &str,
        description: Option<&str>,
        artwork_path: Option<&str>,
    ) -> Result<PlaylistSummary, PlaylistError> {
        let normalized_name = normalize_playlist_name(name)?;
        let normalized_description = normalize_optional_text(description);
        let now = timestamp_now();
        let connection = self.app_database.connect()?;
        let existing_artwork_key = load_playlist_summary(&connection, playlist_id)?
            .ok_or_else(|| {
                PlaylistError::NotFound(format!("playlist {playlist_id} was not found"))
            })?
            .artwork_key;
        let next_artwork_key = if artwork_path.is_some() {
            let next_artwork_key =
                import_playlist_artwork(self.app_database.app_data_dir(), artwork_path)?;
            remove_playlist_artwork(
                self.app_database.app_data_dir(),
                existing_artwork_key.as_deref(),
            )?;
            next_artwork_key
        } else {
            existing_artwork_key
        };
        let updated = connection.execute(
            "
            UPDATE playlists
            SET name = ?2, description = ?3, artwork_key = ?4, updated_at = ?5
            WHERE id = ?1
            ",
            params![
                playlist_id,
                normalized_name,
                normalized_description,
                next_artwork_key,
                now
            ],
        )?;

        if updated == 0 {
            return Err(PlaylistError::NotFound(format!(
                "playlist {playlist_id} was not found"
            )));
        }

        load_playlist_summary(&connection, playlist_id)?.ok_or_else(|| {
            PlaylistError::NotFound(format!("playlist {playlist_id} disappeared after update"))
        })
    }

    pub fn delete_playlist(&self, playlist_id: &str) -> Result<(), PlaylistError> {
        let connection = self.app_database.connect()?;
        let existing_artwork_key = load_playlist_summary(&connection, playlist_id)?
            .ok_or_else(|| {
                PlaylistError::NotFound(format!("playlist {playlist_id} was not found"))
            })?
            .artwork_key;
        let deleted = connection.execute("DELETE FROM playlists WHERE id = ?1", [playlist_id])?;

        if deleted == 0 {
            return Err(PlaylistError::NotFound(format!(
                "playlist {playlist_id} was not found"
            )));
        }

        remove_playlist_artwork(
            self.app_database.app_data_dir(),
            existing_artwork_key.as_deref(),
        )?;
        Ok(())
    }
}

fn normalize_playlist_name(name: &str) -> Result<String, PlaylistError> {
    let normalized = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        Err(PlaylistError::InvalidInput(
            "playlist name must contain visible characters".to_owned(),
        ))
    } else {
        Ok(normalized)
    }
}
