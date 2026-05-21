use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::database::AppDatabase;

pub struct ArtistImageMapState(pub Arc<Mutex<HashMap<String, String>>>);
pub struct ArtistProfileImageMapState(pub Arc<Mutex<HashMap<String, String>>>);

pub mod albums;
pub mod analytics;
pub mod artists;
pub mod concept_albums;
pub mod library;
pub mod playback;
pub mod playlists;
pub mod scores;
pub mod system;

#[cfg(test)]
pub mod tests;

pub use albums::{get_album, list_albums};
pub use artists::{
    build_initial_artist_image_map, build_initial_artist_profile_image_map, get_artist_detail,
    get_artists_images_dir, get_artists_profile_images_dir, list_artists, set_artists_images_dir,
    set_artists_profile_images_dir,
};
pub use concept_albums::{
    add_track_to_concept_album, create_concept_album, delete_concept_album,
    describe_concept_album_contract, get_concept_album, list_concept_albums,
    move_concept_album_entry, remove_concept_album_entry, replace_concept_album_entries,
    set_concept_album_sidebar_hidden, update_concept_album,
};
pub use library::{
    query_library, resolve_artwork_source, resolve_track_playback_source, scan_local_library,
};
pub use playback::{
    complete_playback, describe_playback_contract, load_playback_track, mutate_queue,
    playback_action, record_play_event, reorder_queue, report_playback_error,
    resolve_auto_continue, seek_playback, sync_playback_timing,
};
pub use playlists::{
    add_track_to_playlist, create_playlist, delete_playlist, describe_playlist_contract,
    get_playlist, handoff_playlist_to_queue, list_playlists, move_playlist_entry,
    remove_playlist_entry, replace_playlist_entries, set_playlist_sidebar_hidden,
    turn_playlist_to_mixtape, update_playlist,
};
pub use analytics::{
    import_spotify_history_file, import_spotify_history_folder, list_excluded_artists,
    query_top_artists, query_top_tracks, query_track_play_stats, set_artist_analytics_excluded,
};
pub use scores::extract_score;
pub use system::{bootstrap_app, get_shell_state};

#[cfg(test)]
pub use albums::{get_album_with_database, list_albums_with_database};
#[cfg(test)]
pub use artists::{get_artist_detail_with_database, list_artists_with_database};
#[cfg(test)]
pub use concept_albums::{
    add_track_to_concept_album_with_database, create_concept_album_with_database,
    delete_concept_album_with_database, get_concept_album_with_database,
    list_concept_albums_with_database, move_concept_album_entry_with_database,
    remove_concept_album_entry_with_database, replace_concept_album_entries_with_database,
    update_concept_album_with_database,
};

#[cfg(test)]
pub use library::{
    query_library_with_database, resolve_track_playback_source_with_database,
    scan_local_library_with_database,
};

#[cfg(test)]
pub use playback::{
    complete_playback_with_runtime, load_playback_track_with_database,
    playback_action_with_runtime, playback_state_for_action, report_playback_error_with_runtime,
    seek_playback_with_runtime, sync_playback_timing_with_runtime,
};

#[cfg(test)]
pub use playlists::{
    add_track_to_playlist_with_database, create_playlist_with_database,
    delete_playlist_with_database, get_playlist_with_database,
    handoff_playlist_to_queue_with_database, list_playlists_with_database,
    move_playlist_entry_with_database, remove_playlist_entry_with_database,
    replace_playlist_entries_with_database, turn_playlist_to_mixtape_with_database,
    update_playlist_with_database,
};

#[cfg(test)]
pub use system::{build_shell_state, build_shell_state_with_playback};

pub struct DatabaseState {
    pub app_database: AppDatabase,
}
