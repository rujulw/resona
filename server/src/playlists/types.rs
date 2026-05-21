use serde::Serialize;

use crate::database::DatabaseError;

#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistContract {
    pub storage_boundary: &'static str,
    pub ordering_mode: &'static str,
    pub duplicate_policy: &'static str,
    pub queue_handoff: PlaylistQueueHandoffContract,
    pub planned_commands: Vec<PlaylistCommandContract>,
    pub guarantees: Vec<&'static str>,
}

#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistQueueHandoffContract {
    pub mode: &'static str,
    pub request_shape: &'static str,
    pub response_shape: &'static str,
    pub active_entry_rule: &'static str,
    pub queue_order_rule: &'static str,
}

#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistCommandContract {
    pub name: &'static str,
    pub summary: &'static str,
    pub request_shape: &'static str,
    pub response_shape: &'static str,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistSummary {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub artwork_key: Option<String>,
    pub entry_count: usize,
    pub is_mixtape: bool,
    pub hidden_from_sidebar: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistEntryItem {
    pub entry_id: String,
    pub playlist_id: String,
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
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistDetail {
    pub playlist: PlaylistSummary,
    pub entries: Vec<PlaylistEntryItem>,
}

#[derive(Clone, Debug)]
pub struct PlaylistQueueHandoff {
    pub playlist_id: String,
    pub track_ids: Vec<String>,
    pub active_track_id: String,
    pub active_entry_id: String,
}

#[derive(Clone, Debug)]
pub struct PlaylistEntryRecord {
    pub entry_id: String,
    pub track_id: String,
    pub position: usize,
}

#[derive(Debug)]
pub enum PlaylistError {
    InvalidInput(String),
    NotFound(String),
    Database(DatabaseError),
    Io(std::io::Error),
    Sqlite(rusqlite::Error),
}

impl std::fmt::Display for PlaylistError {
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

impl std::error::Error for PlaylistError {}

impl From<DatabaseError> for PlaylistError {
    fn from(error: DatabaseError) -> Self {
        Self::Database(error)
    }
}

impl From<rusqlite::Error> for PlaylistError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sqlite(error)
    }
}

impl From<std::io::Error> for PlaylistError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}
