use crate::artists::queries::{
    query_artist_detail, query_artist_image_config, query_artist_list, upsert_artist_image_config,
};
use crate::database::AppDatabase;
use crate::library::models::{ArtistDetail, ArtistImageConfig, ArtistListItem, ScanError};

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

    pub fn get_artist_image_config(
        &self,
        artist_name: &str,
    ) -> Result<Option<ArtistImageConfig>, ScanError> {
        let connection = self.app_database.connect()?;
        query_artist_image_config(&connection, artist_name)
    }

    pub fn set_artist_image_config(
        &self,
        artist_name: &str,
        local_image_path: &str,
    ) -> Result<(), ScanError> {
        let connection = self.app_database.connect()?;
        upsert_artist_image_config(&connection, artist_name, local_image_path)
    }
}
