use crate::artists::queries::{
    query_artist_detail, query_artist_list, query_artists_images_dir,
    query_artists_profile_images_dir, upsert_artists_images_dir, upsert_artists_profile_images_dir,
};
use crate::database::AppDatabase;
use crate::library::models::{ArtistDetail, ArtistListItem, ScanError};

#[derive(Clone, Debug)]
pub struct ArtistStore {
    app_database: AppDatabase,
}

impl ArtistStore {
    pub fn new(app_database: AppDatabase) -> Self {
        Self { app_database }
    }

    pub fn list_artists(&self, search: Option<&str>) -> Result<Vec<ArtistListItem>, ScanError> {
        let connection = self.app_database.connect()?;
        let search = search
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_lowercase());
        query_artist_list(&connection, search.as_deref())
    }

    pub fn get_artist(&self, artist_name: &str) -> Result<Option<ArtistDetail>, ScanError> {
        let connection = self.app_database.connect()?;
        query_artist_detail(&connection, artist_name)
    }

    pub fn get_artists_images_dir(&self) -> Result<Option<String>, ScanError> {
        let connection = self.app_database.connect()?;
        query_artists_images_dir(&connection)
    }

    pub fn set_artists_images_dir(&self, dir_path: &str) -> Result<(), ScanError> {
        let connection = self.app_database.connect()?;
        upsert_artists_images_dir(&connection, dir_path)
    }

    pub fn get_artists_profile_images_dir(&self) -> Result<Option<String>, ScanError> {
        let connection = self.app_database.connect()?;
        query_artists_profile_images_dir(&connection)
    }

    pub fn set_artists_profile_images_dir(&self, dir_path: &str) -> Result<(), ScanError> {
        let connection = self.app_database.connect()?;
        upsert_artists_profile_images_dir(&connection, dir_path)
    }
}
