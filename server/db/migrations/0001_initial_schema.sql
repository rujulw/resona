PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS library_roots (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  selected_path TEXT NOT NULL UNIQUE,
  source_mode TEXT NOT NULL CHECK (source_mode IN ('local', 'atlas-linked')),
  scan_depth TEXT NOT NULL DEFAULT 'recursive' CHECK (scan_depth IN ('recursive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_scan_started_at TEXT,
  last_scan_completed_at TEXT
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  library_root_id TEXT NOT NULL REFERENCES library_roots(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  extension TEXT NOT NULL CHECK (extension IN ('mp3')),
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

CREATE INDEX IF NOT EXISTS idx_tracks_library_root_id
  ON tracks(library_root_id);

CREATE INDEX IF NOT EXISTS idx_tracks_title
  ON tracks(title);

CREATE INDEX IF NOT EXISTS idx_tracks_artist
  ON tracks(artist);

CREATE TABLE IF NOT EXISTS track_sources (
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

CREATE TABLE IF NOT EXISTS cache_entries (
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

CREATE INDEX IF NOT EXISTS idx_cache_entries_cache_state
  ON cache_entries(cache_state);

CREATE TABLE IF NOT EXISTS analysis_results (
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

CREATE INDEX IF NOT EXISTS idx_analysis_results_status
  ON analysis_results(analysis_status);
