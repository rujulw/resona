use tauri::State;

use super::DatabaseState;
use crate::artists::ArtistStore;
use crate::database::AppDatabase;
use crate::library::{ArtistDetail, ArtistImageConfig, ArtistListItem, ScanError};

#[tauri::command]
pub fn list_artists(
    database_state: State<'_, DatabaseState>,
    search: Option<String>,
) -> Result<Vec<ArtistListItem>, String> {
    list_artists_with_database(&database_state.app_database, search)
        .map_err(|e| e.to_string())
}

pub fn list_artists_with_database(
    app_database: &AppDatabase,
    search: Option<String>,
) -> Result<Vec<ArtistListItem>, ScanError> {
    ArtistStore::new(app_database.clone()).list_artists(search.as_deref())
}

#[tauri::command]
pub fn get_artist_detail(
    database_state: State<'_, DatabaseState>,
    artist_name: String,
) -> Result<Option<ArtistDetail>, String> {
    get_artist_detail_with_database(&database_state.app_database, &artist_name)
        .map_err(|e| e.to_string())
}

pub fn get_artist_detail_with_database(
    app_database: &AppDatabase,
    artist_name: &str,
) -> Result<Option<ArtistDetail>, ScanError> {
    ArtistStore::new(app_database.clone()).get_artist(artist_name)
}

#[tauri::command]
pub fn get_artist_image_config(
    database_state: State<'_, DatabaseState>,
    artist_name: String,
) -> Result<Option<ArtistImageConfig>, String> {
    get_artist_image_config_with_database(&database_state.app_database, &artist_name)
        .map_err(|e| e.to_string())
}

pub fn get_artist_image_config_with_database(
    app_database: &AppDatabase,
    artist_name: &str,
) -> Result<Option<ArtistImageConfig>, ScanError> {
    ArtistStore::new(app_database.clone()).get_artist_image_config(artist_name)
}

#[tauri::command]
pub fn set_artist_image_config(
    database_state: State<'_, DatabaseState>,
    artist_name: String,
    local_image_path: String,
) -> Result<(), String> {
    set_artist_image_config_with_database(
        &database_state.app_database,
        &artist_name,
        &local_image_path,
    )
    .map_err(|e| e.to_string())
}

pub fn set_artist_image_config_with_database(
    app_database: &AppDatabase,
    artist_name: &str,
    local_image_path: &str,
) -> Result<(), ScanError> {
    ArtistStore::new(app_database.clone()).set_artist_image_config(artist_name, local_image_path)
}
