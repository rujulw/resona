ALTER TABLE tracks ADD COLUMN year INTEGER;

CREATE TABLE IF NOT EXISTS play_events (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  played_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_play_events_track_id
  ON play_events(track_id);

CREATE INDEX IF NOT EXISTS idx_play_events_played_at
  ON play_events(played_at);
