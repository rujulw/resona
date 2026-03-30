use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use id3::{Tag, TagLike};
use sha2::{Digest, Sha256};

use super::models::{LibraryRootRecord, NormalizedTrack, ScanError};

pub(crate) fn build_library_root(
    root_path: &Path,
    display_name: Option<&str>,
) -> LibraryRootRecord {
    let selected_path = root_path.display().to_string();
    let id = stable_identifier("library-root", &selected_path);
    let fallback_name = root_path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("library");

    LibraryRootRecord {
        id,
        display_name: normalize_label(display_name.unwrap_or(fallback_name)),
        selected_path,
    }
}

pub(crate) fn discover_mp3_files(root_path: &Path) -> Result<Vec<PathBuf>, ScanError> {
    let mut stack = vec![root_path.to_path_buf()];
    let mut visited_dirs = HashSet::new();
    let mut files = Vec::new();

    while let Some(current_dir) = stack.pop() {
        let canonical_dir = fs::canonicalize(&current_dir)?;
        if !visited_dirs.insert(canonical_dir.clone()) {
            continue;
        }

        let mut entries = fs::read_dir(&canonical_dir)?
            .filter_map(Result::ok)
            .collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.path());

        for entry in entries.into_iter().rev() {
            let path = entry.path();
            let file_type = entry.file_type()?;

            if file_type.is_dir() {
                stack.push(path);
                continue;
            }

            if file_type.is_file() && is_mp3_file(&path) {
                files.push(path);
            }
        }
    }

    files.sort();
    Ok(files)
}

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
    let file_name = file_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown.mp3")
        .to_owned();
    let tag = Tag::read_from_path(file_path).ok();
    let file_stem = file_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("unknown");

    Ok(NormalizedTrack {
        id: stable_identifier("track", &format!("{library_root_id}:{relative_path}")),
        relative_path,
        file_name,
        extension: "mp3".to_owned(),
        title: normalize_label(
            tag.as_ref()
                .and_then(|value| value.title())
                .unwrap_or(file_stem),
        ),
        artist: tag
            .as_ref()
            .and_then(|value| value.artist())
            .map(normalize_label),
        album: tag
            .as_ref()
            .and_then(|value| value.album())
            .map(normalize_label),
        album_artist: tag
            .as_ref()
            .and_then(|value| value.album_artist())
            .map(normalize_label),
        genre: tag
            .as_ref()
            .and_then(|value| value.genre())
            .map(normalize_label),
        track_number: tag.as_ref().and_then(|value| value.track()).map(i64::from),
        disc_number: tag.as_ref().and_then(|value| value.disc()).map(i64::from),
        duration_seconds: tag
            .as_ref()
            .and_then(|value| value.duration())
            .map(|value| value as f64),
        file_size_bytes: metadata.len() as i64,
        content_hash: stable_identifier("content", &file_path.display().to_string()),
        local_path: file_path.display().to_string(),
    })
}

pub(crate) fn normalize_label(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub(crate) fn stable_identifier(namespace: &str, value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(namespace.as_bytes());
    hasher.update([0]);
    hasher.update(value.as_bytes());
    format!("{namespace}-{:x}", hasher.finalize())
}

fn is_mp3_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("mp3"))
        .unwrap_or(false)
}
