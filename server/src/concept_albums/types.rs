use serde::Serialize;

use crate::database::DatabaseError;

#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConceptAlbumContract {
    pub storage_boundary: &'static str,
    pub editable_release_boundary: &'static str,
    pub album_reuse_rule: &'static str,
    pub playlist_reuse_rule: &'static str,
    pub ordering_mode: &'static str,
    pub duplicate_policy: &'static str,
    pub planned_commands: Vec<ConceptAlbumCommandContract>,
    pub guarantees: Vec<&'static str>,
}

#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConceptAlbumCommandContract {
    pub name: &'static str,
    pub summary: &'static str,
    pub request_shape: &'static str,
    pub response_shape: &'static str,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConceptAlbumSummary {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub description: Option<String>,
    pub artwork_key: Option<String>,
    pub entry_count: usize,
    pub hidden_from_sidebar: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConceptAlbumEntryItem {
    pub entry_id: String,
    pub concept_album_id: String,
    pub track_id: String,
    pub position: usize,
    pub added_at: String,
    pub updated_at: String,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub advisory: Option<bool>,
    pub artwork_key: Option<String>,
    pub extension: String,
    pub duration_seconds: Option<f64>,
    pub track_number: Option<i64>,
    pub disc_number: Option<i64>,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConceptAlbumDetail {
    pub concept_album: ConceptAlbumSummary,
    pub entries: Vec<ConceptAlbumEntryItem>,
}

#[derive(Clone, Debug)]
pub struct ConceptAlbumEntryRecord {
    pub entry_id: String,
    pub track_id: String,
    pub position: usize,
}

#[derive(Debug)]
pub enum ConceptAlbumError {
    InvalidInput(String),
    NotFound(String),
    Database(DatabaseError),
    Io(std::io::Error),
    Sqlite(rusqlite::Error),
}

impl std::fmt::Display for ConceptAlbumError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput(message) => write!(f, "{message}"),
            Self::NotFound(message) => write!(f, "{message}"),
            Self::Database(error) => write!(f, "{error}"),
            Self::Io(error) => write!(f, "{error}"),
            Self::Sqlite(error) => write!(f, "{error}"),
        }
    }
}

impl std::error::Error for ConceptAlbumError {}

impl From<DatabaseError> for ConceptAlbumError {
    fn from(error: DatabaseError) -> Self {
        Self::Database(error)
    }
}

impl From<rusqlite::Error> for ConceptAlbumError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sqlite(error)
    }
}

impl From<std::io::Error> for ConceptAlbumError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}
