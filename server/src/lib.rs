mod commands;
mod database;
mod library;
mod playback;
mod playlists;
mod presence;

use commands::{
    bootstrap_app, complete_playback, describe_playback_contract, describe_playlist_contract,
    get_shell_state, load_playback_track, playback_action, query_library, report_playback_error,
    resolve_artwork_source, resolve_track_playback_source, scan_local_library, seek_playback,
    sync_playback_timing, DatabaseState,
};
use database::AppDatabase;
use playback::PlaybackRuntimeState;
use presence::{register_global_presence, PresenceRuntimeState};

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
            bootstrap_app,
            complete_playback,
            describe_playback_contract,
            describe_playlist_contract,
            get_shell_state,
            load_playback_track,
            report_playback_error,
            scan_local_library,
            query_library,
            resolve_artwork_source,
            resolve_track_playback_source,
            playback_action,
            seek_playback,
            sync_playback_timing
        ])
        .run(tauri::generate_context!())
        .expect("failed to run resona tauri application");
}
