pub(crate) mod models;
mod normalization;
mod query;
mod scanner;
#[cfg(test)]
mod tests;

pub use models::{
    AlbumDetail, AlbumSummary, ArtistDetail, ArtistImageConfig, ArtistListItem, ArtistPlaylistItem,
    ArtworkSource, DiscographyAlbum, DiscographyItemKind, LibraryPage, LibraryQuery, PlaybackSource,
    ResolvedPlaybackTrack, ScanError, ScanSummary, SortDirection, TrackSortKey,
};
pub use scanner::LocalLibraryScanner;
