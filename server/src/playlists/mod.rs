mod artwork;
mod contract;
mod entries;
mod metadata;
mod queries;
mod types;

#[cfg(test)]
mod tests;

use crate::database::AppDatabase;

pub use contract::playlist_contract;
pub use types::{
    PlaylistContract, PlaylistDetail, PlaylistEntryRecord, PlaylistError, PlaylistSummary,
};

#[derive(Clone)]
pub struct PlaylistStore {
    pub(super) app_database: AppDatabase,
}

impl PlaylistStore {
    pub fn new(app_database: AppDatabase) -> Self {
        Self { app_database }
    }
}
