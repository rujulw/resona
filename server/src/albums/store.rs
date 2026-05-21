use crate::albums::queries::{query_album_detail, query_album_summaries};
use crate::database::AppDatabase;
use crate::library::models::{AlbumDetail, AlbumLookupKey, AlbumSummary, ScanError};

#[derive(Clone, Debug)]
pub struct AlbumStore {
    app_database: AppDatabase,
}

impl AlbumStore {
    pub fn new(app_database: AppDatabase) -> Self {
        Self { app_database }
    }

    pub fn list_albums(&self, search: Option<&str>) -> Result<Vec<AlbumSummary>, ScanError> {
        let connection = self.app_database.connect()?;
        let search = search
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.to_lowercase());

        query_album_summaries(&connection, search.as_deref())
    }

    pub fn get_album(&self, album_id: &str) -> Result<Option<AlbumDetail>, ScanError> {
        let Some(lookup_key) = AlbumLookupKey::decode(album_id) else {
            return Ok(None);
        };
        let connection = self.app_database.connect()?;

        query_album_detail(&connection, &lookup_key)
    }
}
