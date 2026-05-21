use rusqlite::params;

use super::artwork::{import_concept_album_artwork, remove_concept_album_artwork};
use super::queries::{
    generated_identifier, load_concept_album_detail, load_concept_album_summary,
    load_concept_albums, normalize_optional_text, set_concept_album_hidden, timestamp_now,
};
use super::types::{ConceptAlbumDetail, ConceptAlbumError, ConceptAlbumSummary};
use super::ConceptAlbumStore;

impl ConceptAlbumStore {
    pub fn list_concept_albums(&self) -> Result<Vec<ConceptAlbumSummary>, ConceptAlbumError> {
        let connection = self.app_database.connect()?;
        load_concept_albums(&connection)
    }

    pub fn get_concept_album(
        &self,
        concept_album_id: &str,
    ) -> Result<Option<ConceptAlbumDetail>, ConceptAlbumError> {
        let connection = self.app_database.connect()?;
        load_concept_album_detail(&connection, concept_album_id)
    }

    pub fn create_concept_album(
        &self,
        title: &str,
        artist: Option<&str>,
        description: Option<&str>,
        artwork_path: Option<&str>,
    ) -> Result<ConceptAlbumSummary, ConceptAlbumError> {
        let normalized_title = normalize_title(title)?;
        let normalized_artist = normalize_optional_text(artist);
        let normalized_description = normalize_optional_text(description);
        let now = timestamp_now();
        let concept_album_id = generated_identifier("concept-album", &normalized_title);
        let artwork_key =
            import_concept_album_artwork(self.app_database.app_data_dir(), artwork_path)?;
        let connection = self.app_database.connect()?;

        connection.execute(
            "
            INSERT INTO concept_albums (
              id, title, artist, description, artwork_key, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
            ",
            params![
                concept_album_id,
                normalized_title,
                normalized_artist,
                normalized_description,
                artwork_key,
                now
            ],
        )?;

        load_concept_album_summary(&connection, &concept_album_id)?.ok_or_else(|| {
            ConceptAlbumError::NotFound(
                "concept album was created but could not be reloaded".to_owned(),
            )
        })
    }

    pub fn update_concept_album(
        &self,
        concept_album_id: &str,
        title: &str,
        artist: Option<&str>,
        description: Option<&str>,
        artwork_path: Option<&str>,
    ) -> Result<ConceptAlbumSummary, ConceptAlbumError> {
        let normalized_title = normalize_title(title)?;
        let normalized_artist = normalize_optional_text(artist);
        let normalized_description = normalize_optional_text(description);
        let now = timestamp_now();
        let connection = self.app_database.connect()?;
        let existing_artwork_key = load_concept_album_summary(&connection, concept_album_id)?
            .ok_or_else(|| {
                ConceptAlbumError::NotFound(format!(
                    "concept album {concept_album_id} was not found"
                ))
            })?
            .artwork_key;
        let next_artwork_key = if artwork_path.is_some() {
            let next_artwork_key =
                import_concept_album_artwork(self.app_database.app_data_dir(), artwork_path)?;
            remove_concept_album_artwork(
                self.app_database.app_data_dir(),
                existing_artwork_key.as_deref(),
            )?;
            next_artwork_key
        } else {
            existing_artwork_key
        };

        let updated = connection.execute(
            "
            UPDATE concept_albums
            SET title = ?2, artist = ?3, description = ?4, artwork_key = ?5, updated_at = ?6
            WHERE id = ?1
            ",
            params![
                concept_album_id,
                normalized_title,
                normalized_artist,
                normalized_description,
                next_artwork_key,
                now
            ],
        )?;

        if updated == 0 {
            return Err(ConceptAlbumError::NotFound(format!(
                "concept album {concept_album_id} was not found"
            )));
        }

        load_concept_album_summary(&connection, concept_album_id)?.ok_or_else(|| {
            ConceptAlbumError::NotFound(format!(
                "concept album {concept_album_id} disappeared after update"
            ))
        })
    }

    pub fn set_hidden(
        &self,
        concept_album_id: &str,
        hidden: bool,
    ) -> Result<(), ConceptAlbumError> {
        let connection = self.app_database.connect()?;
        set_concept_album_hidden(&connection, concept_album_id, hidden)
    }

    pub fn delete_concept_album(&self, concept_album_id: &str) -> Result<(), ConceptAlbumError> {
        let connection = self.app_database.connect()?;
        let existing_artwork_key = load_concept_album_summary(&connection, concept_album_id)?
            .ok_or_else(|| {
                ConceptAlbumError::NotFound(format!(
                    "concept album {concept_album_id} was not found"
                ))
            })?
            .artwork_key;
        let deleted = connection.execute(
            "DELETE FROM concept_albums WHERE id = ?1",
            [concept_album_id],
        )?;

        if deleted == 0 {
            return Err(ConceptAlbumError::NotFound(format!(
                "concept album {concept_album_id} was not found"
            )));
        }

        remove_concept_album_artwork(
            self.app_database.app_data_dir(),
            existing_artwork_key.as_deref(),
        )?;
        Ok(())
    }
}

fn normalize_title(title: &str) -> Result<String, ConceptAlbumError> {
    let normalized = title.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        Err(ConceptAlbumError::InvalidInput(
            "concept album title must contain visible characters".to_owned(),
        ))
    } else {
        Ok(normalized)
    }
}
