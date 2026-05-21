use tauri::State;

use super::DatabaseState;
use crate::albums::AlbumStore;
use crate::database::AppDatabase;
use crate::library::{AlbumDetail, AlbumSummary, ScanError};

#[tauri::command]
pub fn list_albums(
    database_state: State<'_, DatabaseState>,
    search: Option<String>,
) -> Result<Vec<AlbumSummary>, String> {
    list_albums_with_database(&database_state.app_database, search)
        .map_err(|error| error.to_string())
}

pub fn list_albums_with_database(
    app_database: &AppDatabase,
    search: Option<String>,
) -> Result<Vec<AlbumSummary>, ScanError> {
    AlbumStore::new(app_database.clone()).list_albums(search.as_deref())
}

#[tauri::command]
pub fn get_album(
    database_state: State<'_, DatabaseState>,
    album_id: String,
) -> Result<AlbumDetail, String> {
    get_album_with_database(&database_state.app_database, &album_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("No album found for {album_id}"))
}

pub fn get_album_with_database(
    app_database: &AppDatabase,
    album_id: &str,
) -> Result<Option<AlbumDetail>, ScanError> {
    AlbumStore::new(app_database.clone()).get_album(album_id)
}
