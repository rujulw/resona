// Analytics module — local play history aggregation and Spotify GDPR history import.
//
// ## Query contracts (implemented in queries.rs)
//
// get_top_tracks(conn, window, limit) → Vec<TopTrackEntry>
//   GROUP BY track_id on play_events JOIN tracks.
//   Optional time window filters by played_at >= now - window_days * 86_400_000.
//
// get_top_artists(conn, window, limit, image_map) → Vec<TopArtistEntry>
//   Unions play_events JOIN tracks (local) with spotify_ghost_plays (unmatched imports).
//   Aggregates by artist name, splits "A, B feat. C" into separate artist entries.
//   Resolves artist image paths from the provided image_map.
//
// get_track_play_stats(conn, track_id) → Option<TrackPlayStats>
//   Single-track COUNT/MIN/MAX for the player info panel.
//
// ## Spotify import contract (implemented in import.rs)
//
// Input:  StreamingHistory_music_*.json  (Spotify GDPR extended data request)
// Fields: ts (ISO-8601), master_metadata_track_name, master_metadata_album_artist_name, ms_played
//
// Eligibility threshold: ms_played >= 30_000
//
// Normalization applied to both sides before matching:
//   1. lowercase
//   2. strip parenthetical features: remove `(feat. …)`, `(ft. …)`, `[…]`
//   3. collapse runs of whitespace, trim
//   4. drop all punctuation except ASCII hyphen `-`
//
// Match condition (after normalization):
//   title matches AND (local.artist starts_with spotify.artist OR vice-versa)
//
// Unmatched entries are stored in spotify_ghost_plays so artist analytics still count
// them and so they get absorbed into play_events if the track is added locally later.
//
// absorb_ghost_plays(tx, track_id, title_norm, artist_norm) — called by the library
//   scanner after a new track is inserted; migrates matching ghost rows to play_events.

mod import;
mod queries;

pub use import::{
    absorb_ghost_plays, import_spotify_history, import_spotify_history_folder,
    normalize as normalize_for_matching, SpotifyImportOptions, SpotifyImportResult,
};
pub use queries::{
    get_top_artists, get_top_tracks, get_track_play_stats, AnalyticsWindow, TopArtistEntry,
    TopTrackEntry, TrackPlayStats,
};
