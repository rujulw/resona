CREATE TABLE IF NOT EXISTS artist_image_configs (
  artist_name TEXT PRIMARY KEY,
  local_image_path TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
