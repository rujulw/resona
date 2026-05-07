mod helpers;
mod metadata;

use std::fs;
use std::path::Path;

use super::models::NormalizedTrack;
use super::models::ScanError;

pub(crate) use helpers::{build_library_root, discover_local_audio_files, stable_identifier};

use self::helpers::{build_artwork_key, clean_file_stem, preferred_label};
use self::metadata::read_audio_metadata;

pub(crate) fn normalize_track(
    root_path: &Path,
    file_path: &Path,
    library_root_id: &str,
) -> Result<NormalizedTrack, ScanError> {
    let metadata = fs::metadata(file_path)?;
    let relative_path = file_path
        .strip_prefix(root_path)?
        .to_string_lossy()
        .replace('\\', "/");
    let extension = file_path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .unwrap_or_else(|| "unknown".to_owned());
    let file_name = file_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown.audio")
        .to_owned();
    let file_stem = file_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("unknown");
    let cleaned_file_title = clean_file_stem(file_stem);
    let parent_folder_label = file_path
        .parent()
        .and_then(|parent| parent.strip_prefix(root_path).ok())
        .and_then(|relative_parent| relative_parent.file_name())
        .and_then(|folder| folder.to_str())
        .and_then(|folder| preferred_label(Some(folder), None));
    let metadata_fields = read_audio_metadata(file_path, &extension)?;
    let normalized_title = preferred_label(
        metadata_fields.title.as_deref(),
        Some(cleaned_file_title.as_str()),
    )
    .unwrap_or_else(|| "Unknown Track".to_owned());
    let normalized_album_artist = preferred_label(metadata_fields.album_artist.as_deref(), None);
    let normalized_artist = preferred_label(
        metadata_fields.artist.as_deref(),
        normalized_album_artist.as_deref(),
    );
    let normalized_album = preferred_label(
        metadata_fields.album.as_deref(),
        parent_folder_label.as_deref(),
    );
    let artwork_key = metadata_fields.artwork.as_ref().map(|artwork| {
        build_artwork_key(
            library_root_id,
            &relative_path,
            &artwork.mime_type,
            &artwork.data,
        )
    });
    let artwork_bytes = metadata_fields.artwork.map(|artwork| artwork.data);

    Ok(NormalizedTrack {
        id: stable_identifier("track", &format!("{library_root_id}:{relative_path}")),
        relative_path,
        file_name,
        extension,
        title: normalized_title,
        artist: normalized_artist,
        album: normalized_album,
        album_artist: normalized_album_artist,
        genre: metadata_fields
            .genre
            .as_deref()
            .and_then(|value| preferred_label(Some(value), None)),
        advisory: metadata_fields.advisory,
        track_number: metadata_fields.track_number,
        disc_number: metadata_fields.disc_number,
        duration_seconds: metadata_fields.duration_seconds,
        artwork_key,
        artwork_bytes,
        file_size_bytes: metadata.len() as i64,
        content_hash: stable_identifier("content", &file_path.display().to_string()),
        local_path: file_path.display().to_string(),
        year: metadata_fields.year,
    })
}
