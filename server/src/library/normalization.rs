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
    let metadata_fields = match extension.as_str() {
        "mp3" => read_mp3_metadata(file_path)?,
        "flac" => read_flac_metadata(file_path)?,
        _ => AudioMetadata::default(),
    };
    let normalized_title =
        preferred_label(metadata_fields.title.as_deref(), Some(cleaned_file_title.as_str()))
            .unwrap_or_else(|| "Unknown Track".to_owned());
    let normalized_album_artist =
        preferred_label(metadata_fields.album_artist.as_deref(), None);
    let normalized_artist = preferred_label(
        metadata_fields.artist.as_deref(),
        normalized_album_artist.as_deref(),
    );
    let normalized_album =
        preferred_label(metadata_fields.album.as_deref(), parent_folder_label.as_deref());
    let artwork_key = metadata_fields
        .artwork
        .as_ref()
        .map(|artwork| build_artwork_key(library_root_id, &relative_path, &artwork.mime_type, &artwork.data));
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

fn is_supported_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            extension.eq_ignore_ascii_case("mp3") || extension.eq_ignore_ascii_case("flac")
        })
        .unwrap_or(false)
}

fn build_artwork_key(
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

#[derive(Default)]
struct AudioMetadata {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    album_artist: Option<String>,
    genre: Option<String>,
    advisory: Option<bool>,
    track_number: Option<i64>,
    disc_number: Option<i64>,
    duration_seconds: Option<f64>,
    artwork: Option<EmbeddedArtwork>,
}

struct EmbeddedArtwork {
    mime_type: String,
    data: Vec<u8>,
}

fn read_mp3_metadata(file_path: &Path) -> Result<AudioMetadata, ScanError> {
    let tag = Tag::read_from_path(file_path).ok();
    let duration_seconds = tag
        .as_ref()
        .and_then(|value| value.duration())
        .map(|value| value as f64)
        .filter(|value| *value > 0.0)
        .or_else(|| estimate_mp3_duration_seconds(file_path).ok().flatten());
    let artwork = tag
        .as_ref()
        .and_then(|value| value.pictures().next())
        .filter(|picture| !picture.data.is_empty())
        .map(|picture| EmbeddedArtwork {
            mime_type: picture.mime_type.clone(),
            data: picture.data.clone(),
        });

    Ok(AudioMetadata {
        title: tag.as_ref().and_then(|value| value.title()).map(str::to_owned),
        artist: tag.as_ref().and_then(|value| value.artist()).map(str::to_owned),
        album: tag.as_ref().and_then(|value| value.album()).map(str::to_owned),
        album_artist: tag
            .as_ref()
            .and_then(|value| value.album_artist())
            .map(str::to_owned),
        genre: tag.as_ref().and_then(|value| value.genre()).map(str::to_owned),
        advisory: tag
            .as_ref()
            .and_then(read_mp3_advisory_metadata),
        track_number: tag.as_ref().and_then(|value| value.track()).map(i64::from),
        disc_number: tag.as_ref().and_then(|value| value.disc()).map(i64::from),
        duration_seconds,
        artwork,
    })
}

fn read_flac_metadata(file_path: &Path) -> Result<AudioMetadata, ScanError> {
    let bytes = fs::read(file_path)?;
    if bytes.len() < 4 || &bytes[0..4] != b"fLaC" {
        return Ok(AudioMetadata::default());
    }

    let mut offset = 4usize;
    let mut metadata = AudioMetadata::default();

    while offset + 4 <= bytes.len() {
        let header = bytes[offset];
        let is_last = (header & 0x80) != 0;
        let block_type = header & 0x7F;
        let block_length = ((bytes[offset + 1] as usize) << 16)
            | ((bytes[offset + 2] as usize) << 8)
            | bytes[offset + 3] as usize;
        offset += 4;

        if offset + block_length > bytes.len() {
            break;
        }

        let block = &bytes[offset..offset + block_length];
        match block_type {
            0 => {
                if let Some(duration_seconds) = parse_flac_streaminfo_duration(block) {
                    metadata.duration_seconds = Some(duration_seconds);
                }
            }
            4 => {
                apply_flac_vorbis_comments(block, &mut metadata);
            }
            6 => {
                if metadata.artwork.is_none() {
                    metadata.artwork = parse_flac_picture(block);
                }
            }
            _ => {}
        }

        offset += block_length;
        if is_last {
            break;
        }
    }

    Ok(metadata)
}

fn parse_flac_streaminfo_duration(block: &[u8]) -> Option<f64> {
    if block.len() < 18 {
        return None;
    }

    let field = u64::from_be_bytes(block[10..18].try_into().ok()?);
    let sample_rate = ((field >> 44) & 0xFFFFF) as u32;
    let total_samples = field & ((1u64 << 36) - 1);

    if sample_rate == 0 || total_samples == 0 {
        return None;
    }

    Some(total_samples as f64 / sample_rate as f64)
}

fn apply_flac_vorbis_comments(block: &[u8], metadata: &mut AudioMetadata) {
    let mut offset = 0usize;
    let Some(vendor_length) = read_le_u32(block, &mut offset) else {
        return;
    };
    offset = offset.saturating_add(vendor_length as usize);
    let Some(comment_count) = read_le_u32(block, &mut offset) else {
        return;
    };

    for _ in 0..comment_count {
        let Some(length) = read_le_u32(block, &mut offset) else {
            return;
        };
        let length = length as usize;
        if offset + length > block.len() {
            return;
        }
        let Ok(comment) = std::str::from_utf8(&block[offset..offset + length]) else {
            offset += length;
            continue;
        };
        offset += length;

        let Some((key, value)) = comment.split_once('=') else {
            continue;
        };
        let value = value.trim();
        if value.is_empty() {
            continue;
        }

        match key.to_ascii_uppercase().as_str() {
            "TITLE" => metadata.title = Some(value.to_owned()),
            "ARTIST" => metadata.artist = Some(value.to_owned()),
            "ALBUM" => metadata.album = Some(value.to_owned()),
            "ALBUMARTIST" | "ALBUM_ARTIST" => metadata.album_artist = Some(value.to_owned()),
            "GENRE" => metadata.genre = Some(value.to_owned()),
            "ITUNESADVISORY" | "ADVISORY" | "PARENTALADVISORY" | "PARENTAL ADVISORY" => {
                if metadata.advisory.is_none() {
                    metadata.advisory = parse_advisory_value(value);
                }
            }
            "TRACKNUMBER" => metadata.track_number = parse_integer_prefix(value),
            "DISCNUMBER" => metadata.disc_number = parse_integer_prefix(value),
            _ => {}
        }
    }
}

fn read_mp3_advisory_metadata(tag: &Tag) -> Option<bool> {
    tag.extended_texts()
        .find_map(|entry| {
            let normalized_description = entry
                .description
                .chars()
                .filter(|character| character.is_ascii_alphanumeric())
                .collect::<String>()
                .to_ascii_uppercase();

            match normalized_description.as_str() {
                "ITUNESADVISORY" | "ADVISORY" | "PARENTALADVISORY" => {
                    parse_advisory_value(&entry.value)
                }
                _ => None,
            }
        })
        .or_else(|| tag.genre().and_then(parse_genre_advisory_hint))
}

fn parse_advisory_value(value: &str) -> Option<bool> {
    let normalized = value.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "1" | "true" | "yes" | "explicit" | "advisory" => Some(true),
        "0" | "2" | "false" | "no" | "clean" | "inoffensive" => Some(false),
        _ => None,
    }
}

fn parse_genre_advisory_hint(_value: &str) -> Option<bool> {
    None
}

fn parse_flac_picture(block: &[u8]) -> Option<EmbeddedArtwork> {
    let mut offset = 0usize;
    read_be_u32(block, &mut offset)?;
    let mime_length = read_be_u32(block, &mut offset)? as usize;
    if offset + mime_length > block.len() {
        return None;
    }
    let mime_type = std::str::from_utf8(&block[offset..offset + mime_length]).ok()?.to_owned();
    offset += mime_length;

    let description_length = read_be_u32(block, &mut offset)? as usize;
    offset = offset.checked_add(description_length)?;
    if offset > block.len() {
        return None;
    }

    read_be_u32(block, &mut offset)?;
    read_be_u32(block, &mut offset)?;
    read_be_u32(block, &mut offset)?;
    read_be_u32(block, &mut offset)?;

    let data_length = read_be_u32(block, &mut offset)? as usize;
    if offset + data_length > block.len() {
        return None;
    }
    let data = block[offset..offset + data_length].to_vec();
    if data.is_empty() {
        return None;
    }

    Some(EmbeddedArtwork { mime_type, data })
}

fn read_le_u32(bytes: &[u8], offset: &mut usize) -> Option<u32> {
    if *offset + 4 > bytes.len() {
        return None;
    }
    let value = u32::from_le_bytes(bytes[*offset..*offset + 4].try_into().ok()?);
    *offset += 4;
    Some(value)
}

fn read_be_u32(bytes: &[u8], offset: &mut usize) -> Option<u32> {
    if *offset + 4 > bytes.len() {
        return None;
    }
    let value = u32::from_be_bytes(bytes[*offset..*offset + 4].try_into().ok()?);
    *offset += 4;
    Some(value)
}

fn parse_integer_prefix(value: &str) -> Option<i64> {
    value
        .split('/')
        .next()
        .and_then(|segment| segment.trim().parse::<i64>().ok())
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
