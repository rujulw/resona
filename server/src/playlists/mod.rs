use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension, Transaction};
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::database::{AppDatabase, DatabaseError};

pub const PLAYLIST_ORDERING_MODE: &str = "dense-zero-based-position";
pub const PLAYLIST_DUPLICATE_POLICY: &str = "allowed-as-distinct-entries";
pub const PLAYLIST_QUEUE_HANDOFF_MODE: &str = "replace-backend-queue-from-playlist-order";

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

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

#[derive(Clone)]
pub struct PlaylistStore {
    app_database: AppDatabase,
}

impl PlaylistStore {
    pub fn new(app_database: AppDatabase) -> Self {
        Self { app_database }
    }

    pub fn list_playlists(&self) -> Result<Vec<PlaylistSummary>, PlaylistError> {
        let connection = self.app_database.connect()?;
        let mut statement = connection.prepare(
            "
            SELECT
              playlists.id,
              playlists.name,
              playlists.description,
              playlists.artwork_key,
              playlists.created_at,
              playlists.updated_at,
              COUNT(playlist_entries.id) AS entry_count
            FROM playlists
            LEFT JOIN playlist_entries ON playlist_entries.playlist_id = playlists.id
            GROUP BY
              playlists.id,
              playlists.name,
              playlists.description,
              playlists.artwork_key,
              playlists.created_at,
              playlists.updated_at
            ORDER BY lower(playlists.name) ASC, playlists.created_at ASC
            ",
        )?;

        let rows = statement.query_map([], |row| {
            Ok(PlaylistSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                artwork_key: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                entry_count: row.get::<_, i64>(6)? as usize,
            })
        })?;

        let mut playlists = Vec::new();
        for row in rows {
            playlists.push(row?);
        }

        Ok(playlists)
    }

    pub fn get_playlist(&self, playlist_id: &str) -> Result<Option<PlaylistDetail>, PlaylistError> {
        let connection = self.app_database.connect()?;
        load_playlist_detail(&connection, playlist_id)
    }

    pub fn create_playlist(
        &self,
        name: &str,
        description: Option<&str>,
        artwork_path: Option<&str>,
    ) -> Result<PlaylistSummary, PlaylistError> {
        let normalized_name = normalize_playlist_name(name)?;
        let normalized_description = normalize_optional_text(description);
        let now = timestamp_now();
        let playlist_id = generated_identifier("playlist", &normalized_name);
        let artwork_key = import_playlist_artwork(self.app_database.app_data_dir(), artwork_path)?;
        let connection = self.app_database.connect()?;

        connection.execute(
            "
            INSERT INTO playlists (id, name, description, artwork_key, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?5)
            ",
            params![playlist_id, normalized_name, normalized_description, artwork_key, now],
        )?;

        load_playlist_summary(&connection, &playlist_id)?.ok_or_else(|| {
            PlaylistError::NotFound("playlist was created but could not be reloaded".to_owned())
        })
    }

    pub fn update_playlist(
        &self,
        playlist_id: &str,
        name: &str,
        description: Option<&str>,
        artwork_path: Option<&str>,
    ) -> Result<PlaylistSummary, PlaylistError> {
        let normalized_name = normalize_playlist_name(name)?;
        let normalized_description = normalize_optional_text(description);
        let now = timestamp_now();
        let connection = self.app_database.connect()?;
        let existing_artwork_key = load_playlist_summary(&connection, playlist_id)?
            .ok_or_else(|| PlaylistError::NotFound(format!("playlist {playlist_id} was not found")))?
            .artwork_key;
        let next_artwork_key = if artwork_path.is_some() {
            let next_artwork_key =
                import_playlist_artwork(self.app_database.app_data_dir(), artwork_path)?;
            remove_playlist_artwork(
                self.app_database.app_data_dir(),
                existing_artwork_key.as_deref(),
            )?;
            next_artwork_key
        } else {
            existing_artwork_key
        };
        let updated = connection.execute(
            "
            UPDATE playlists
            SET name = ?2, description = ?3, artwork_key = ?4, updated_at = ?5
            WHERE id = ?1
            ",
            params![
                playlist_id,
                normalized_name,
                normalized_description,
                next_artwork_key,
                now
            ],
        )?;

        if updated == 0 {
            return Err(PlaylistError::NotFound(format!(
                "playlist {playlist_id} was not found"
            )));
        }

        load_playlist_summary(&connection, playlist_id)?.ok_or_else(|| {
            PlaylistError::NotFound(format!("playlist {playlist_id} disappeared after update"))
        })
    }

    pub fn delete_playlist(&self, playlist_id: &str) -> Result<(), PlaylistError> {
        let connection = self.app_database.connect()?;
        let existing_artwork_key = load_playlist_summary(&connection, playlist_id)?
            .ok_or_else(|| PlaylistError::NotFound(format!("playlist {playlist_id} was not found")))?
            .artwork_key;
        let deleted = connection.execute("DELETE FROM playlists WHERE id = ?1", [playlist_id])?;

        if deleted == 0 {
            return Err(PlaylistError::NotFound(format!(
                "playlist {playlist_id} was not found"
            )));
        }

        remove_playlist_artwork(self.app_database.app_data_dir(), existing_artwork_key.as_deref())?;
        Ok(())
    }

    pub fn append_track(
        &self,
        playlist_id: &str,
        track_id: &str,
    ) -> Result<PlaylistDetail, PlaylistError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_playlist_exists(&transaction, playlist_id)?;
        ensure_track_exists(&transaction, track_id)?;

        let next_position = load_entry_ids_in_order(&transaction, playlist_id)?.len();
        let now = timestamp_now();
        let entry_id = generated_identifier(
            "playlist-entry",
            &format!("{playlist_id}:{track_id}:{next_position}"),
        );

        transaction.execute(
            "
            INSERT INTO playlist_entries (id, playlist_id, track_id, position, added_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?5)
            ",
            params![entry_id, playlist_id, track_id, next_position as i64, now],
        )?;
        touch_playlist(&transaction, playlist_id)?;
        transaction.commit()?;

        self.get_playlist(playlist_id)?
            .ok_or_else(|| PlaylistError::NotFound(format!("playlist {playlist_id} was not found")))
    }

    pub fn remove_entry(
        &self,
        playlist_id: &str,
        entry_id: &str,
    ) -> Result<PlaylistDetail, PlaylistError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_playlist_exists(&transaction, playlist_id)?;
        let removed_position = transaction
            .query_row(
                "
                SELECT position
                FROM playlist_entries
                WHERE id = ?1 AND playlist_id = ?2
                ",
                params![entry_id, playlist_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()?
            .ok_or_else(|| {
                PlaylistError::NotFound(format!(
                    "playlist entry {entry_id} was not found in playlist {playlist_id}"
                ))
            })?;

        transaction.execute(
            "DELETE FROM playlist_entries WHERE id = ?1 AND playlist_id = ?2",
            params![entry_id, playlist_id],
        )?;
        transaction.execute(
            "
            UPDATE playlist_entries
            SET position = position - 1, updated_at = ?3
            WHERE playlist_id = ?1 AND position > ?2
            ",
            params![playlist_id, removed_position, timestamp_now()],
        )?;
        touch_playlist(&transaction, playlist_id)?;
        transaction.commit()?;

        self.get_playlist(playlist_id)?
            .ok_or_else(|| PlaylistError::NotFound(format!("playlist {playlist_id} was not found")))
    }

    pub fn move_entry(
        &self,
        playlist_id: &str,
        entry_id: &str,
        target_position: usize,
    ) -> Result<PlaylistDetail, PlaylistError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_playlist_exists(&transaction, playlist_id)?;

        let mut entry_ids = load_entry_ids_in_order(&transaction, playlist_id)?;
        let current_index = entry_ids
            .iter()
            .position(|current| current == entry_id)
            .ok_or_else(|| {
                PlaylistError::NotFound(format!(
                    "playlist entry {entry_id} was not found in playlist {playlist_id}"
                ))
            })?;

        if entry_ids.is_empty() {
            return Err(PlaylistError::InvalidInput(format!(
                "playlist {playlist_id} does not contain any entries"
            )));
        }

        let bounded_target = target_position.min(entry_ids.len().saturating_sub(1));
        if current_index != bounded_target {
            let moved = entry_ids.remove(current_index);
            entry_ids.insert(bounded_target, moved);
            rewrite_positions(&transaction, playlist_id, &entry_ids)?;
            touch_playlist(&transaction, playlist_id)?;
        }
        transaction.commit()?;

        self.get_playlist(playlist_id)?
            .ok_or_else(|| PlaylistError::NotFound(format!("playlist {playlist_id} was not found")))
    }

    pub fn replace_entries(
        &self,
        playlist_id: &str,
        entries: &[PlaylistEntryRecord],
    ) -> Result<PlaylistDetail, PlaylistError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        ensure_playlist_exists(&transaction, playlist_id)?;
        validate_entry_positions(entries)?;

        transaction.execute(
            "DELETE FROM playlist_entries WHERE playlist_id = ?1",
            [playlist_id],
        )?;

        let now = timestamp_now();
        for entry in entries {
            ensure_track_exists(&transaction, &entry.track_id)?;
            let entry_id = if entry.entry_id.is_empty() {
                generated_identifier(
                    "playlist-entry",
                    &format!("{playlist_id}:{}:{}", entry.track_id, entry.position),
                )
            } else {
                entry.entry_id.clone()
            };

            transaction.execute(
                "
                INSERT INTO playlist_entries (id, playlist_id, track_id, position, added_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?5)
                ",
                params![
                    entry_id,
                    playlist_id,
                    entry.track_id,
                    entry.position as i64,
                    now
                ],
            )?;
        }

        touch_playlist(&transaction, playlist_id)?;
        transaction.commit()?;

        self.get_playlist(playlist_id)?
            .ok_or_else(|| PlaylistError::NotFound(format!("playlist {playlist_id} was not found")))
    }

    pub fn build_queue_handoff(
        &self,
        playlist_id: &str,
        start_entry_id: Option<&str>,
    ) -> Result<PlaylistQueueHandoff, PlaylistError> {
        let detail = self.get_playlist(playlist_id)?.ok_or_else(|| {
            PlaylistError::NotFound(format!("playlist {playlist_id} was not found"))
        })?;

        if detail.entries.is_empty() {
            return Err(PlaylistError::InvalidInput(format!(
                "playlist {playlist_id} does not contain any entries"
            )));
        }

        let active_entry = match start_entry_id {
            Some(entry_id) => detail
                .entries
                .iter()
                .find(|entry| entry.entry_id == entry_id)
                .ok_or_else(|| {
                    PlaylistError::NotFound(format!(
                        "playlist entry {entry_id} was not found in playlist {playlist_id}"
                    ))
                })?,
            None => detail
                .entries
                .first()
                .expect("entries should not be empty after guard"),
        };

        Ok(PlaylistQueueHandoff {
            playlist_id: playlist_id.to_owned(),
            track_ids: detail
                .entries
                .iter()
                .map(|entry| entry.track_id.clone())
                .collect(),
            active_track_id: active_entry.track_id.clone(),
            active_entry_id: active_entry.entry_id.clone(),
        })
    }
}

pub fn playlist_contract() -> PlaylistContract {
    PlaylistContract {
        storage_boundary: "sqlite persists playlist identity separately from ordered playlist entries so reorders do not rewrite playlist records",
        ordering_mode: PLAYLIST_ORDERING_MODE,
        duplicate_policy: PLAYLIST_DUPLICATE_POLICY,
        queue_handoff: PlaylistQueueHandoffContract {
            mode: PLAYLIST_QUEUE_HANDOFF_MODE,
            request_shape: "{ playlistId, startEntryId? }",
            response_shape: "PlaybackQueueSnapshot",
            active_entry_rule: "if startEntryId is present it must belong to playlistId; otherwise playback begins from the first playlist entry",
            queue_order_rule: "queue track order matches playlist entry order exactly at handoff time and stays stable even if the visible library view is filtered or resorted later",
        },
        planned_commands: vec![
            PlaylistCommandContract {
                name: "create_playlist",
                summary: "Create a local playlist shell with a user-visible name before entries are added.",
                request_shape: "{ name, description?, artworkPath? }",
                response_shape: "PlaylistSummary",
            },
            PlaylistCommandContract {
                name: "update_playlist",
                summary: "Update playlist metadata without affecting entry order or queue state.",
                request_shape: "{ playlistId, name, description?, artworkPath? }",
                response_shape: "PlaylistSummary",
            },
            PlaylistCommandContract {
                name: "replace_playlist_entries",
                summary: "Commit an explicit ordered list of playlist entries after add, remove, or reorder operations.",
                request_shape: "{ playlistId, entries: [{ entryId?, trackId, position }] }",
                response_shape: "PlaylistDetail",
            },
            PlaylistCommandContract {
                name: "handoff_playlist_to_queue",
                summary: "Replace the backend playback queue from playlist order and optionally begin from a chosen playlist entry.",
                request_shape: "{ playlistId, startEntryId? }",
                response_shape: "PlaybackQueueSnapshot",
            },
        ],
        guarantees: vec![
            "playlist entry identity is separate from track identity so the same track can appear more than once in a playlist without ambiguity",
            "playlist order is determined only by ascending entry position and never by track title artist album or insertion timestamp",
            "positions are dense and zero-based after each committed reorder so neighboring inserts and moves remain deterministic",
            "queue handoff copies playlist order into the backend playback queue at one moment in time instead of creating a live coupled view",
            "playlist deletion cascades to playlist entries while track deletion removes dependent local-playlist entries for the current local-first milestone",
        ],
    }
}

fn normalize_playlist_name(name: &str) -> Result<String, PlaylistError> {
    let normalized = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        Err(PlaylistError::InvalidInput(
            "playlist name must contain visible characters".to_owned(),
        ))
    } else {
        Ok(normalized)
    }
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value.and_then(|text| {
        let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    })
}

fn import_playlist_artwork(
    app_data_dir: &Path,
    artwork_path: Option<&str>,
) -> Result<Option<String>, PlaylistError> {
    let Some(artwork_path) = normalize_optional_text(artwork_path) else {
        return Ok(None);
    };
    let source_path = Path::new(&artwork_path);
    if !source_path.exists() {
        return Err(PlaylistError::InvalidInput(format!(
            "playlist artwork source {artwork_path} was not found"
        )));
    }

    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "img".to_owned());
    let artwork_key = format!(
        "{}.{}",
        generated_identifier("playlist-artwork", &artwork_path),
        extension
    );
    let artwork_dir = app_data_dir.join("artwork");
    fs::create_dir_all(&artwork_dir)?;
    fs::copy(source_path, artwork_dir.join(&artwork_key))?;
    Ok(Some(artwork_key))
}

fn remove_playlist_artwork(
    app_data_dir: &Path,
    artwork_key: Option<&str>,
) -> Result<(), PlaylistError> {
    if let Some(artwork_key) = artwork_key {
        let artwork_path = app_data_dir.join("artwork").join(artwork_key);
        if artwork_path.exists() {
            fs::remove_file(artwork_path)?;
        }
    }

    Ok(())
}

fn timestamp_now() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_secs()
        .to_string()
}

fn generated_identifier(namespace: &str, seed: &str) -> String {
    let counter = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();

    let mut hasher = Sha256::new();
    hasher.update(namespace.as_bytes());
    hasher.update([0]);
    hasher.update(seed.as_bytes());
    hasher.update([0]);
    hasher.update(nanos.to_string().as_bytes());
    hasher.update([0]);
    hasher.update(counter.to_string().as_bytes());
    format!("{namespace}-{:x}", hasher.finalize())
}

fn load_playlist_summary(
    connection: &rusqlite::Connection,
    playlist_id: &str,
) -> Result<Option<PlaylistSummary>, PlaylistError> {
    connection
        .query_row(
            "
            SELECT
              playlists.id,
              playlists.name,
              playlists.description,
              playlists.artwork_key,
              playlists.created_at,
              playlists.updated_at,
              COUNT(playlist_entries.id) AS entry_count
            FROM playlists
            LEFT JOIN playlist_entries ON playlist_entries.playlist_id = playlists.id
            WHERE playlists.id = ?1
            GROUP BY
              playlists.id,
              playlists.name,
              playlists.description,
              playlists.artwork_key,
              playlists.created_at,
              playlists.updated_at
            ",
            [playlist_id],
            |row| {
                Ok(PlaylistSummary {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    artwork_key: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    entry_count: row.get::<_, i64>(6)? as usize,
                })
            },
        )
        .optional()
        .map_err(PlaylistError::from)
}

fn load_playlist_detail(
    connection: &rusqlite::Connection,
    playlist_id: &str,
) -> Result<Option<PlaylistDetail>, PlaylistError> {
    let Some(playlist) = load_playlist_summary(connection, playlist_id)? else {
        return Ok(None);
    };

    let mut statement = connection.prepare(
        "
        SELECT
          playlist_entries.id,
          playlist_entries.playlist_id,
          playlist_entries.track_id,
          playlist_entries.position,
          playlist_entries.added_at,
          playlist_entries.updated_at,
          tracks.title,
          tracks.artist,
          tracks.album,
          tracks.advisory,
          tracks.artwork_key,
          tracks.extension,
          tracks.duration_seconds
        FROM playlist_entries
        INNER JOIN tracks ON tracks.id = playlist_entries.track_id
        WHERE playlist_entries.playlist_id = ?1
        ORDER BY playlist_entries.position ASC, playlist_entries.id ASC
        ",
    )?;

    let rows = statement.query_map([playlist_id], |row| {
        Ok(PlaylistEntryItem {
            entry_id: row.get(0)?,
            playlist_id: row.get(1)?,
            track_id: row.get(2)?,
            position: row.get::<_, i64>(3)? as usize,
            added_at: row.get(4)?,
            updated_at: row.get(5)?,
            title: row.get(6)?,
            artist: row.get(7)?,
            album: row.get(8)?,
            advisory: row.get(9)?,
            artwork_key: row.get(10)?,
            extension: row.get(11)?,
            duration_seconds: row.get(12)?,
        })
    })?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(row?);
    }

    Ok(Some(PlaylistDetail { playlist, entries }))
}

fn ensure_playlist_exists(
    transaction: &Transaction<'_>,
    playlist_id: &str,
) -> Result<(), PlaylistError> {
    let exists = transaction.query_row(
        "SELECT EXISTS(SELECT 1 FROM playlists WHERE id = ?1)",
        [playlist_id],
        |row| row.get::<_, i64>(0),
    )?;

    if exists == 0 {
        Err(PlaylistError::NotFound(format!(
            "playlist {playlist_id} was not found"
        )))
    } else {
        Ok(())
    }
}

fn ensure_track_exists(transaction: &Transaction<'_>, track_id: &str) -> Result<(), PlaylistError> {
    let exists = transaction.query_row(
        "SELECT EXISTS(SELECT 1 FROM tracks WHERE id = ?1)",
        [track_id],
        |row| row.get::<_, i64>(0),
    )?;

    if exists == 0 {
        Err(PlaylistError::NotFound(format!(
            "track {track_id} was not found"
        )))
    } else {
        Ok(())
    }
}

fn load_entry_ids_in_order(
    transaction: &Transaction<'_>,
    playlist_id: &str,
) -> Result<Vec<String>, PlaylistError> {
    let mut statement = transaction.prepare(
        "
        SELECT id
        FROM playlist_entries
        WHERE playlist_id = ?1
        ORDER BY position ASC, id ASC
        ",
    )?;

    let rows = statement.query_map([playlist_id], |row| row.get::<_, String>(0))?;
    let mut entry_ids = Vec::new();
    for row in rows {
        entry_ids.push(row?);
    }
    Ok(entry_ids)
}

fn rewrite_positions(
    transaction: &Transaction<'_>,
    playlist_id: &str,
    ordered_entry_ids: &[String],
) -> Result<(), PlaylistError> {
    let offset = ordered_entry_ids.len() as i64 + 1;
    transaction.execute(
        "
        UPDATE playlist_entries
        SET position = position + ?2
        WHERE playlist_id = ?1
        ",
        params![playlist_id, offset],
    )?;

    let now = timestamp_now();
    for (position, entry_id) in ordered_entry_ids.iter().enumerate() {
        transaction.execute(
            "
            UPDATE playlist_entries
            SET position = ?3, updated_at = ?4
            WHERE playlist_id = ?1 AND id = ?2
            ",
            params![playlist_id, entry_id, position as i64, now],
        )?;
    }

    Ok(())
}

fn touch_playlist(transaction: &Transaction<'_>, playlist_id: &str) -> Result<(), PlaylistError> {
    transaction.execute(
        "UPDATE playlists SET updated_at = ?2 WHERE id = ?1",
        params![playlist_id, timestamp_now()],
    )?;
    Ok(())
}

fn validate_entry_positions(entries: &[PlaylistEntryRecord]) -> Result<(), PlaylistError> {
    let mut positions = entries
        .iter()
        .map(|entry| entry.position)
        .collect::<Vec<_>>();
    positions.sort_unstable();
    for (expected, actual) in positions.into_iter().enumerate() {
        if expected != actual {
            return Err(PlaylistError::InvalidInput(
                "playlist entry positions must be dense and zero-based".to_owned(),
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{
        playlist_contract, PlaylistStore, PLAYLIST_DUPLICATE_POLICY, PLAYLIST_ORDERING_MODE,
        PLAYLIST_QUEUE_HANDOFF_MODE,
    };
    use crate::database::AppDatabase;

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn unique_test_db_path() -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let counter = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!(
            "resona-playlist-contract-{nanos}-{counter}.sqlite3"
        ))
    }

    #[test]
    fn playlist_contract_exposes_ordering_and_queue_handoff_rules() {
        let contract = playlist_contract();

        assert_eq!(contract.ordering_mode, PLAYLIST_ORDERING_MODE);
        assert_eq!(contract.duplicate_policy, PLAYLIST_DUPLICATE_POLICY);
        assert_eq!(contract.queue_handoff.mode, PLAYLIST_QUEUE_HANDOFF_MODE);
        assert_eq!(contract.planned_commands.len(), 4);
        assert_eq!(contract.planned_commands[0].name, "create_playlist");
        assert_eq!(
            contract.planned_commands[3].name,
            "handoff_playlist_to_queue"
        );
    }

    #[test]
    fn create_and_list_playlist_round_trips() {
        let db_path = unique_test_db_path();
        let store = PlaylistStore::new(
            AppDatabase::initialize_at(&db_path).expect("test database should initialize"),
        );

        let created = store
            .create_playlist("Road Trip", Some("weekend mix"), None)
            .expect("playlist should create");
        let playlists = store.list_playlists().expect("playlists should list");

        assert_eq!(playlists.len(), 1);
        assert_eq!(playlists[0].id, created.id);
        let _ = std::fs::remove_file(db_path);
    }
}
