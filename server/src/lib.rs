mod albums;
mod artists;
mod commands;
mod concept_albums;
mod database;
mod library;
mod playback;
mod playlists;
mod presence;
mod scores;

use std::sync::{Arc, Mutex};

use crate::commands::{
    add_track_to_concept_album, add_track_to_playlist, bootstrap_app,
    build_initial_artist_image_map, complete_playback, create_concept_album, create_playlist,
    delete_concept_album, delete_playlist, describe_concept_album_contract,
    describe_playback_contract, describe_playlist_contract, extract_score, get_album,
    get_artist_detail, get_artists_images_dir, get_concept_album, get_playlist, get_shell_state,
    handoff_playlist_to_queue, list_albums, list_artists, list_concept_albums, list_playlists,
    load_playback_track, move_concept_album_entry, move_playlist_entry, playback_action,
    query_library, record_play_event, remove_concept_album_entry, remove_playlist_entry,
    replace_concept_album_entries, replace_playlist_entries, report_playback_error,
    resolve_artwork_source, resolve_auto_continue, resolve_track_playback_source,
    scan_local_library, seek_playback, set_artists_images_dir, sync_playback_timing,
    turn_playlist_to_mixtape, update_concept_album, update_playlist, ArtistImageMapState,
    DatabaseState,
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

    let initial_map = build_initial_artist_image_map(&app_database);
    let artist_image_map_state = ArtistImageMapState(Arc::new(Mutex::new(initial_map)));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(DatabaseState { app_database })
        .manage(playback_runtime_state.clone())
        .manage(presence_runtime_state)
        .manage(artist_image_map_state)
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
            extract_score,
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
            record_play_event,
            resolve_artwork_source,
            resolve_auto_continue,
            resolve_track_playback_source,
            playback_action,
            seek_playback,
            sync_playback_timing,
            turn_playlist_to_mixtape,
            update_concept_album,
            update_playlist,
            list_artists,
            get_artist_detail,
            get_artists_images_dir,
            set_artists_images_dir
        ])
        .run(tauri::generate_context!())
        .expect("failed to run resona tauri application");
}
