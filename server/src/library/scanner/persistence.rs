use std::collections::HashMap;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension, Transaction};

use crate::database::{schema, AppDatabase};

use super::super::models::{LibraryRootRecord, NormalizedTrack, ScanError, ScanSummary};

pub(super) fn persist_scan(
    app_database: &AppDatabase,
    library_root: &LibraryRootRecord,
    normalized_tracks: &[NormalizedTrack],
) -> Result<ScanSummary, ScanError> {
    let mut connection = app_database.connect()?;
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

        sync_track_artwork(app_database, &transaction, &track_id, track)?;
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
        remove_track_artwork(app_database, &transaction, track_id)?;
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
          album_artist, genre, advisory, track_number, disc_number, duration_seconds,
          file_size_bytes, artwork_key, content_hash, imported_at, indexed_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
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
          advisory = excluded.advisory,
          track_number = excluded.track_number,
          disc_number = excluded.disc_number,
          duration_seconds = excluded.duration_seconds,
          file_size_bytes = excluded.file_size_bytes,
          artwork_key = excluded.artwork_key,
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
            track.advisory,
            track.track_number,
            track.disc_number,
            track.duration_seconds,
            track.file_size_bytes,
            track.artwork_key,
            track.content_hash,
            imported_at,
            now,
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

fn sync_track_artwork(
    app_database: &AppDatabase,
    transaction: &Transaction<'_>,
    track_id: &str,
    track: &NormalizedTrack,
) -> Result<(), ScanError> {
    let existing_artwork_key = transaction
        .query_row(
            "SELECT artwork_key FROM tracks WHERE id = ?1",
            [track_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()?
        .flatten();

    let artwork_dir = app_database.app_data_dir().join("artwork");

    if let Some(existing_key) = existing_artwork_key.as_ref() {
        if track.artwork_key.as_ref() != Some(existing_key) {
            let _ = fs::remove_file(artwork_dir.join(existing_key));
        }
    }

    if let (Some(artwork_key), Some(artwork_bytes)) =
        (track.artwork_key.as_ref(), track.artwork_bytes.as_ref())
    {
        fs::create_dir_all(&artwork_dir)?;
        fs::write(artwork_dir.join(artwork_key), artwork_bytes)?;
    }

    Ok(())
}

fn remove_track_artwork(
    app_database: &AppDatabase,
    transaction: &Transaction<'_>,
    track_id: &str,
) -> Result<(), ScanError> {
    let artwork_key = transaction
        .query_row(
            "SELECT artwork_key FROM tracks WHERE id = ?1",
            [track_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()?
        .flatten();

    if let Some(artwork_key) = artwork_key {
        let _ = fs::remove_file(
            app_database
                .app_data_dir()
                .join("artwork")
                .join(artwork_key),
        );
    }

    Ok(())
}
