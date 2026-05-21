-- Distinguishes locally-recorded plays from imported history.
-- 'local'          : recorded during active resona playback
-- 'spotify-import' : matched from a Spotify GDPR export file
ALTER TABLE play_events ADD COLUMN source TEXT NOT NULL DEFAULT 'local';

CREATE INDEX IF NOT EXISTS idx_play_events_source ON play_events(source);
