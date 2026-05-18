use std::io::Write;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use id3::frame::ExtendedText;
use id3::{Tag, TagLike, Version};

use crate::commands::DatabaseState;
use crate::database::AppDatabase;

pub mod albums_tests;
pub mod concept_albums_tests;
pub mod library_tests;
pub mod playback_tests;
pub mod playlists_tests;
pub mod scores_tests;
pub mod system_tests;

static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn unique_test_suffix(prefix: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let counter = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);

    format!("{prefix}-{nanos}-{counter}")
}

pub fn test_database_state() -> DatabaseState {
    let db_path = std::env::temp_dir().join(format!(
        "{}.sqlite3",
        unique_test_suffix("resona-shell-state")
    ));

    DatabaseState {
        app_database: AppDatabase::initialize_at(db_path).expect("test database should initialize"),
    }
}

pub fn write_test_mp3(
    file_path: &std::path::Path,
    title: Option<&str>,
    album: Option<&str>,
    artist: Option<&str>,
    advisory: Option<bool>,
) {
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).expect("parent directories should be created");
    }

    std::fs::File::create(file_path).expect("tagged mp3 file should be created");

    let mut tag = Tag::new();
    if let Some(title) = title {
        tag.set_title(title);
    }
    if let Some(album) = album {
        tag.set_album(album);
    }
    if let Some(artist) = artist {
        tag.set_artist(artist);
    }
    if let Some(advisory) = advisory {
        tag.add_frame(ExtendedText {
            description: "ITUNESADVISORY".to_owned(),
            value: if advisory { "1" } else { "2" }.to_owned(),
        });
    }

    tag.write_to_path(file_path, Version::Id3v24)
        .expect("id3 tag should write");

    std::fs::OpenOptions::new()
        .append(true)
        .open(file_path)
        .and_then(|mut file| file.write_all(b"\xFF\xFB\x90\x64"))
        .expect("mp3 bytes should append");
}

pub fn write_test_flac(
    file_path: &std::path::Path,
    title: Option<&str>,
    album: Option<&str>,
    artist: Option<&str>,
    include_artwork: bool,
    advisory: Option<bool>,
) {
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).expect("parent directories should be created");
    }

    let mut bytes = Vec::new();
    bytes.extend_from_slice(b"fLaC");

    let streaminfo = build_test_flac_streaminfo(44_100, 132_300);
    bytes.push(0);
    bytes.extend_from_slice(&(streaminfo.len() as u32).to_be_bytes()[1..]);
    bytes.extend_from_slice(&streaminfo);

    let comments = build_test_flac_comments(title, album, artist, advisory);
    bytes.push(if include_artwork { 4 } else { 0x84 });
    bytes.extend_from_slice(&(comments.len() as u32).to_be_bytes()[1..]);
    bytes.extend_from_slice(&comments);

    if include_artwork {
        let picture = build_test_flac_picture();
        bytes.push(0x86);
        bytes.extend_from_slice(&(picture.len() as u32).to_be_bytes()[1..]);
        bytes.extend_from_slice(&picture);
    }

    std::fs::File::create(file_path)
        .and_then(|mut file| file.write_all(&bytes))
        .expect("test flac should be created");
}

pub fn write_test_png(file_path: &std::path::Path) {
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).expect("parent directories should be created");
    }

    std::fs::write(file_path, [137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4])
        .expect("png bytes should write");
}

fn build_test_flac_streaminfo(sample_rate: u32, total_samples: u64) -> Vec<u8> {
    let mut block = vec![0u8; 34];
    block[0..2].copy_from_slice(&4096u16.to_be_bytes());
    block[2..4].copy_from_slice(&4096u16.to_be_bytes());
    let combined = ((sample_rate as u64) << 44) | (1u64 << 41) | (15u64 << 36) | total_samples;
    let combined_bytes = combined.to_be_bytes();
    block[10..18].copy_from_slice(&combined_bytes);
    block
}

fn build_test_flac_comments(
    title: Option<&str>,
    album: Option<&str>,
    artist: Option<&str>,
    advisory: Option<bool>,
) -> Vec<u8> {
    let mut comments = Vec::new();
    let vendor = b"resona-command-test";
    comments.extend_from_slice(&(vendor.len() as u32).to_le_bytes());
    comments.extend_from_slice(vendor);

    let mut entries = Vec::new();
    if let Some(title) = title {
        entries.push(format!("TITLE={title}"));
    }
    if let Some(album) = album {
        entries.push(format!("ALBUM={album}"));
    }
    if let Some(artist) = artist {
        entries.push(format!("ARTIST={artist}"));
    }
    if let Some(advisory) = advisory {
        entries.push(format!(
            "ITUNESADVISORY={}",
            if advisory { "1" } else { "2" }
        ));
    }
    entries.push("TRACKNUMBER=4".to_owned());
    entries.push("DISCNUMBER=1".to_owned());

    comments.extend_from_slice(&(entries.len() as u32).to_le_bytes());
    for entry in entries {
        comments.extend_from_slice(&(entry.len() as u32).to_le_bytes());
        comments.extend_from_slice(entry.as_bytes());
    }
    comments
}

fn build_test_flac_picture() -> Vec<u8> {
    let mime = b"image/png";
    let description = b"cover";
    let data = [137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4];
    let mut block = Vec::new();
    block.extend_from_slice(&3u32.to_be_bytes());
    block.extend_from_slice(&(mime.len() as u32).to_be_bytes());
    block.extend_from_slice(mime);
    block.extend_from_slice(&(description.len() as u32).to_be_bytes());
    block.extend_from_slice(description);
    block.extend_from_slice(&64u32.to_be_bytes());
    block.extend_from_slice(&64u32.to_be_bytes());
    block.extend_from_slice(&24u32.to_be_bytes());
    block.extend_from_slice(&0u32.to_be_bytes());
    block.extend_from_slice(&(data.len() as u32).to_be_bytes());
    block.extend_from_slice(&data);
    block
}
