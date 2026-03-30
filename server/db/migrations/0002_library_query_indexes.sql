CREATE INDEX IF NOT EXISTS idx_tracks_album
  ON tracks(album);

CREATE INDEX IF NOT EXISTS idx_tracks_indexed_at
  ON tracks(indexed_at);

CREATE INDEX IF NOT EXISTS idx_tracks_title_id
  ON tracks(title, id);

CREATE INDEX IF NOT EXISTS idx_tracks_artist_id
  ON tracks(artist, id);

CREATE INDEX IF NOT EXISTS idx_tracks_album_id
  ON tracks(album, id);

CREATE INDEX IF NOT EXISTS idx_tracks_indexed_at_id
  ON tracks(indexed_at, id);
