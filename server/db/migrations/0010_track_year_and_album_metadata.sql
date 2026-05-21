ALTER TABLE tracks ADD COLUMN year INTEGER;

CREATE TABLE IF NOT EXISTS album_metadata (
  artist TEXT NOT NULL,
  title TEXT NOT NULL,
  popularity INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (artist, title)
);

ALTER TABLE concept_albums ADD COLUMN popularity INTEGER NOT NULL DEFAULT 0;
