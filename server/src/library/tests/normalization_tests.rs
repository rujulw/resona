use std::fs;
use std::io::Write;

use id3::{Tag, TagLike, Version};

use crate::library::normalization::{discover_local_audio_files, normalize_track};

use super::support::{build_partial_mp3_bytes, unique_temp_dir, write_test_flac, write_test_mp3};

#[test]
fn discovers_nested_supported_audio_files_only() {
    let root = unique_temp_dir();
    let nested = root.join("disc-one");
    fs::create_dir_all(&nested).expect("directories should be created");
    fs::File::create(root.join("track-a.mp3")).expect("mp3 file should be created");
    fs::File::create(root.join("track-c.flac")).expect("flac file should be created");
    fs::File::create(nested.join("track-b.MP3")).expect("mp3 file should be created");
    fs::File::create(root.join("cover.jpg")).expect("non-mp3 file should be created");

    let discovered = discover_local_audio_files(&root).expect("scan should succeed");

    assert_eq!(discovered.len(), 3);
}

#[test]
fn normalizes_track_with_filename_fallback() {
    let root = unique_temp_dir();
    fs::create_dir_all(&root).expect("root should be created");
    let file_path = root.join("My   Track.mp3");
    fs::File::create(&file_path).expect("mp3 file should be created");

    let track = normalize_track(&root, &file_path, "library-root").expect("track should normalize");

    assert_eq!(track.relative_path, "My   Track.mp3");
    assert_eq!(track.title, "My Track");
    assert_eq!(track.extension, "mp3");
}

#[test]
fn normalizes_track_with_audio_duration_fallback_and_embedded_artwork() {
    let root = unique_temp_dir();
    fs::create_dir_all(&root).expect("root should be created");
    let file_path = root.join("nested/Signal.mp3");
    write_test_mp3(
        &file_path,
        Some("Signal"),
        Some("Frames"),
        Some("North"),
        true,
        Some(true),
    );

    let track = normalize_track(&root, &file_path, "library-root").expect("track should normalize");

    assert_eq!(track.title, "Signal");
    assert_eq!(track.album.as_deref(), Some("Frames"));
    assert_eq!(track.artist.as_deref(), Some("North"));
    assert_eq!(track.advisory, Some(true));
    assert!(track.duration_seconds.is_some());
    assert!(track.duration_seconds.expect("duration should exist") > 0.0);
    assert!(track
        .artwork_key
        .as_deref()
        .is_some_and(|value| value.ends_with(".png")));
    assert!(track
        .artwork_bytes
        .as_ref()
        .is_some_and(|bytes| !bytes.is_empty()));
}

#[test]
fn normalizes_flac_track_with_metadata_duration_and_artwork() {
    let root = unique_temp_dir();
    fs::create_dir_all(&root).expect("root should be created");
    let file_path = root.join("albums/Signal.flac");
    write_test_flac(
        &file_path,
        Some("Signal"),
        Some("Frames"),
        Some("North"),
        true,
        Some(false),
    );

    let track = normalize_track(&root, &file_path, "library-root").expect("track should normalize");

    assert_eq!(track.title, "Signal");
    assert_eq!(track.album.as_deref(), Some("Frames"));
    assert_eq!(track.artist.as_deref(), Some("North"));
    assert_eq!(track.advisory, Some(false));
    assert_eq!(track.extension, "flac");
    assert_eq!(track.track_number, Some(7));
    assert_eq!(track.disc_number, Some(1));
    assert!(track
        .duration_seconds
        .is_some_and(|value| value > 1.9 && value < 2.1));
    assert!(track
        .artwork_key
        .as_deref()
        .is_some_and(|value| value.ends_with(".png")));
    assert!(track
        .artwork_bytes
        .as_ref()
        .is_some_and(|bytes| !bytes.is_empty()));
}

#[test]
fn normalizes_track_with_clean_filename_and_metadata_fallbacks() {
    let root = unique_temp_dir();
    let file_path = root.join("Compilations/01__Late   Night.mp3");
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).expect("parent directory should exist");
    }

    fs::File::create(&file_path).expect("mp3 file should be created");

    let mut tag = Tag::new();
    tag.set_album_artist("Various Artists");
    tag.write_to_path(&file_path, Version::Id3v24)
        .expect("id3 tag should write");

    let track = normalize_track(&root, &file_path, "library-root").expect("track should normalize");

    assert_eq!(track.title, "Late Night");
    assert_eq!(track.artist.as_deref(), Some("Various Artists"));
    assert_eq!(track.album.as_deref(), Some("Compilations"));
    assert_eq!(track.album_artist.as_deref(), Some("Various Artists"));
}

#[test]
fn normalizes_track_with_bitrate_based_duration_fallback() {
    let root = unique_temp_dir();
    fs::create_dir_all(&root).expect("root should be created");
    let file_path = root.join("Rough Cut.mp3");
    let mut file = fs::File::create(&file_path).expect("mp3 file should be created");
    file.write_all(&build_partial_mp3_bytes())
        .expect("partial mp3 bytes should write");

    let track = normalize_track(&root, &file_path, "library-root").expect("track should normalize");

    assert!(track.duration_seconds.is_some());
    assert!(track.duration_seconds.expect("duration should exist") > 0.0);
}
