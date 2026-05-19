-- Store played duration per event so Spotify-imported plays carry ms_played.
-- NULL means use track duration (local plays recorded before this migration).
ALTER TABLE play_events ADD COLUMN ms_played INTEGER;

-- Spotify entries with no local track match — stored so they count toward
-- artist analytics and get migrated to play_events if the track is added later.
CREATE TABLE IF NOT EXISTS spotify_ghost_plays (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  title_norm TEXT NOT NULL,
  artist_norm TEXT NOT NULL,
  played_at INTEGER NOT NULL,
  ms_played INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ghost_plays_norm
  ON spotify_ghost_plays(title_norm, artist_norm);

CREATE INDEX IF NOT EXISTS idx_ghost_plays_played_at
  ON spotify_ghost_plays(played_at);
