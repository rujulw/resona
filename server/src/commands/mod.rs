use crate::database::AppDatabase;

pub mod library;
pub mod playback;
pub mod playlists;
pub mod system;

#[cfg(test)]
pub mod tests;

pub use library::{
    query_library, query_library_with_database, resolve_artwork_source,
    resolve_artwork_source_with_database, resolve_track_playback_source,
    resolve_track_playback_source_with_database, scan_local_library,
    scan_local_library_with_database,
};
pub use playback::{
    complete_playback, describe_playback_contract, load_playback_track,
    load_playback_track_with_database, playback_action, playback_action_with_runtime,
    report_playback_error, seek_playback, sync_playback_timing,
};
pub use playlists::{
    add_track_to_playlist, add_track_to_playlist_with_database, create_playlist,
    create_playlist_with_database, delete_playlist, delete_playlist_with_database,
    describe_playlist_contract, get_playlist, get_playlist_with_database,
    handoff_playlist_to_queue, handoff_playlist_to_queue_with_database, list_playlists,
    list_playlists_with_database, move_playlist_entry, move_playlist_entry_with_database,
    remove_playlist_entry, remove_playlist_entry_with_database, replace_playlist_entries,
    replace_playlist_entries_with_database, update_playlist, update_playlist_with_database,
    PlaylistEntryInput, PlaylistPlaybackHandoffPayload,
};
pub use system::{
    bootstrap_app, build_shell_state_with_playback, get_shell_state, BootstrapPayload,
    LibraryRow, NavSection, PersistenceState, RuntimeInfo, ShellStatePayload,
};

#[cfg(test)]
pub use system::build_shell_state;

#[cfg(test)]
pub use playback::{
    complete_playback_with_runtime, playback_state_for_action,
    report_playback_error_with_runtime, seek_playback_with_runtime,
    sync_playback_timing_with_runtime,
};

pub struct DatabaseState {
    pub app_database: AppDatabase,
}