PRAGMA foreign_keys = OFF;

ALTER TABLE track_sources RENAME TO track_sources_old;
ALTER TABLE cache_entries RENAME TO cache_entries_old;
ALTER TABLE analysis_results RENAME TO analysis_results_old;
ALTER TABLE tracks RENAME TO tracks_old;

CREATE TABLE tracks (
  id TEXT PRIMARY KEY,
  library_root_id TEXT NOT NULL REFERENCES library_roots(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  extension TEXT NOT NULL CHECK (extension IN ('mp3', 'flac')),
  title TEXT,
  artist TEXT,
  album TEXT,
  album_artist TEXT,
  genre TEXT,
  track_number INTEGER,
  disc_number INTEGER,
  duration_seconds REAL,
  file_size_bytes INTEGER NOT NULL,
  artwork_key TEXT,
  content_hash TEXT,
  imported_at TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(library_root_id, relative_path)
);

INSERT INTO tracks (
  id, library_root_id, relative_path, file_name, extension, title, artist, album,
  album_artist, genre, track_number, disc_number, duration_seconds, file_size_bytes,
  artwork_key, content_hash, imported_at, indexed_at, updated_at
)
SELECT
  id, library_root_id, relative_path, file_name, extension, title, artist, album,
  album_artist, genre, track_number, disc_number, duration_seconds, file_size_bytes,
  artwork_key, content_hash, imported_at, indexed_at, updated_at
FROM tracks_old;

DROP TABLE tracks_old;

CREATE TABLE track_sources (
  track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  local_path TEXT,
  atlas_object_id TEXT,
  atlas_version TEXT,
  source_status TEXT NOT NULL CHECK (
    source_status IN ('local-only', 'atlas-linked', 'atlas-only', 'missing')
  ),
  version_hash TEXT,
  last_verified_at TEXT,
  CHECK (local_path IS NOT NULL OR atlas_object_id IS NOT NULL)
);

INSERT INTO track_sources (
  track_id, local_path, atlas_object_id, atlas_version, source_status, version_hash, last_verified_at
)
SELECT
  track_id, local_path, atlas_object_id, atlas_version, source_status, version_hash, last_verified_at
FROM track_sources_old;

DROP TABLE track_sources_old;

CREATE TABLE cache_entries (
  track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  cache_state TEXT NOT NULL CHECK (
    cache_state IN ('none', 'partial', 'ready', 'stale')
  ),
  local_cache_path TEXT,
  temp_cache_path TEXT,
  cache_size_bytes INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO cache_entries (
  track_id, cache_state, local_cache_path, temp_cache_path, cache_size_bytes, last_accessed_at, created_at, updated_at
)
SELECT
  track_id, cache_state, local_cache_path, temp_cache_path, cache_size_bytes, last_accessed_at, created_at, updated_at
FROM cache_entries_old;

DROP TABLE cache_entries_old;

CREATE TABLE analysis_results (
  track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  analysis_status TEXT NOT NULL CHECK (
    analysis_status IN ('pending', 'processing', 'ready', 'failed')
  ),
  bpm REAL,
  energy REAL,
  tonal_profile TEXT,
  spectral_profile TEXT,
  dynamic_range REAL,
  flow_metric REAL,
  analyzer_version TEXT,
  failure_reason TEXT,
  queued_at TEXT,
  analyzed_at TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO analysis_results (
  track_id, analysis_status, bpm, energy, tonal_profile, spectral_profile, dynamic_range,
  flow_metric, analyzer_version, failure_reason, queued_at, analyzed_at, updated_at
)
SELECT
  track_id, analysis_status, bpm, energy, tonal_profile, spectral_profile, dynamic_range,
  flow_metric, analyzer_version, failure_reason, queued_at, analyzed_at, updated_at
FROM analysis_results_old;

DROP TABLE analysis_results_old;

CREATE INDEX IF NOT EXISTS idx_tracks_library_root_id
  ON tracks(library_root_id);

CREATE INDEX IF NOT EXISTS idx_tracks_title
  ON tracks(title);

CREATE INDEX IF NOT EXISTS idx_tracks_artist
  ON tracks(artist);

CREATE INDEX IF NOT EXISTS idx_tracks_album
  ON tracks(album);

CREATE INDEX IF NOT EXISTS idx_tracks_indexed_at
  ON tracks(indexed_at);

CREATE INDEX IF NOT EXISTS idx_tracks_title_id
  ON tracks(title, id);

CREATE INDEX IF NOT EXISTS idx_tracks_artist_id
  ON tracks(artist, id);

CREATE INDEX IF NOT EXISTS idx_tracks_album_id
  ON tracks(album, id);

CREATE INDEX IF NOT EXISTS idx_tracks_indexed_at_id
  ON tracks(indexed_at, id);

PRAGMA foreign_keys = ON;
