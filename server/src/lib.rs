mod commands;
mod database;
mod library;
mod playback;

use commands::{
    bootstrap_app, complete_playback, describe_playback_contract, get_shell_state,
    load_playback_track, playback_action, query_library, report_playback_error,
    resolve_artwork_source, resolve_track_playback_source, scan_local_library, seek_playback,
    sync_playback_timing, DatabaseState,
};
use database::AppDatabase;
use playback::PlaybackRuntimeState;

pub fn run() {
    let app_database =
        AppDatabase::initialize_default().expect("failed to initialize resona database");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(DatabaseState { app_database })
        .manage(PlaybackRuntimeState::default())
        .invoke_handler(tauri::generate_handler![
            bootstrap_app,
            complete_playback,
            describe_playback_contract,
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
