CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(trim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS playlist_entries (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  added_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (playlist_id, position)
);

CREATE INDEX IF NOT EXISTS idx_playlist_entries_playlist_position
  ON playlist_entries(playlist_id, position);

CREATE INDEX IF NOT EXISTS idx_playlist_entries_track_id
  ON playlist_entries(track_id);
