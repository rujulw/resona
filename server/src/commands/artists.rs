use std::collections::HashMap;

use tauri::State;

use super::{ArtistImageMapState, ArtistProfileImageMapState, DatabaseState};
use crate::artists::{build_artist_image_map, build_artist_profile_image_map, ArtistStore};
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
    image_map_state: State<'_, ArtistImageMapState>,
    artist_name: String,
) -> Result<Option<ArtistDetail>, String> {
    get_artist_detail_with_database(&database_state.app_database, &image_map_state, &artist_name)
        .map_err(|e| e.to_string())
}

pub fn get_artist_detail_with_database(
    app_database: &AppDatabase,
    image_map_state: &ArtistImageMapState,
    artist_name: &str,
) -> Result<Option<ArtistDetail>, ScanError> {
    let mut detail = ArtistStore::new(app_database.clone()).get_artist(artist_name)?;
    if let Some(ref mut d) = detail {
        let map = image_map_state.0.lock().unwrap();
        d.image_config = map.get(&artist_name.to_lowercase()).map(|path| ArtistImageConfig {
            local_image_path: path.clone(),
        });
    }
    Ok(detail)
}

#[tauri::command]
pub fn get_artists_images_dir(
    database_state: State<'_, DatabaseState>,
) -> Result<Option<String>, String> {
    ArtistStore::new(database_state.app_database.clone())
        .get_artists_images_dir()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_artists_images_dir(
    database_state: State<'_, DatabaseState>,
    image_map_state: State<'_, ArtistImageMapState>,
    dir_path: String,
) -> Result<(), String> {
    ArtistStore::new(database_state.app_database.clone())
        .set_artists_images_dir(&dir_path)
        .map_err(|e| e.to_string())?;
    let new_map = build_artist_image_map(std::path::Path::new(&dir_path));
    *image_map_state.0.lock().unwrap() = new_map;
    Ok(())
}

pub fn build_initial_artist_image_map(app_database: &AppDatabase) -> HashMap<String, String> {
    ArtistStore::new(app_database.clone())
        .get_artists_images_dir()
        .ok()
        .flatten()
        .map(|dir| build_artist_image_map(std::path::Path::new(&dir)))
        .unwrap_or_default()
}

#[tauri::command]
pub fn get_artists_profile_images_dir(
    database_state: State<'_, DatabaseState>,
) -> Result<Option<String>, String> {
    ArtistStore::new(database_state.app_database.clone())
        .get_artists_profile_images_dir()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_artists_profile_images_dir(
    database_state: State<'_, DatabaseState>,
    image_map_state: State<'_, ArtistProfileImageMapState>,
    dir_path: String,
) -> Result<(), String> {
    ArtistStore::new(database_state.app_database.clone())
        .set_artists_profile_images_dir(&dir_path)
        .map_err(|e| e.to_string())?;
    let new_map = build_artist_profile_image_map(std::path::Path::new(&dir_path));
    *image_map_state.0.lock().expect("profile image map lock") = new_map;
    Ok(())
}

pub fn build_initial_artist_profile_image_map(
    app_database: &AppDatabase,
) -> HashMap<String, String> {
    ArtistStore::new(app_database.clone())
        .get_artists_profile_images_dir()
        .ok()
        .flatten()
        .map(|dir| build_artist_profile_image_map(std::path::Path::new(&dir)))
        .unwrap_or_default()
}
