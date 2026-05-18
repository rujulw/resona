// Analytics module — local play history aggregation and Spotify GDPR history import.
//
// ## Query contracts (implemented in queries.rs)
//
// get_top_tracks(conn, window, limit) → Vec<TopTrackEntry>
//   GROUP BY track_id on play_events JOIN tracks.
//   Optional time window filters by played_at >= now - window_days * 86_400_000.
//
// get_top_artists(conn, window, limit) → Vec<TopArtistEntry>
//   Same join, GROUP BY t.artist. Primary artist = full artist string as stored
//   (caller can split on separator if needed for display).
//
// get_track_play_stats(conn, track_id) → Option<TrackPlayStats>
//   Single-track COUNT/MIN/MAX for the player info panel.
//
// ## Spotify import contract (implemented in import.rs)
//
// Input:  StreamingHistory_music_*.json  (Spotify GDPR data request)
// Fields: ts (ISO-8601), trackName, artistName, msPlayed
//
// Eligibility threshold: msPlayed >= 30_000
//
// Normalization applied to both sides before matching:
//   1. lowercase
//   2. strip parenthetical features: remove `(feat. …)`, `(ft. …)`, `[…]`
//   3. collapse runs of whitespace, trim
//   4. drop all punctuation except ASCII hyphen `-`
//
// Match condition (after normalization):
//   title matches AND (local.artist starts_with spotify.artistName
//                      OR spotify.artistName starts_with local.artist)
//
// Duplicate guard: skip if play_events already has a row with the same track_id
//   and a played_at within ±60_000 ms and source = 'spotify-import'.
//
// Inserted rows carry source = 'spotify-import'.
// All inserts go in a single transaction for atomicity and performance.

mod import;
mod queries;

pub use import::{import_spotify_history, SpotifyImportOptions, SpotifyImportResult};
pub use queries::{
    get_top_artists, get_top_tracks, get_track_play_stats, AnalyticsWindow, TopArtistEntry,
    TopTrackEntry, TrackPlayStats,
};
