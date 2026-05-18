#![allow(dead_code)]

pub const INITIAL_SCHEMA_MIGRATION: &str =
    include_str!("../../db/migrations/0001_initial_schema.sql");
pub const LIBRARY_QUERY_INDEXES_MIGRATION: &str =
    include_str!("../../db/migrations/0002_library_query_indexes.sql");
pub const FLAC_TRACK_SUPPORT_MIGRATION: &str =
    include_str!("../../db/migrations/0003_flac_track_support.sql");
pub const EXPLICIT_ADVISORY_METADATA_MIGRATION: &str =
    include_str!("../../db/migrations/0004_explicit_advisory_metadata.sql");
pub const LOCAL_PLAYLISTS_FOUNDATION_MIGRATION: &str =
    include_str!("../../db/migrations/0005_local_playlists_foundation.sql");
pub const PLAYLIST_ARTWORK_MIGRATION: &str =
    include_str!("../../db/migrations/0006_playlist_artwork.sql");
pub const CONCEPT_ALBUMS_FOUNDATION_MIGRATION: &str =
    include_str!("../../db/migrations/0007_concept_albums_foundation.sql");
pub const MIXTAPES_FOUNDATION_MIGRATION: &str =
    include_str!("../../db/migrations/0008_mixtapes_foundation.sql");
pub const ARTIST_IMAGE_CONFIG_MIGRATION: &str =
    include_str!("../../db/migrations/0009_artist_image_config.sql");
pub const TRACK_YEAR_AND_ALBUM_METADATA_MIGRATION: &str =
    include_str!("../../db/migrations/0010_track_year_and_album_metadata.sql");
pub const APP_SETTINGS_MIGRATION: &str =
    include_str!("../../db/migrations/0011_app_settings.sql");
pub const PLAY_HISTORY_MIGRATION: &str =
    include_str!("../../db/migrations/0012_play_history.sql");
pub const PLAY_EVENTS_SOURCE_MIGRATION: &str =
    include_str!("../../db/migrations/0013_play_events_source.sql");

pub const TABLE_LIBRARY_ROOTS: &str = "library_roots";
pub const TABLE_TRACKS: &str = "tracks";
pub const TABLE_TRACK_SOURCES: &str = "track_sources";
pub const TABLE_CACHE_ENTRIES: &str = "cache_entries";
pub const TABLE_ANALYSIS_RESULTS: &str = "analysis_results";
pub const TABLE_PLAYLISTS: &str = "playlists";
pub const TABLE_PLAYLIST_ENTRIES: &str = "playlist_entries";
pub const TABLE_CONCEPT_ALBUMS: &str = "concept_albums";
pub const TABLE_CONCEPT_ALBUM_ENTRIES: &str = "concept_album_entries";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SourceMode {
    Local,
    AtlasLinked,
}

impl SourceMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::AtlasLinked => "atlas-linked",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TrackSourceStatus {
    LocalOnly,
    AtlasLinked,
    AtlasOnly,
    Missing,
}

impl TrackSourceStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::LocalOnly => "local-only",
            Self::AtlasLinked => "atlas-linked",
            Self::AtlasOnly => "atlas-only",
            Self::Missing => "missing",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CacheState {
    None,
    Partial,
    Ready,
    Stale,
}

impl CacheState {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Partial => "partial",
            Self::Ready => "ready",
            Self::Stale => "stale",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AnalysisStatus {
    Pending,
    Processing,
    Ready,
    Failed,
}

impl AnalysisStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Processing => "processing",
            Self::Ready => "ready",
            Self::Failed => "failed",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        AnalysisStatus, CacheState, SourceMode, TrackSourceStatus,
        CONCEPT_ALBUMS_FOUNDATION_MIGRATION, EXPLICIT_ADVISORY_METADATA_MIGRATION,
        INITIAL_SCHEMA_MIGRATION, LOCAL_PLAYLISTS_FOUNDATION_MIGRATION, MIXTAPES_FOUNDATION_MIGRATION, PLAYLIST_ARTWORK_MIGRATION,
        TABLE_ANALYSIS_RESULTS, TABLE_CACHE_ENTRIES, TABLE_CONCEPT_ALBUMS,
        TABLE_CONCEPT_ALBUM_ENTRIES, TABLE_LIBRARY_ROOTS, TABLE_PLAYLISTS, TABLE_PLAYLIST_ENTRIES,
        TABLE_TRACKS, TABLE_TRACK_SOURCES,
    };

    #[test]
    fn migration_declares_all_core_tables() {
        for table in [
            TABLE_LIBRARY_ROOTS,
            TABLE_TRACKS,
            TABLE_TRACK_SOURCES,
            TABLE_CACHE_ENTRIES,
            TABLE_ANALYSIS_RESULTS,
        ] {
            assert!(INITIAL_SCHEMA_MIGRATION.contains(table));
        }
    }

    #[test]
    fn later_migrations_declare_playlist_and_advisory_extensions() {
        assert!(LOCAL_PLAYLISTS_FOUNDATION_MIGRATION.contains(TABLE_PLAYLISTS));
        assert!(LOCAL_PLAYLISTS_FOUNDATION_MIGRATION.contains(TABLE_PLAYLIST_ENTRIES));
        assert!(CONCEPT_ALBUMS_FOUNDATION_MIGRATION.contains(TABLE_CONCEPT_ALBUMS));
        assert!(CONCEPT_ALBUMS_FOUNDATION_MIGRATION.contains(TABLE_CONCEPT_ALBUM_ENTRIES));
        assert!(EXPLICIT_ADVISORY_METADATA_MIGRATION.contains("advisory"));
        assert!(PLAYLIST_ARTWORK_MIGRATION.contains("artwork_key"));
        assert!(MIXTAPES_FOUNDATION_MIGRATION.contains("is_mixtape"));
    }

    #[test]
    fn state_enums_match_sql_values() {
        assert_eq!(SourceMode::Local.as_str(), "local");
        assert_eq!(SourceMode::AtlasLinked.as_str(), "atlas-linked");
        assert_eq!(TrackSourceStatus::LocalOnly.as_str(), "local-only");
        assert_eq!(TrackSourceStatus::AtlasLinked.as_str(), "atlas-linked");
        assert_eq!(TrackSourceStatus::AtlasOnly.as_str(), "atlas-only");
        assert_eq!(TrackSourceStatus::Missing.as_str(), "missing");
        assert_eq!(CacheState::None.as_str(), "none");
        assert_eq!(CacheState::Partial.as_str(), "partial");
        assert_eq!(CacheState::Ready.as_str(), "ready");
        assert_eq!(CacheState::Stale.as_str(), "stale");
        assert_eq!(AnalysisStatus::Pending.as_str(), "pending");
        assert_eq!(AnalysisStatus::Processing.as_str(), "processing");
        assert_eq!(AnalysisStatus::Ready.as_str(), "ready");
        assert_eq!(AnalysisStatus::Failed.as_str(), "failed");
    }
}
