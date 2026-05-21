use serde::{Deserialize, Serialize};
use tauri::State;

use super::DatabaseState;
use crate::concept_albums::{
    concept_album_contract, ConceptAlbumContract, ConceptAlbumDetail, ConceptAlbumEntryRecord,
    ConceptAlbumError, ConceptAlbumStore, ConceptAlbumSummary,
};
use crate::database::AppDatabase;

#[tauri::command]
pub fn describe_concept_album_contract() -> ConceptAlbumContract {
    concept_album_contract()
}

#[tauri::command]
pub fn list_concept_albums(
    database_state: State<'_, DatabaseState>,
) -> Result<Vec<ConceptAlbumSummary>, String> {
    list_concept_albums_with_database(&database_state.app_database)
        .map_err(|error: ConceptAlbumError| error.to_string())
}

pub fn list_concept_albums_with_database(
    app_database: &AppDatabase,
) -> Result<Vec<ConceptAlbumSummary>, ConceptAlbumError> {
    ConceptAlbumStore::new(app_database.clone()).list_concept_albums()
}

#[tauri::command]
pub fn get_concept_album(
    database_state: State<'_, DatabaseState>,
    concept_album_id: String,
) -> Result<ConceptAlbumDetail, String> {
    get_concept_album_with_database(&database_state.app_database, &concept_album_id)
        .map_err(|error: ConceptAlbumError| error.to_string())?
        .ok_or_else(|| format!("concept album {concept_album_id} was not found"))
}

pub fn get_concept_album_with_database(
    app_database: &AppDatabase,
    concept_album_id: &str,
) -> Result<Option<ConceptAlbumDetail>, ConceptAlbumError> {
    ConceptAlbumStore::new(app_database.clone()).get_concept_album(concept_album_id)
}

#[tauri::command]
pub fn create_concept_album(
    database_state: State<'_, DatabaseState>,
    title: String,
    artist: Option<String>,
    description: Option<String>,
    artwork_path: Option<String>,
) -> Result<ConceptAlbumSummary, String> {
    create_concept_album_with_database(
        &database_state.app_database,
        &title,
        artist.as_deref(),
        description.as_deref(),
        artwork_path.as_deref(),
    )
    .map_err(|error: ConceptAlbumError| error.to_string())
}

pub fn create_concept_album_with_database(
    app_database: &AppDatabase,
    title: &str,
    artist: Option<&str>,
    description: Option<&str>,
    artwork_path: Option<&str>,
) -> Result<ConceptAlbumSummary, ConceptAlbumError> {
    ConceptAlbumStore::new(app_database.clone()).create_concept_album(
        title,
        artist,
        description,
        artwork_path,
    )
}

#[tauri::command]
pub fn update_concept_album(
    database_state: State<'_, DatabaseState>,
    concept_album_id: String,
    title: String,
    artist: Option<String>,
    description: Option<String>,
    artwork_path: Option<String>,
) -> Result<ConceptAlbumSummary, String> {
    update_concept_album_with_database(
        &database_state.app_database,
        &concept_album_id,
        &title,
        artist.as_deref(),
        description.as_deref(),
        artwork_path.as_deref(),
    )
    .map_err(|error: ConceptAlbumError| error.to_string())
}

pub fn update_concept_album_with_database(
    app_database: &AppDatabase,
    concept_album_id: &str,
    title: &str,
    artist: Option<&str>,
    description: Option<&str>,
    artwork_path: Option<&str>,
) -> Result<ConceptAlbumSummary, ConceptAlbumError> {
    ConceptAlbumStore::new(app_database.clone()).update_concept_album(
        concept_album_id,
        title,
        artist,
        description,
        artwork_path,
    )
}

#[tauri::command]
pub fn delete_concept_album(
    database_state: State<'_, DatabaseState>,
    concept_album_id: String,
) -> Result<(), String> {
    delete_concept_album_with_database(&database_state.app_database, &concept_album_id)
        .map_err(|error: ConceptAlbumError| error.to_string())
}

pub fn delete_concept_album_with_database(
    app_database: &AppDatabase,
    concept_album_id: &str,
) -> Result<(), ConceptAlbumError> {
    ConceptAlbumStore::new(app_database.clone()).delete_concept_album(concept_album_id)
}

#[tauri::command]
pub fn add_track_to_concept_album(
    database_state: State<'_, DatabaseState>,
    concept_album_id: String,
    track_id: String,
) -> Result<ConceptAlbumDetail, String> {
    add_track_to_concept_album_with_database(
        &database_state.app_database,
        &concept_album_id,
        &track_id,
    )
    .map_err(|error: ConceptAlbumError| error.to_string())
}

pub fn add_track_to_concept_album_with_database(
    app_database: &AppDatabase,
    concept_album_id: &str,
    track_id: &str,
) -> Result<ConceptAlbumDetail, ConceptAlbumError> {
    ConceptAlbumStore::new(app_database.clone()).append_track(concept_album_id, track_id)
}

#[tauri::command]
pub fn remove_concept_album_entry(
    database_state: State<'_, DatabaseState>,
    concept_album_id: String,
    entry_id: String,
) -> Result<ConceptAlbumDetail, String> {
    remove_concept_album_entry_with_database(
        &database_state.app_database,
        &concept_album_id,
        &entry_id,
    )
    .map_err(|error: ConceptAlbumError| error.to_string())
}

pub fn remove_concept_album_entry_with_database(
    app_database: &AppDatabase,
    concept_album_id: &str,
    entry_id: &str,
) -> Result<ConceptAlbumDetail, ConceptAlbumError> {
    ConceptAlbumStore::new(app_database.clone()).remove_entry(concept_album_id, entry_id)
}

#[tauri::command]
pub fn move_concept_album_entry(
    database_state: State<'_, DatabaseState>,
    concept_album_id: String,
    entry_id: String,
    target_position: usize,
) -> Result<ConceptAlbumDetail, String> {
    move_concept_album_entry_with_database(
        &database_state.app_database,
        &concept_album_id,
        &entry_id,
        target_position,
    )
    .map_err(|error: ConceptAlbumError| error.to_string())
}

pub fn move_concept_album_entry_with_database(
    app_database: &AppDatabase,
    concept_album_id: &str,
    entry_id: &str,
    target_position: usize,
) -> Result<ConceptAlbumDetail, ConceptAlbumError> {
    ConceptAlbumStore::new(app_database.clone()).move_entry(
        concept_album_id,
        entry_id,
        target_position,
    )
}

#[tauri::command]
pub fn replace_concept_album_entries(
    database_state: State<'_, DatabaseState>,
    concept_album_id: String,
    entries: Vec<ConceptAlbumEntryInput>,
) -> Result<ConceptAlbumDetail, String> {
    let records = entries
        .into_iter()
        .map(|entry| ConceptAlbumEntryRecord {
            entry_id: entry.entry_id.unwrap_or_default(),
            track_id: entry.track_id,
            position: entry.position,
        })
        .collect::<Vec<_>>();

    replace_concept_album_entries_with_database(
        &database_state.app_database,
        &concept_album_id,
        &records,
    )
    .map_err(|error: ConceptAlbumError| error.to_string())
}

pub fn replace_concept_album_entries_with_database(
    app_database: &AppDatabase,
    concept_album_id: &str,
    entries: &[ConceptAlbumEntryRecord],
) -> Result<ConceptAlbumDetail, ConceptAlbumError> {
    ConceptAlbumStore::new(app_database.clone()).replace_entries(concept_album_id, entries)
}

#[tauri::command]
pub fn set_concept_album_sidebar_hidden(
    database_state: State<'_, DatabaseState>,
    concept_album_id: String,
    hidden: bool,
) -> Result<(), String> {
    let db = &database_state.app_database;
    ConceptAlbumStore::new(db.clone())
        .set_hidden(&concept_album_id, hidden)
        .map_err(|e| e.to_string())
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConceptAlbumEntryInput {
    pub entry_id: Option<String>,
    pub track_id: String,
    pub position: usize,
}
