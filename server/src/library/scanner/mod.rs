mod persistence;

use std::fs;
use std::path::Path;

use rusqlite::{params, OptionalExtension};

use crate::database::AppDatabase;

use self::persistence::persist_scan;
use super::models::{
    ArtworkSource, LibraryCursor, LibraryPage, LibraryQuery, PersistedLibrarySummary,
    PlaybackSource, ResolvedPlaybackTrack, ScanError, ScanSummary,
};
use super::normalization::{build_library_root, discover_local_audio_files, normalize_track};
use super::query::{
    build_library_query_sql, count_matching_tracks, query_tracks, sort_value_for_item,
};

#[derive(Clone, Debug)]
pub struct LocalLibraryScanner {
    app_database: AppDatabase,
}

impl LocalLibraryScanner {
    pub fn new(app_database: AppDatabase) -> Self {
        Self { app_database }
    }

    pub fn scan_path(
        &self,
        root_path: impl AsRef<Path>,
        display_name: Option<&str>,
    ) -> Result<ScanSummary, ScanError> {
        let canonical_root = fs::canonicalize(root_path.as_ref())?;

        if !canonical_root.is_dir() {
            return Err(ScanError::InvalidRoot(format!(
                "{} is not a directory",
                canonical_root.display()
            )));
        }

        let library_root = build_library_root(&canonical_root, display_name);
        let discovered_files = discover_local_audio_files(&canonical_root)?;
        let normalized_tracks = discovered_files
            .iter()
            .map(|path| normalize_track(&canonical_root, path, &library_root.id))
            .collect::<Result<Vec<_>, _>>()?;

        persist_scan(&self.app_database, &library_root, &normalized_tracks)
    }

    pub fn library_summary(&self) -> Result<PersistedLibrarySummary, ScanError> {
        let connection = self.app_database.connect()?;
        let library_roots: i64 =
            connection.query_row("SELECT COUNT(*) FROM library_roots", [], |row| row.get(0))?;
        let tracks: i64 =
            connection.query_row("SELECT COUNT(*) FROM tracks", [], |row| row.get(0))?;

        Ok(PersistedLibrarySummary {
            library_roots: library_roots as usize,
            tracks: tracks as usize,
        })
    }

    pub fn query_library(&self, query: &LibraryQuery) -> Result<LibraryPage, ScanError> {
        let connection = self.app_database.connect()?;
        let page_size = query.page_size.clamp(1, 200);
        let cursor = query
            .cursor
            .as_deref()
            .and_then(LibraryCursor::decode)
            .filter(|cursor| {
                cursor.sort_key == query.sort_key && cursor.sort_direction == query.sort_direction
            });
        let search = query
            .search
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.to_lowercase());

        let total = count_matching_tracks(&connection, search.as_deref())?;
        let sql = build_library_query_sql(
            search.is_some(),
            cursor.is_some(),
            query.sort_key,
            query.sort_direction,
        );
        let mut statement = connection.prepare(&sql)?;

        let items = match (search.as_deref(), cursor.as_ref()) {
            (Some(search), Some(cursor)) => {
                let search_pattern = format!("%{search}%");
                query_tracks(
                    &mut statement,
                    params![
                        search_pattern,
                        search_pattern,
                        search_pattern,
                        cursor.sort_value,
                        cursor.sort_value,
                        cursor.track_id,
                        page_size as i64 + 1
                    ],
                )?
            }
            (Some(search), None) => {
                let search_pattern = format!("%{search}%");
                query_tracks(
                    &mut statement,
                    params![
                        search_pattern,
                        search_pattern,
                        search_pattern,
                        page_size as i64 + 1
                    ],
                )?
            }
            (None, Some(cursor)) => query_tracks(
                &mut statement,
                params![
                    cursor.sort_value,
                    cursor.sort_value,
                    cursor.track_id,
                    page_size as i64 + 1
                ],
            )?,
            (None, None) => query_tracks(&mut statement, params![page_size as i64 + 1])?,
        };

        let has_next_page = items.len() > page_size;
        let mut items = items;
        if has_next_page {
            items.truncate(page_size);
        }

        let next_cursor = items.last().and_then(|item| {
            has_next_page.then(|| {
                LibraryCursor {
                    sort_key: query.sort_key,
                    sort_direction: query.sort_direction,
                    sort_value: sort_value_for_item(item, query.sort_key),
                    track_id: item.id.clone(),
                }
                .encode()
            })
        });

        Ok(LibraryPage {
            items,
            next_cursor,
            total,
            page_size,
        })
    }

    pub fn resolve_playback_source(
        &self,
        track_id: &str,
    ) -> Result<Option<PlaybackSource>, ScanError> {
        let connection = self.app_database.connect()?;
        let mut statement = connection.prepare(
            "
            SELECT ts.local_path, t.extension
            FROM tracks t
            JOIN track_sources ts ON ts.track_id = t.id
            WHERE t.id = ?1
              AND ts.local_path IS NOT NULL
            LIMIT 1
            ",
        )?;

        let source = statement
            .query_row([track_id], |row| {
                Ok(PlaybackSource {
                    track_id: track_id.to_owned(),
                    local_path: row.get(0)?,
                    extension: row.get(1)?,
                })
            })
            .optional()?;

        Ok(source)
    }

    pub fn resolve_playback_track(
        &self,
        track_id: &str,
    ) -> Result<Option<ResolvedPlaybackTrack>, ScanError> {
        let connection = self.app_database.connect()?;
        let mut statement = connection.prepare(
            "
            SELECT
              t.id,
              t.title,
              t.artist,
              t.album,
              t.advisory,
              t.duration_seconds,
              ts.local_path,
              t.extension,
              t.artwork_key
            FROM tracks t
            JOIN track_sources ts ON ts.track_id = t.id
            WHERE t.id = ?1
              AND ts.local_path IS NOT NULL
            LIMIT 1
            ",
        )?;

        statement
            .query_row([track_id], |row| {
                Ok(ResolvedPlaybackTrack {
                    track_id: row.get(0)?,
                    title: row.get(1)?,
                    artist: row.get(2)?,
                    album: row.get(3)?,
                    advisory: row.get(4)?,
                    duration_seconds: row.get(5)?,
                    local_path: row.get(6)?,
                    extension: row.get(7)?,
                    artwork_key: row.get(8)?,
                })
            })
            .optional()
            .map_err(ScanError::from)
    }

    pub fn resolve_artwork_source(
        &self,
        artwork_key: &str,
    ) -> Result<Option<ArtworkSource>, ScanError> {
        let artwork_path = self
            .app_database
            .app_data_dir()
            .join("artwork")
            .join(artwork_key);

        if !artwork_path.exists() {
            return Ok(None);
        }

        Ok(Some(ArtworkSource {
            artwork_key: artwork_key.to_owned(),
            local_path: artwork_path.display().to_string(),
        }))
    }
}
