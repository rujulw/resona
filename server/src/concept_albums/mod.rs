mod artwork;
mod contract;
mod entries;
mod metadata;
mod queries;
mod types;

#[cfg(test)]
mod tests;

use crate::database::AppDatabase;

pub use contract::concept_album_contract;
pub use types::{
    ConceptAlbumContract, ConceptAlbumDetail, ConceptAlbumEntryRecord, ConceptAlbumError,
    ConceptAlbumSummary,
};

#[derive(Clone)]
pub struct ConceptAlbumStore {
    pub(super) app_database: AppDatabase,
}

impl ConceptAlbumStore {
    pub fn new(app_database: AppDatabase) -> Self {
        Self { app_database }
    }
}
