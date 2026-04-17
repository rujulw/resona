use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use super::super::models::{LibraryRootRecord, ScanError};

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

pub(crate) fn discover_local_audio_files(root_path: &Path) -> Result<Vec<PathBuf>, ScanError> {
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

            if file_type.is_file() && is_supported_audio_file(&path) {
                files.push(path);
            }
        }
    }

    files.sort();
    Ok(files)
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

pub(super) fn preferred_label(primary: Option<&str>, fallback: Option<&str>) -> Option<String> {
    primary
        .and_then(normalize_optional_label)
        .or_else(|| fallback.and_then(normalize_optional_label))
}

pub(super) fn clean_file_stem(file_stem: &str) -> String {
    let mut cleaned = file_stem.replace('_', " ");
    cleaned = cleaned
        .trim_start_matches(|character: char| character.is_ascii_whitespace())
        .to_owned();

    let without_track_prefix = cleaned
        .trim_start_matches(|character: char| character.is_ascii_digit())
        .trim_start_matches([' ', '-', '.', '_', ')', '(']);

    let collapsed = normalize_label(without_track_prefix);
    if collapsed.is_empty() {
        normalize_label(file_stem)
    } else {
        collapsed
    }
}

pub(super) fn build_artwork_key(
    library_root_id: &str,
    relative_path: &str,
    mime_type: &str,
    picture_data: &[u8],
) -> String {
    let digest = stable_identifier(
        "artwork",
        &format!(
            "{library_root_id}:{relative_path}:{}",
            hex_sha256(picture_data)
        ),
    );
    let extension = picture_extension(mime_type);
    format!("{digest}.{extension}")
}

fn normalize_optional_label(value: &str) -> Option<String> {
    let normalized = normalize_label(value);
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn is_supported_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            extension.eq_ignore_ascii_case("mp3") || extension.eq_ignore_ascii_case("flac")
        })
        .unwrap_or(false)
}

fn picture_extension(mime_type: &str) -> &'static str {
    match mime_type {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        _ => "bin",
    }
}

fn hex_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}
