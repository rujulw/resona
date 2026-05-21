CREATE TABLE IF NOT EXISTS artist_analytics_overrides (
  artist_name TEXT PRIMARY KEY,
  excluded INTEGER NOT NULL DEFAULT 0
);
