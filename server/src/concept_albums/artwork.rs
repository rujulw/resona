use std::fs;
use std::path::Path;

use super::queries::{generated_identifier, normalize_optional_text};
use super::types::ConceptAlbumError;

pub fn import_concept_album_artwork(
    app_data_dir: &Path,
    artwork_path: Option<&str>,
) -> Result<Option<String>, ConceptAlbumError> {
    let Some(artwork_path) = normalize_optional_text(artwork_path) else {
        return Ok(None);
    };
    let source_path = Path::new(&artwork_path);
    if !source_path.exists() {
        return Err(ConceptAlbumError::InvalidInput(format!(
            "concept album artwork source {artwork_path} was not found"
        )));
    }

    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "img".to_owned());
    let artwork_key = format!(
        "{}.{}",
        generated_identifier("concept-album-artwork", &artwork_path),
        extension
    );
    let artwork_dir = app_data_dir.join("artwork");
    fs::create_dir_all(&artwork_dir)?;
    fs::copy(source_path, artwork_dir.join(&artwork_key))?;
    Ok(Some(artwork_key))
}

pub fn remove_concept_album_artwork(
    app_data_dir: &Path,
    artwork_key: Option<&str>,
) -> Result<(), ConceptAlbumError> {
    if let Some(artwork_key) = artwork_key {
        let artwork_path = app_data_dir.join("artwork").join(artwork_key);
        if artwork_path.exists() {
            fs::remove_file(artwork_path)?;
        }
    }

    Ok(())
}
