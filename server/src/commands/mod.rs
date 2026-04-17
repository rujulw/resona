use crate::database::AppDatabase;

pub mod library;
pub mod playback;
pub mod playlists;
pub mod system;

#[cfg(test)]
pub mod tests;

pub use library::{
    get_album, list_albums, query_library, resolve_artwork_source, resolve_track_playback_source,
    scan_local_library,
};
pub use playback::{
    complete_playback, describe_playback_contract, load_playback_track, playback_action,
    report_playback_error, seek_playback, sync_playback_timing,
};
pub use playlists::{
    add_track_to_playlist, create_playlist, delete_playlist, describe_playlist_contract,
    get_playlist, handoff_playlist_to_queue, list_playlists, move_playlist_entry,
    remove_playlist_entry, replace_playlist_entries, update_playlist,
};
pub use system::{bootstrap_app, get_shell_state};

#[cfg(test)]
pub use library::{
    get_album_with_database, list_albums_with_database, query_library_with_database,
    resolve_track_playback_source_with_database, scan_local_library_with_database,
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
    replace_playlist_entries_with_database, update_playlist_with_database,
};

#[cfg(test)]
pub use system::{build_shell_state, build_shell_state_with_playback};

pub struct DatabaseState {
    pub app_database: AppDatabase,
}
