CREATE TABLE IF NOT EXISTS concept_albums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT,
  description TEXT,
  artwork_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(trim(title)) > 0)
);

CREATE TABLE IF NOT EXISTS concept_album_entries (
  id TEXT PRIMARY KEY,
  concept_album_id TEXT NOT NULL REFERENCES concept_albums(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  added_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (concept_album_id, position)
);

CREATE INDEX IF NOT EXISTS idx_concept_album_entries_album_position
  ON concept_album_entries(concept_album_id, position);

CREATE INDEX IF NOT EXISTS idx_concept_album_entries_track_id
  ON concept_album_entries(track_id);
