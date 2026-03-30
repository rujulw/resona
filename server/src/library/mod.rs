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
