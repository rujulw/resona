use std::collections::HashSet;
use std::fs;
use std::io::Read;
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
    let cleaned_file_title = clean_file_stem(file_stem);
    let normalized_title = preferred_label(
        tag.as_ref().and_then(|value| value.title()),
        Some(cleaned_file_title.as_str()),
    )
    .unwrap_or_else(|| "Unknown Track".to_owned());
    let normalized_album_artist =
        preferred_label(tag.as_ref().and_then(|value| value.album_artist()), None);
    let normalized_artist = preferred_label(
        tag.as_ref().and_then(|value| value.artist()),
        normalized_album_artist.as_deref(),
    );
    let parent_folder_label = file_path
        .parent()
        .and_then(|parent| parent.strip_prefix(root_path).ok())
        .and_then(|relative_parent| relative_parent.file_name())
        .and_then(|folder| folder.to_str())
        .and_then(|folder| preferred_label(Some(folder), None));
    let normalized_album = preferred_label(
        tag.as_ref().and_then(|value| value.album()),
        parent_folder_label.as_deref(),
    );
    let duration_seconds = tag
        .as_ref()
        .and_then(|value| value.duration())
        .map(|value| value as f64)
        .filter(|value| *value > 0.0)
        .or_else(|| estimate_mp3_duration_seconds(file_path).ok().flatten());
    let (artwork_key, artwork_bytes) =
        extract_embedded_artwork(tag.as_ref(), library_root_id, &relative_path);

    Ok(NormalizedTrack {
        id: stable_identifier("track", &format!("{library_root_id}:{relative_path}")),
        relative_path,
        file_name,
        extension: "mp3".to_owned(),
        title: normalized_title,
        artist: normalized_artist,
        album: normalized_album,
        album_artist: normalized_album_artist,
        genre: tag
            .as_ref()
            .and_then(|value| value.genre())
            .and_then(|value| preferred_label(Some(value), None)),
        track_number: tag.as_ref().and_then(|value| value.track()).map(i64::from),
        disc_number: tag.as_ref().and_then(|value| value.disc()).map(i64::from),
        duration_seconds,
        artwork_key,
        artwork_bytes,
        file_size_bytes: metadata.len() as i64,
        content_hash: stable_identifier("content", &file_path.display().to_string()),
        local_path: file_path.display().to_string(),
    })
}

pub(crate) fn normalize_label(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn preferred_label(primary: Option<&str>, fallback: Option<&str>) -> Option<String> {
    primary
        .and_then(normalize_optional_label)
        .or_else(|| fallback.and_then(normalize_optional_label))
}

fn normalize_optional_label(value: &str) -> Option<String> {
    let normalized = normalize_label(value);
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn clean_file_stem(file_stem: &str) -> String {
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

fn extract_embedded_artwork(
    tag: Option<&Tag>,
    library_root_id: &str,
    relative_path: &str,
) -> (Option<String>, Option<Vec<u8>>) {
    let Some(tag) = tag else {
        return (None, None);
    };
    let Some(picture) = tag.pictures().next() else {
        return (None, None);
    };

    if picture.data.is_empty() {
        return (None, None);
    }

    let digest = stable_identifier(
        "artwork",
        &format!(
            "{library_root_id}:{relative_path}:{}",
            hex_sha256(&picture.data)
        ),
    );
    let extension = picture_extension(&picture.mime_type);
    let artwork_key = format!("{digest}.{extension}");

    (Some(artwork_key), Some(picture.data.clone()))
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

fn estimate_mp3_duration_seconds(file_path: &Path) -> Result<Option<f64>, ScanError> {
    let mut bytes = Vec::new();
    fs::File::open(file_path)?.read_to_end(&mut bytes)?;

    if bytes.is_empty() {
        return Ok(None);
    }

    let mut offset = skip_id3v2_tag(&bytes);
    let mut total_samples = 0u64;
    let mut sample_rate = 0u32;
    let mut first_bitrate_bps = None;
    let audio_bytes = bytes.len().saturating_sub(offset);

    while offset + 4 <= bytes.len() {
        let Some(header) = parse_frame_header(&bytes[offset..offset + 4]) else {
            offset += 1;
            continue;
        };

        if first_bitrate_bps.is_none() {
            first_bitrate_bps = Some(header.bitrate_bps);
        }

        if header.frame_length == 0 || offset + header.frame_length > bytes.len() {
            offset += 1;
            continue;
        }

        sample_rate = header.sample_rate;
        total_samples += u64::from(header.samples_per_frame);
        offset += header.frame_length;
    }

    if total_samples == 0 || sample_rate == 0 {
        return Ok(first_bitrate_bps
            .filter(|value| *value > 0)
            .and_then(|bitrate_bps| {
                if audio_bytes == 0 {
                    None
                } else {
                    Some((audio_bytes as f64 * 8.0) / bitrate_bps as f64)
                }
            })
            .filter(|value| value.is_finite() && *value > 0.0));
    }

    Ok(Some(total_samples as f64 / sample_rate as f64))
}

fn skip_id3v2_tag(bytes: &[u8]) -> usize {
    if bytes.len() < 10 || &bytes[0..3] != b"ID3" {
        return 0;
    }

    let flags = bytes[5];
    let tag_size = synchsafe_to_u32(&bytes[6..10]) as usize;
    let footer_size = if flags & 0x10 != 0 { 10 } else { 0 };

    10 + tag_size + footer_size
}

fn synchsafe_to_u32(bytes: &[u8]) -> u32 {
    ((bytes[0] as u32) << 21)
        | ((bytes[1] as u32) << 14)
        | ((bytes[2] as u32) << 7)
        | (bytes[3] as u32)
}

#[derive(Clone, Copy)]
struct Mp3FrameHeader {
    sample_rate: u32,
    samples_per_frame: u16,
    frame_length: usize,
    bitrate_bps: usize,
}

fn parse_frame_header(bytes: &[u8]) -> Option<Mp3FrameHeader> {
    let header = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);

    if (header >> 21) & 0x7FF != 0x7FF {
        return None;
    }

    let version_bits = ((header >> 19) & 0b11) as u8;
    let layer_bits = ((header >> 17) & 0b11) as u8;
    let bitrate_index = ((header >> 12) & 0b1111) as usize;
    let sample_rate_index = ((header >> 10) & 0b11) as usize;
    let padding = ((header >> 9) & 0b1) as usize;

    if version_bits == 0b01 || layer_bits == 0b00 || bitrate_index == 0 || bitrate_index == 0b1111 {
        return None;
    }

    if sample_rate_index == 0b11 {
        return None;
    }

    let version = match version_bits {
        0b11 => MpegVersion::V1,
        0b10 => MpegVersion::V2,
        0b00 => MpegVersion::V25,
        _ => return None,
    };
    let layer = match layer_bits {
        0b11 => MpegLayer::L1,
        0b10 => MpegLayer::L2,
        0b01 => MpegLayer::L3,
        _ => return None,
    };

    let bitrate_kbps = bitrate_kbps(version, layer, bitrate_index)?;
    let sample_rate = sample_rate_hz(version, sample_rate_index)?;
    let samples_per_frame = samples_per_frame(version, layer);
    let coefficient = match layer {
        MpegLayer::L1 => 12,
        MpegLayer::L2 => 144,
        MpegLayer::L3 => {
            if version == MpegVersion::V1 {
                144
            } else {
                72
            }
        }
    };
    let slot_size = if layer == MpegLayer::L1 { 4 } else { 1 };
    let frame_length =
        ((coefficient * bitrate_kbps * 1000) / sample_rate as usize + padding) * slot_size;

    Some(Mp3FrameHeader {
        sample_rate,
        samples_per_frame,
        frame_length,
        bitrate_bps: bitrate_kbps * 1000,
    })
}

#[derive(Clone, Copy, Eq, PartialEq)]
enum MpegVersion {
    V1,
    V2,
    V25,
}

#[derive(Clone, Copy, Eq, PartialEq)]
enum MpegLayer {
    L1,
    L2,
    L3,
}

fn bitrate_kbps(version: MpegVersion, layer: MpegLayer, index: usize) -> Option<usize> {
    let table: &[usize; 16] = match (version, layer) {
        (MpegVersion::V1, MpegLayer::L1) => &[
            0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0,
        ],
        (MpegVersion::V1, MpegLayer::L2) => &[
            0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0,
        ],
        (MpegVersion::V1, MpegLayer::L3) => &[
            0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
        ],
        (_, MpegLayer::L1) => &[
            0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0,
        ],
        (_, MpegLayer::L2 | MpegLayer::L3) => &[
            0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
        ],
    };

    table.get(index).copied().filter(|value| *value > 0)
}

fn sample_rate_hz(version: MpegVersion, index: usize) -> Option<u32> {
    let table: &[u32; 3] = match version {
        MpegVersion::V1 => &[44_100, 48_000, 32_000],
        MpegVersion::V2 => &[22_050, 24_000, 16_000],
        MpegVersion::V25 => &[11_025, 12_000, 8_000],
    };

    table.get(index).copied()
}

fn samples_per_frame(version: MpegVersion, layer: MpegLayer) -> u16 {
    match layer {
        MpegLayer::L1 => 384,
        MpegLayer::L2 => 1_152,
        MpegLayer::L3 => {
            if version == MpegVersion::V1 {
                1_152
            } else {
                576
            }
        }
    }
}
