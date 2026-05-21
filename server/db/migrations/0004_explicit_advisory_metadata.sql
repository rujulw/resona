ALTER TABLE tracks
ADD COLUMN advisory BOOLEAN CHECK (advisory IN (0, 1) OR advisory IS NULL);
