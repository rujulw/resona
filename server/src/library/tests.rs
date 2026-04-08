use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use id3::frame::{ExtendedText, Picture, PictureType};
use id3::{Tag, TagLike, Version};

use crate::database::AppDatabase;

use super::normalization::{discover_local_audio_files, normalize_track};
use super::{LibraryQuery, LocalLibraryScanner, SortDirection, TrackSortKey};

static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

fn unique_temp_dir() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let counter = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!("resona-scan-test-{nanos}-{counter}"))
}

fn create_test_library(paths: &[&str]) -> PathBuf {
    let root = unique_temp_dir();

    for relative_path in paths {
        let file_path = root.join(relative_path);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).expect("parent directories should be created");
        }

        let mut file = fs::File::create(&file_path).expect("test mp3 should be created");
        file.write_all(relative_path.as_bytes())
            .expect("test mp3 should be writable");
    }

    root
}

fn write_test_mp3(
    file_path: &std::path::Path,
    title: Option<&str>,
    album: Option<&str>,
    artist: Option<&str>,
    include_artwork: bool,
    advisory: Option<bool>,
) {
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).expect("parent directories should be created");
    }

    fs::File::create(file_path).expect("tagged mp3 file should be created");

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
    if include_artwork {
        tag.add_frame(Picture {
            mime_type: "image/png".to_owned(),
            picture_type: PictureType::CoverFront,
            description: "cover".to_owned(),
            data: vec![137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4],
        });
    }
    if let Some(advisory) = advisory {
        tag.add_frame(ExtendedText {
            description: "ITUNESADVISORY".to_owned(),
            value: if advisory { "1" } else { "2" }.to_owned(),
        });
    }

    tag.write_to_path(file_path, Version::Id3v24)
        .expect("id3 tag should write");

    let mut file = fs::OpenOptions::new()
        .append(true)
        .open(file_path)
        .expect("mp3 file should reopen for frame bytes");
    file.write_all(&build_fake_mp3_frames(40))
        .expect("fake mp3 frames should write");
}

fn build_fake_mp3_frames(count: usize) -> Vec<u8> {
    let mut bytes = Vec::new();
    let frame_header = [0xFF, 0xFB, 0x90, 0x64];
    let frame_length = 417usize;

    for _ in 0..count {
        bytes.extend_from_slice(&frame_header);
        bytes.extend(std::iter::repeat_n(0u8, frame_length - frame_header.len()));
    }

    bytes
}

fn build_partial_mp3_bytes() -> Vec<u8> {
    let mut bytes = vec![0xFF, 0xFB, 0x90, 0x64];
    bytes.extend(std::iter::repeat_n(0u8, 160));
    bytes
}

fn write_test_flac(
    file_path: &std::path::Path,
    title: Option<&str>,
    album: Option<&str>,
    artist: Option<&str>,
    include_artwork: bool,
    advisory: Option<bool>,
) {
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).expect("parent directories should be created");
    }

    let mut bytes = Vec::new();
    bytes.extend_from_slice(b"fLaC");

    let streaminfo = build_test_flac_streaminfo(44_100, 88_200);
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

    fs::write(file_path, bytes).expect("test flac should be created");
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
    let vendor = b"resona-test";
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
    entries.push("TRACKNUMBER=7".to_owned());
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
    assert!(track.duration_seconds.is_some_and(|value| value > 1.9 && value < 2.1));
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

#[test]
fn persists_recursive_scan_results_into_sqlite() {
    let root = create_test_library(&["alpha.mp3", "nested/beta.flac"]);
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    let summary = scanner
        .scan_path(&root, Some("Test Library"))
        .expect("scan should persist");

    assert_eq!(summary.discovered_tracks, 2);
    assert_eq!(summary.inserted_tracks, 2);
    assert_eq!(summary.updated_tracks, 0);

    let persisted = scanner.library_summary().expect("summary should load");
    assert_eq!(persisted.library_roots, 1);
    assert_eq!(persisted.tracks, 2);
}

#[test]
fn scan_persists_artwork_key_and_writes_artwork_asset() {
    let root = unique_temp_dir();
    let track_path = root.join("art/cover-track.mp3");
    write_test_mp3(
        &track_path,
        Some("Cover Track"),
        Some("Sleeve"),
        Some("South"),
        true,
        Some(true),
    );
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database.clone());

    scanner
        .scan_path(&root, Some("Artwork Library"))
        .expect("scan should persist");

    let connection = database.connect().expect("connection should open");
    let (artwork_key, duration_seconds, advisory): (Option<String>, Option<f64>, Option<bool>) = connection
        .query_row(
            "SELECT artwork_key, duration_seconds, advisory FROM tracks LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("track metadata should load");

    let artwork_key = artwork_key.expect("artwork key should be stored");
    assert!(duration_seconds.is_some_and(|value| value > 0.0));
    assert_eq!(advisory, Some(true));
    assert!(database
        .app_data_dir()
        .join("artwork")
        .join(artwork_key)
        .exists());
}

#[test]
fn rescanning_updates_inserted_updated_and_removed_counts() {
    let root = create_test_library(&["alpha.mp3", "nested/beta.mp3"]);
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    let first = scanner
        .scan_path(&root, Some("Test Library"))
        .expect("first scan should persist");
    assert_eq!(first.inserted_tracks, 2);
    assert_eq!(first.updated_tracks, 0);
    assert_eq!(first.removed_tracks, 0);

    fs::remove_file(root.join("alpha.mp3")).expect("alpha should be removed");
    let mut replacement =
        fs::File::create(root.join("nested/gamma.mp3")).expect("gamma should be created");
    replacement
        .write_all(b"replacement payload")
        .expect("gamma should be writable");

    let second = scanner
        .scan_path(&root, Some("Test Library"))
        .expect("second scan should persist");

    assert_eq!(second.discovered_tracks, 2);
    assert_eq!(second.inserted_tracks, 1);
    assert_eq!(second.updated_tracks, 1);
    assert_eq!(second.removed_tracks, 1);

    let persisted = scanner.library_summary().expect("summary should load");
    assert_eq!(persisted.tracks, 2);
}

#[test]
fn query_library_filters_tracks_by_search_term() {
    let root = create_test_library(&[
        "ambient/alpha-drift.mp3",
        "ambient/bravo-signal.mp3",
        "field/charlie-mist.mp3",
    ]);
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    scanner
        .scan_path(&root, Some("Search Library"))
        .expect("scan should persist");

    let page = scanner
        .query_library(&LibraryQuery {
            page_size: 20,
            cursor: None,
            search: Some("bravo".to_owned()),
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        })
        .expect("query should succeed");

    assert_eq!(page.total, 1);
    assert_eq!(page.items.len(), 1);
    assert!(page.items[0].title.to_lowercase().contains("bravo"));
}

#[test]
fn query_library_supports_cursor_pagination_across_pages() {
    let root = create_test_library(&["disc/a-track.mp3", "disc/b-track.mp3", "disc/c-track.mp3"]);
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    scanner
        .scan_path(&root, Some("Paged Library"))
        .expect("scan should persist");

    let first_page = scanner
        .query_library(&LibraryQuery {
            page_size: 2,
            cursor: None,
            search: None,
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        })
        .expect("first page should load");

    assert_eq!(first_page.items.len(), 2);
    assert!(first_page.next_cursor.is_some());

    let second_page = scanner
        .query_library(&LibraryQuery {
            page_size: 2,
            cursor: first_page.next_cursor.clone(),
            search: None,
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        })
        .expect("second page should load");

    assert_eq!(second_page.total, 3);
    assert_eq!(second_page.items.len(), 1);
    assert!(second_page.next_cursor.is_none());
    assert_ne!(first_page.items[0].id, second_page.items[0].id);
    assert_ne!(first_page.items[1].id, second_page.items[0].id);
}

#[test]
fn query_library_supports_descending_sort() {
    let root = create_test_library(&["disc/a-track.mp3", "disc/b-track.mp3", "disc/c-track.mp3"]);
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    scanner
        .scan_path(&root, Some("Sorted Library"))
        .expect("scan should persist");

    let page = scanner
        .query_library(&LibraryQuery {
            page_size: 10,
            cursor: None,
            search: None,
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Desc,
        })
        .expect("query should succeed");

    assert_eq!(page.items.len(), 3);
    let titles = page
        .items
        .iter()
        .map(|item| item.title.clone())
        .collect::<Vec<_>>();
    let mut expected = titles.clone();
    expected.sort_by(|left, right| right.cmp(left));
    assert_eq!(titles, expected);
}

#[test]
fn query_library_searches_album_and_artist_metadata() {
    let root = unique_temp_dir();
    write_test_mp3(
        &root.join("north/alpha.mp3"),
        Some("Alpha"),
        Some("Night Drive"),
        Some("North"),
        false,
        Some(true),
    );
    write_test_mp3(
        &root.join("south/bravo.mp3"),
        Some("Bravo"),
        Some("Daylight"),
        Some("South"),
        false,
        Some(false),
    );
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    scanner
        .scan_path(&root, Some("Metadata Library"))
        .expect("scan should persist");

    let artist_page = scanner
        .query_library(&LibraryQuery {
            page_size: 10,
            cursor: None,
            search: Some("south".to_owned()),
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        })
        .expect("artist search should succeed");
    let album_page = scanner
        .query_library(&LibraryQuery {
            page_size: 10,
            cursor: None,
            search: Some("night".to_owned()),
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        })
        .expect("album search should succeed");

    assert_eq!(artist_page.total, 1);
    assert_eq!(artist_page.items[0].title, "Bravo");
    assert_eq!(artist_page.items[0].advisory, Some(false));
    assert_eq!(album_page.total, 1);
    assert_eq!(album_page.items[0].title, "Alpha");
    assert_eq!(album_page.items[0].advisory, Some(true));
}

#[test]
fn query_library_reflects_rescan_changes_in_results() {
    let root = create_test_library(&["disc/alpha.mp3", "disc/bravo.mp3"]);
    let database_path = root.join("library.sqlite3");
    let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
    let scanner = LocalLibraryScanner::new(database);

    scanner
        .scan_path(&root, Some("Rescan Library"))
        .expect("first scan should persist");

    fs::remove_file(root.join("disc/alpha.mp3")).expect("alpha should be removed");
    let mut replacement =
        fs::File::create(root.join("disc/charlie.mp3")).expect("charlie should be created");
    replacement
        .write_all(b"replacement payload")
        .expect("charlie should be writable");

    scanner
        .scan_path(&root, Some("Rescan Library"))
        .expect("second scan should persist");

    let page = scanner
        .query_library(&LibraryQuery {
            page_size: 10,
            cursor: None,
            search: None,
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        })
        .expect("query should succeed");

    let titles = page
        .items
        .iter()
        .map(|item| item.title.clone())
        .collect::<Vec<_>>();

    assert_eq!(page.total, 2);
    assert_eq!(titles, vec!["bravo".to_owned(), "charlie".to_owned()]);
    assert!(!titles.iter().any(|title| title == "alpha"));
}
