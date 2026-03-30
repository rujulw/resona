use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use id3::{Tag, TagLike};
use rusqlite::{params, OptionalExtension, Transaction};
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::database::{schema, AppDatabase, DatabaseError};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub library_root_id: String,
    pub library_root_name: String,
    pub root_path: String,
    pub discovered_tracks: usize,
    pub inserted_tracks: usize,
    pub updated_tracks: usize,
    pub removed_tracks: usize,
}

#[derive(Clone, Debug)]
pub struct PersistedLibrarySummary {
    pub library_roots: usize,
    pub tracks: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryPage {
    pub items: Vec<LibraryTrackItem>,
    pub next_cursor: Option<String>,
    pub total: usize,
    pub page_size: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryTrackItem {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_seconds: Option<f64>,
    pub relative_path: String,
    pub source_status: String,
    pub cache_state: String,
    pub analysis_status: String,
    pub indexed_at: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TrackSortKey {
    Title,
    Artist,
    Album,
    IndexedAt,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SortDirection {
    Asc,
    Desc,
}

#[derive(Clone, Debug)]
pub struct LibraryQuery {
    pub page_size: usize,
    pub cursor: Option<String>,
    pub search: Option<String>,
    pub sort_key: TrackSortKey,
    pub sort_direction: SortDirection,
}

impl Default for LibraryQuery {
    fn default() -> Self {
        Self {
            page_size: 50,
            cursor: None,
            search: None,
            sort_key: TrackSortKey::Title,
            sort_direction: SortDirection::Asc,
        }
    }
}

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
        let discovered_files = discover_mp3_files(&canonical_root)?;
        let normalized_tracks = discovered_files
            .iter()
            .map(|path| normalize_track(&canonical_root, path, &library_root.id))
            .collect::<Result<Vec<_>, _>>()?;

        self.persist_scan(&library_root, &normalized_tracks)
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
            .filter(|cursor| cursor.sort_key == query.sort_key && cursor.sort_direction == query.sort_direction);
        let search = query
            .search
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.to_lowercase());

        let total = count_matching_tracks(&connection, search.as_deref())?;
        let sql = build_library_query_sql(search.is_some(), cursor.is_some(), query.sort_key, query.sort_direction);
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
                    params![search_pattern, search_pattern, search_pattern, page_size as i64 + 1],
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

    fn persist_scan(
        &self,
        library_root: &LibraryRootRecord,
        normalized_tracks: &[NormalizedTrack],
    ) -> Result<ScanSummary, ScanError> {
        let mut connection = self.app_database.connect()?;
        let transaction = connection.transaction()?;
        let now = timestamp_now();

        transaction.execute(
            "
            INSERT INTO library_roots (
              id, display_name, selected_path, source_mode, scan_depth,
              created_at, updated_at, last_scan_started_at
            )
            VALUES (?1, ?2, ?3, ?4, 'recursive', ?5, ?5, ?5)
            ON CONFLICT(id) DO UPDATE SET
              display_name = excluded.display_name,
              selected_path = excluded.selected_path,
              source_mode = excluded.source_mode,
              updated_at = excluded.updated_at,
              last_scan_started_at = excluded.last_scan_started_at
            ",
            params![
                library_root.id,
                library_root.display_name,
                library_root.selected_path,
                schema::SourceMode::Local.as_str(),
                now
            ],
        )?;

        let mut existing_tracks = load_existing_track_ids(&transaction, &library_root.id)?;
        let mut inserted_tracks = 0usize;
        let mut updated_tracks = 0usize;

        for track in normalized_tracks {
            let existing_id = existing_tracks.remove(&track.relative_path);
            let is_insert = existing_id.is_none();
            let track_id = existing_id.unwrap_or_else(|| track.id.clone());

            upsert_track(&transaction, &track_id, library_root, track, &now)?;
            upsert_track_source(&transaction, &track_id, track, &now)?;
            ensure_cache_entry(&transaction, &track_id, &now)?;
            ensure_analysis_entry(&transaction, &track_id, &now)?;

            if is_insert {
                inserted_tracks += 1;
            } else {
                updated_tracks += 1;
            }
        }

        let stale_tracks = existing_tracks.into_values().collect::<Vec<_>>();
        for track_id in &stale_tracks {
            transaction.execute("DELETE FROM tracks WHERE id = ?1", [track_id])?;
        }

        transaction.execute(
            "
            UPDATE library_roots
            SET updated_at = ?2, last_scan_completed_at = ?2
            WHERE id = ?1
            ",
            params![library_root.id, now],
        )?;

        transaction.commit()?;

        Ok(ScanSummary {
            library_root_id: library_root.id.clone(),
            library_root_name: library_root.display_name.clone(),
            root_path: library_root.selected_path.clone(),
            discovered_tracks: normalized_tracks.len(),
            inserted_tracks,
            updated_tracks,
            removed_tracks: stale_tracks.len(),
        })
    }
}

#[derive(Clone, Debug)]
struct LibraryRootRecord {
    id: String,
    display_name: String,
    selected_path: String,
}

#[derive(Clone, Debug)]
struct NormalizedTrack {
    id: String,
    relative_path: String,
    file_name: String,
    extension: String,
    title: String,
    artist: Option<String>,
    album: Option<String>,
    album_artist: Option<String>,
    genre: Option<String>,
    track_number: Option<i64>,
    disc_number: Option<i64>,
    duration_seconds: Option<f64>,
    file_size_bytes: i64,
    content_hash: String,
    local_path: String,
}

#[derive(Debug)]
pub enum ScanError {
    InvalidRoot(String),
    Database(DatabaseError),
    Io(std::io::Error),
    Sqlite(rusqlite::Error),
    StripPrefix(std::path::StripPrefixError),
}

impl std::fmt::Display for ScanError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidRoot(message) => write!(f, "{message}"),
            Self::Database(error) => write!(f, "{error}"),
            Self::Io(error) => write!(f, "{error}"),
            Self::Sqlite(error) => write!(f, "{error}"),
            Self::StripPrefix(error) => write!(f, "{error}"),
        }
    }
}

impl std::error::Error for ScanError {}

impl From<DatabaseError> for ScanError {
    fn from(error: DatabaseError) -> Self {
        Self::Database(error)
    }
}

impl From<std::io::Error> for ScanError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<rusqlite::Error> for ScanError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sqlite(error)
    }
}

impl From<std::path::StripPrefixError> for ScanError {
    fn from(error: std::path::StripPrefixError) -> Self {
        Self::StripPrefix(error)
    }
}

fn build_library_root(root_path: &Path, display_name: Option<&str>) -> LibraryRootRecord {
    let selected_path = root_path.display().to_string();
    let id = stable_identifier("library-root", &selected_path);
    let fallback_name = root_path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("library");

    LibraryRootRecord {
        id,
        display_name: normalize_label(display_name.unwrap_or(fallback_name)),
        selected_path,
    }
}

fn discover_mp3_files(root_path: &Path) -> Result<Vec<PathBuf>, ScanError> {
    let mut stack = vec![root_path.to_path_buf()];
    let mut visited_dirs = HashSet::new();
    let mut files = Vec::new();

    while let Some(current_dir) = stack.pop() {
        let canonical_dir = fs::canonicalize(&current_dir)?;
        if !visited_dirs.insert(canonical_dir.clone()) {
            continue;
        }

        let mut entries = fs::read_dir(&canonical_dir)?
            .filter_map(Result::ok)
            .collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.path());

        for entry in entries.into_iter().rev() {
            let path = entry.path();
            let file_type = entry.file_type()?;

            if file_type.is_dir() {
                stack.push(path);
                continue;
            }

            if file_type.is_file() && is_mp3_file(&path) {
                files.push(path);
            }
        }
    }

    files.sort();
    Ok(files)
}

fn is_mp3_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("mp3"))
        .unwrap_or(false)
}

fn normalize_track(
    root_path: &Path,
    file_path: &Path,
    library_root_id: &str,
) -> Result<NormalizedTrack, ScanError> {
    let metadata = fs::metadata(file_path)?;
    let relative_path = file_path
        .strip_prefix(root_path)?
        .to_string_lossy()
        .replace('\\', "/");
    let file_name = file_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown.mp3")
        .to_owned();
    let tag = Tag::read_from_path(file_path).ok();
    let file_stem = file_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("unknown");

    Ok(NormalizedTrack {
        id: stable_identifier("track", &format!("{library_root_id}:{relative_path}")),
        relative_path,
        file_name,
        extension: "mp3".to_owned(),
        title: normalize_label(
            tag.as_ref()
                .and_then(|value| value.title())
                .unwrap_or(file_stem),
        ),
        artist: tag.as_ref().and_then(|value| value.artist()).map(normalize_label),
        album: tag.as_ref().and_then(|value| value.album()).map(normalize_label),
        album_artist: tag
            .as_ref()
            .and_then(|value| value.album_artist())
            .map(normalize_label),
        genre: tag.as_ref().and_then(|value| value.genre()).map(normalize_label),
        track_number: tag.as_ref().and_then(|value| value.track()).map(i64::from),
        disc_number: tag.as_ref().and_then(|value| value.disc()).map(i64::from),
        duration_seconds: tag
            .as_ref()
            .and_then(|value| value.duration())
            .map(|value| value as f64),
        file_size_bytes: metadata.len() as i64,
        content_hash: stable_identifier("content", &file_path.display().to_string()),
        local_path: file_path.display().to_string(),
    })
}

fn normalize_label(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn sort_value_for_item(item: &LibraryTrackItem, sort_key: TrackSortKey) -> String {
    match sort_key {
        TrackSortKey::Title => item.title.to_lowercase(),
        TrackSortKey::Artist => item.artist.clone().unwrap_or_default().to_lowercase(),
        TrackSortKey::Album => item.album.clone().unwrap_or_default().to_lowercase(),
        TrackSortKey::IndexedAt => item.indexed_at.clone(),
    }
}

fn stable_identifier(namespace: &str, value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(namespace.as_bytes());
    hasher.update([0]);
    hasher.update(value.as_bytes());
    format!("{namespace}-{:x}", hasher.finalize())
}

fn timestamp_now() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_secs()
        .to_string()
}

fn count_matching_tracks(
    connection: &rusqlite::Connection,
    search: Option<&str>,
) -> Result<usize, ScanError> {
    let count: i64 = if let Some(search) = search {
        let search_pattern = format!("%{search}%");
        connection.query_row(
            "
            SELECT COUNT(*)
            FROM tracks
            WHERE lower(title) LIKE ?1
               OR lower(COALESCE(artist, '')) LIKE ?2
               OR lower(COALESCE(album, '')) LIKE ?3
            ",
            params![search_pattern, search_pattern, search_pattern],
            |row| row.get(0),
        )?
    } else {
        connection.query_row("SELECT COUNT(*) FROM tracks", [], |row| row.get(0))?
    };

    Ok(count as usize)
}

fn build_library_query_sql(
    has_search: bool,
    has_cursor: bool,
    sort_key: TrackSortKey,
    sort_direction: SortDirection,
) -> String {
    let sort_expression = match sort_key {
        TrackSortKey::Title => "lower(COALESCE(t.title, ''))",
        TrackSortKey::Artist => "lower(COALESCE(t.artist, ''))",
        TrackSortKey::Album => "lower(COALESCE(t.album, ''))",
        TrackSortKey::IndexedAt => "t.indexed_at",
    };

    let comparison = match sort_direction {
        SortDirection::Asc => ">",
        SortDirection::Desc => "<",
    };

    let direction = match sort_direction {
        SortDirection::Asc => "ASC",
        SortDirection::Desc => "DESC",
    };

    let mut sql = format!(
        "
        SELECT
          t.id,
          t.title,
          t.artist,
          t.album,
          t.duration_seconds,
          t.relative_path,
          ts.source_status,
          ce.cache_state,
          ar.analysis_status,
          t.indexed_at
        FROM tracks t
        JOIN track_sources ts ON ts.track_id = t.id
        JOIN cache_entries ce ON ce.track_id = t.id
        JOIN analysis_results ar ON ar.track_id = t.id
        WHERE 1 = 1
        "
    );

    if has_search {
        sql.push_str(
            "
            AND (
              lower(t.title) LIKE ?1
              OR lower(COALESCE(t.artist, '')) LIKE ?2
              OR lower(COALESCE(t.album, '')) LIKE ?3
            )
            ",
        );
    }

    if has_cursor {
        let base_index = if has_search { 4 } else { 1 };
        sql.push_str(&format!(
            "
            AND (
              {sort_expression} {comparison} ?{base_index}
              OR ({sort_expression} = ?{base_index_plus_one} AND t.id {comparison} ?{base_index_plus_two})
            )
            ",
            base_index = base_index,
            base_index_plus_one = base_index + 1,
            base_index_plus_two = base_index + 2,
        ));
    }

    let limit_param = if has_search && has_cursor {
        7
    } else if has_search {
        4
    } else if has_cursor {
        4
    } else {
        1
    };

    sql.push_str(&format!(
        "
        ORDER BY {sort_expression} {direction}, t.id {direction}
        LIMIT ?{limit_param}
        "
    ));

    sql
}

fn query_tracks<P>(
    statement: &mut rusqlite::Statement<'_>,
    params: P,
) -> Result<Vec<LibraryTrackItem>, ScanError>
where
    P: rusqlite::Params,
{
    let rows = statement.query_map(params, |row| {
        Ok(LibraryTrackItem {
            id: row.get(0)?,
            title: row.get(1)?,
            artist: row.get(2)?,
            album: row.get(3)?,
            duration_seconds: row.get(4)?,
            relative_path: row.get(5)?,
            source_status: row.get(6)?,
            cache_state: row.get(7)?,
            analysis_status: row.get(8)?,
            indexed_at: row.get(9)?,
        })
    })?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }

    Ok(items)
}

#[derive(Clone, Debug)]
struct LibraryCursor {
    sort_key: TrackSortKey,
    sort_direction: SortDirection,
    sort_value: String,
    track_id: String,
}

impl LibraryCursor {
    fn encode(&self) -> String {
        let sort_key = match self.sort_key {
            TrackSortKey::Title => "title",
            TrackSortKey::Artist => "artist",
            TrackSortKey::Album => "album",
            TrackSortKey::IndexedAt => "indexed_at",
        };
        let direction = match self.sort_direction {
            SortDirection::Asc => "asc",
            SortDirection::Desc => "desc",
        };

        format!(
            "{sort_key}|{direction}|{}|{}",
            self.sort_value.replace('|', "%7C"),
            self.track_id.replace('|', "%7C"),
        )
    }

    fn decode(value: &str) -> Option<Self> {
        let mut parts = value.splitn(4, '|');
        let sort_key = match parts.next()? {
            "title" => TrackSortKey::Title,
            "artist" => TrackSortKey::Artist,
            "album" => TrackSortKey::Album,
            "indexed_at" => TrackSortKey::IndexedAt,
            _ => return None,
        };
        let sort_direction = match parts.next()? {
            "asc" => SortDirection::Asc,
            "desc" => SortDirection::Desc,
            _ => return None,
        };

        Some(Self {
            sort_key,
            sort_direction,
            sort_value: parts.next()?.replace("%7C", "|"),
            track_id: parts.next()?.replace("%7C", "|"),
        })
    }
}

fn load_existing_track_ids(
    transaction: &Transaction<'_>,
    library_root_id: &str,
) -> Result<HashMap<String, String>, ScanError> {
    let mut statement = transaction.prepare(
        "
        SELECT relative_path, id
        FROM tracks
        WHERE library_root_id = ?1
        ",
    )?;

    let rows = statement.query_map([library_root_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut mapping = HashMap::new();
    for row in rows {
        let (relative_path, track_id) = row?;
        mapping.insert(relative_path, track_id);
    }

    Ok(mapping)
}

fn upsert_track(
    transaction: &Transaction<'_>,
    track_id: &str,
    library_root: &LibraryRootRecord,
    track: &NormalizedTrack,
    now: &str,
) -> Result<(), ScanError> {
    let imported_at = transaction
        .query_row(
            "SELECT imported_at FROM tracks WHERE id = ?1",
            [track_id],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .unwrap_or_else(|| now.to_owned());

    transaction.execute(
        "
        INSERT INTO tracks (
          id, library_root_id, relative_path, file_name, extension, title, artist, album,
          album_artist, genre, track_number, disc_number, duration_seconds, file_size_bytes,
          artwork_key, content_hash, imported_at, indexed_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, NULL, ?15, ?16, ?17, ?17)
        ON CONFLICT(id) DO UPDATE SET
          library_root_id = excluded.library_root_id,
          relative_path = excluded.relative_path,
          file_name = excluded.file_name,
          extension = excluded.extension,
          title = excluded.title,
          artist = excluded.artist,
          album = excluded.album,
          album_artist = excluded.album_artist,
          genre = excluded.genre,
          track_number = excluded.track_number,
          disc_number = excluded.disc_number,
          duration_seconds = excluded.duration_seconds,
          file_size_bytes = excluded.file_size_bytes,
          content_hash = excluded.content_hash,
          indexed_at = excluded.indexed_at,
          updated_at = excluded.updated_at
        ",
        params![
            track_id,
            library_root.id,
            track.relative_path,
            track.file_name,
            track.extension,
            track.title,
            track.artist,
            track.album,
            track.album_artist,
            track.genre,
            track.track_number,
            track.disc_number,
            track.duration_seconds,
            track.file_size_bytes,
            track.content_hash,
            imported_at,
            now,
        ],
    )?;

    Ok(())
}

fn upsert_track_source(
    transaction: &Transaction<'_>,
    track_id: &str,
    track: &NormalizedTrack,
    now: &str,
) -> Result<(), ScanError> {
    transaction.execute(
        "
        INSERT INTO track_sources (
          track_id, local_path, atlas_object_id, atlas_version, source_status, version_hash, last_verified_at
        )
        VALUES (?1, ?2, NULL, NULL, ?3, ?4, ?5)
        ON CONFLICT(track_id) DO UPDATE SET
          local_path = excluded.local_path,
          source_status = excluded.source_status,
          version_hash = excluded.version_hash,
          last_verified_at = excluded.last_verified_at
        ",
        params![
            track_id,
            track.local_path,
            schema::TrackSourceStatus::LocalOnly.as_str(),
            track.content_hash,
            now,
        ],
    )?;

    Ok(())
}

fn ensure_cache_entry(
    transaction: &Transaction<'_>,
    track_id: &str,
    now: &str,
) -> Result<(), ScanError> {
    transaction.execute(
        "
        INSERT INTO cache_entries (
          track_id, cache_state, local_cache_path, temp_cache_path, cache_size_bytes,
          last_accessed_at, created_at, updated_at
        )
        VALUES (?1, ?2, NULL, NULL, 0, NULL, ?3, ?3)
        ON CONFLICT(track_id) DO NOTHING
        ",
        params![track_id, schema::CacheState::None.as_str(), now],
    )?;

    Ok(())
}

fn ensure_analysis_entry(
    transaction: &Transaction<'_>,
    track_id: &str,
    now: &str,
) -> Result<(), ScanError> {
    transaction.execute(
        "
        INSERT INTO analysis_results (
          track_id, analysis_status, bpm, energy, tonal_profile, spectral_profile,
          dynamic_range, flow_metric, analyzer_version, failure_reason, queued_at,
          analyzed_at, updated_at
        )
        VALUES (?1, ?2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?3, NULL, ?3)
        ON CONFLICT(track_id) DO NOTHING
        ",
        params![track_id, schema::AnalysisStatus::Pending.as_str(), now],
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{discover_mp3_files, normalize_track, LocalLibraryScanner};
    use crate::database::AppDatabase;

    fn unique_temp_dir() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("resona-scan-test-{nanos}"))
    }

    #[test]
    fn discovers_nested_mp3_files_only() {
        let root = unique_temp_dir();
        let nested = root.join("disc-one");
        fs::create_dir_all(&nested).expect("directories should be created");
        fs::File::create(root.join("track-a.mp3")).expect("mp3 file should be created");
        fs::File::create(nested.join("track-b.MP3")).expect("mp3 file should be created");
        fs::File::create(root.join("cover.jpg")).expect("non-mp3 file should be created");

        let discovered = discover_mp3_files(&root).expect("scan should succeed");

        assert_eq!(discovered.len(), 2);
    }

    #[test]
    fn normalizes_track_with_filename_fallback() {
        let root = unique_temp_dir();
        fs::create_dir_all(&root).expect("root should be created");
        let file_path = root.join("My   Track.mp3");
        fs::File::create(&file_path).expect("mp3 file should be created");

        let track = normalize_track(&root, &file_path, "library-root")
            .expect("track should normalize");

        assert_eq!(track.relative_path, "My   Track.mp3");
        assert_eq!(track.title, "My Track");
        assert_eq!(track.extension, "mp3");
    }

    #[test]
    fn persists_recursive_scan_results_into_sqlite() {
        let root = unique_temp_dir();
        let nested = root.join("nested");
        fs::create_dir_all(&nested).expect("directories should be created");

        let root_track = root.join("alpha.mp3");
        let nested_track = nested.join("beta.mp3");

        fs::File::create(&root_track).expect("root track should be created");
        let mut nested_file = fs::File::create(&nested_track).expect("nested track should be created");
        nested_file
            .write_all(b"fake mp3 payload")
            .expect("file should be writable");

        let database_path = root.join("library.sqlite3");
        let database = AppDatabase::initialize_at(&database_path).expect("db should initialize");
        let scanner = LocalLibraryScanner::new(database);

        let summary = scanner
            .scan_path(&root, Some("Test Library"))
            .expect("scan should persist");

        assert_eq!(summary.discovered_tracks, 2);
        assert_eq!(summary.inserted_tracks, 2);
        assert_eq!(summary.updated_tracks, 0);

        let persisted = scanner.library_summary().expect("summary should load");
        assert_eq!(persisted.library_roots, 1);
        assert_eq!(persisted.tracks, 2);
    }
}
