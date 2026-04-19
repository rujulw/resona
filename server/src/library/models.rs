use crate::database::DatabaseError;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub library_root_id: String,
    pub library_root_name: String,
    pub root_path: String,
    pub discovered_tracks: usize,
    pub inserted_tracks: usize,
    pub updated_tracks: usize,
    pub removed_tracks: usize,
}

#[derive(Clone, Debug)]
pub struct PersistedLibrarySummary {
    pub library_roots: usize,
    pub tracks: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryPage {
    pub items: Vec<LibraryTrackItem>,
    pub next_cursor: Option<String>,
    pub total: usize,
    pub page_size: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumSummary {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub track_count: usize,
    pub total_duration_seconds: Option<f64>,
    pub artwork_key: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumTrackItem {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub advisory: Option<bool>,
    pub duration_seconds: Option<f64>,
    pub artwork_key: Option<String>,
    pub extension: String,
    pub track_number: Option<i64>,
    pub disc_number: Option<i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumDetail {
    pub album: AlbumSummary,
    pub tracks: Vec<AlbumTrackItem>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSource {
    pub track_id: String,
    pub local_path: String,
    pub extension: String,
}

#[derive(Clone, Debug)]
pub struct ResolvedPlaybackTrack {
    pub track_id: String,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub advisory: Option<bool>,
    pub duration_seconds: Option<f64>,
    pub local_path: String,
    pub extension: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtworkSource {
    pub artwork_key: String,
    pub local_path: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryTrackItem {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub advisory: Option<bool>,
    pub duration_seconds: Option<f64>,
    pub artwork_key: Option<String>,
    pub relative_path: String,
    pub extension: String,
    pub source_status: String,
    pub cache_state: String,
    pub analysis_status: String,
    pub indexed_at: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TrackSortKey {
    Title,
    Artist,
    Album,
    IndexedAt,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SortDirection {
    Asc,
    Desc,
}

#[derive(Clone, Debug)]
pub struct LibraryQuery {
    pub page_size: usize,
    pub cursor: Option<String>,
    pub search: Option<String>,
    pub sort_key: TrackSortKey,
    pub sort_direction: SortDirection,
}

impl Default for LibraryQuery {
    fn default() -> Self {
        Self {
            page_size: 50,
            cursor: None,
            search: None,
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        }
    }
}

#[derive(Clone, Debug)]
pub(crate) struct LibraryRootRecord {
    pub id: String,
    pub display_name: String,
    pub selected_path: String,
}

#[derive(Clone, Debug)]
pub(crate) struct NormalizedTrack {
    pub id: String,
    pub relative_path: String,
    pub file_name: String,
    pub extension: String,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub advisory: Option<bool>,
    pub track_number: Option<i64>,
    pub disc_number: Option<i64>,
    pub duration_seconds: Option<f64>,
    pub artwork_key: Option<String>,
    pub artwork_bytes: Option<Vec<u8>>,
    pub file_size_bytes: i64,
    pub content_hash: String,
    pub local_path: String,
}

#[derive(Clone, Debug)]
pub(crate) struct LibraryCursor {
    pub sort_key: TrackSortKey,
    pub sort_direction: SortDirection,
    pub sort_value: String,
    pub track_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct AlbumLookupKey {
    pub album_key: String,
    pub artist_key: String,
}

impl AlbumLookupKey {
    pub(crate) fn new(album: &str, artist: Option<&str>) -> Self {
        Self {
            album_key: normalize_album_group_value(album),
            artist_key: normalize_album_group_value(artist.unwrap_or_default()),
        }
    }

    pub(crate) fn encode(&self) -> String {
        format!(
            "album:{}:{}",
            escape_album_key_segment(&self.album_key),
            escape_album_key_segment(&self.artist_key)
        )
    }

    pub(crate) fn decode(value: &str) -> Option<Self> {
        let encoded = value.strip_prefix("album:")?;
        let (album_key, artist_key) = encoded.split_once(':')?;

        Some(Self {
            album_key: unescape_album_key_segment(album_key),
            artist_key: unescape_album_key_segment(artist_key),
        })
    }
}

fn normalize_album_group_value(value: &str) -> String {
    value.trim().to_lowercase()
}

fn escape_album_key_segment(value: &str) -> String {
    value.replace('%', "%25").replace(':', "%3A")
}

fn unescape_album_key_segment(value: &str) -> String {
    value.replace("%3A", ":").replace("%25", "%")
}

#[derive(Debug)]
pub enum ScanError {
    InvalidRoot(String),
    Database(DatabaseError),
    Io(std::io::Error),
    Sqlite(rusqlite::Error),
    StripPrefix(std::path::StripPrefixError),
}

impl std::fmt::Display for ScanError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidRoot(message) => write!(f, "{message}"),
            Self::Database(error) => write!(f, "{error}"),
            Self::Io(error) => write!(f, "{error}"),
            Self::Sqlite(error) => write!(f, "{error}"),
            Self::StripPrefix(error) => write!(f, "{error}"),
        }
    }
}

impl std::error::Error for ScanError {}

impl From<DatabaseError> for ScanError {
    fn from(error: DatabaseError) -> Self {
        Self::Database(error)
    }
}

impl From<std::io::Error> for ScanError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<rusqlite::Error> for ScanError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sqlite(error)
    }
}

impl From<std::path::StripPrefixError> for ScanError {
    fn from(error: std::path::StripPrefixError) -> Self {
        Self::StripPrefix(error)
    }
}
