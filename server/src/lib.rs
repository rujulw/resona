mod commands;
mod database;
mod library;
mod playback;

use commands::{
    bootstrap_app, describe_playback_contract, get_shell_state, playback_action, query_library,
    resolve_artwork_source, resolve_track_playback_source, scan_local_library, DatabaseState,
};
use database::AppDatabase;

pub fn run() {
    let app_database =
        AppDatabase::initialize_default().expect("failed to initialize resona database");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(DatabaseState { app_database })
        .invoke_handler(tauri::generate_handler![
            bootstrap_app,
            describe_playback_contract,
            get_shell_state,
            scan_local_library,
            query_library,
            resolve_artwork_source,
            resolve_track_playback_source,
            playback_action
        ])
        .run(tauri::generate_context!())
        .expect("failed to run resona tauri application");
}
