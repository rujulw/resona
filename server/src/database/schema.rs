#![allow(dead_code)]

pub const INITIAL_SCHEMA_MIGRATION: &str =
    include_str!("../../db/migrations/0001_initial_schema.sql");

pub const TABLE_LIBRARY_ROOTS: &str = "library_roots";
pub const TABLE_TRACKS: &str = "tracks";
pub const TABLE_TRACK_SOURCES: &str = "track_sources";
pub const TABLE_CACHE_ENTRIES: &str = "cache_entries";
pub const TABLE_ANALYSIS_RESULTS: &str = "analysis_results";

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
        AnalysisStatus, CacheState, INITIAL_SCHEMA_MIGRATION, SourceMode, TrackSourceStatus,
        TABLE_ANALYSIS_RESULTS, TABLE_CACHE_ENTRIES, TABLE_LIBRARY_ROOTS, TABLE_TRACKS,
        TABLE_TRACK_SOURCES,
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
