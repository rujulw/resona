ALTER TABLE playlists ADD COLUMN hidden_from_sidebar INTEGER NOT NULL DEFAULT 0;
ALTER TABLE concept_albums ADD COLUMN hidden_from_sidebar INTEGER NOT NULL DEFAULT 0;
