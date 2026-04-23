mod albums;
mod commands;
mod concept_albums;
mod database;
mod library;
mod playback;
mod playlists;
mod presence;

use crate::commands::{
    add_track_to_concept_album, add_track_to_playlist, bootstrap_app, complete_playback,
    create_concept_album, create_playlist, delete_concept_album, delete_playlist,
    describe_concept_album_contract, describe_playback_contract, describe_playlist_contract,
    get_album, get_concept_album, get_playlist, get_shell_state, handoff_playlist_to_queue,
    list_albums, list_concept_albums, list_playlists, load_playback_track,
    move_concept_album_entry, move_playlist_entry, playback_action, query_library,
    remove_concept_album_entry, remove_playlist_entry, replace_concept_album_entries,
    replace_playlist_entries, report_playback_error, resolve_artwork_source,
    resolve_track_playback_source, scan_local_library, seek_playback, sync_playback_timing,
    turn_playlist_to_mixtape, update_concept_album, update_playlist, DatabaseState,
};
use crate::database::AppDatabase;
use crate::playback::PlaybackRuntimeState;
use crate::presence::{register_global_presence, PresenceRuntimeState};

pub fn run() {
    let app_database =
        AppDatabase::initialize_default().expect("failed to initialize resona database");
    let playback_runtime_state = PlaybackRuntimeState::default();
    let presence_runtime_state = PresenceRuntimeState::default();
    register_global_presence(presence_runtime_state.clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(DatabaseState { app_database })
        .manage(playback_runtime_state.clone())
        .manage(presence_runtime_state)
        .setup(move |app| {
            playback_runtime_state.register_app_handle(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            add_track_to_playlist,
            add_track_to_concept_album,
            bootstrap_app,
            complete_playback,
            create_concept_album,
            create_playlist,
            delete_concept_album,
            delete_playlist,
            describe_concept_album_contract,
            describe_playback_contract,
            describe_playlist_contract,
            get_album,
            get_concept_album,
            get_playlist,
            get_shell_state,
            handoff_playlist_to_queue,
            list_albums,
            list_concept_albums,
            list_playlists,
            load_playback_track,
            move_concept_album_entry,
            move_playlist_entry,
            report_playback_error,
            remove_concept_album_entry,
            remove_playlist_entry,
            replace_concept_album_entries,
            replace_playlist_entries,
            scan_local_library,
            query_library,
            resolve_artwork_source,
            resolve_track_playback_source,
            playback_action,
            seek_playback,
            sync_playback_timing,
            turn_playlist_to_mixtape,
            update_concept_album,
            update_playlist
        ])
        .run(tauri::generate_context!())
        .expect("failed to run resona tauri application");
}
