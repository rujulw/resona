mod albums;
mod analytics;
mod artists;
mod commands;
mod concept_albums;
mod database;
mod library;
mod platform;
mod playback;
mod playlists;
mod presence;
mod scores;

use std::sync::{Arc, Mutex};

use crate::commands::{
    add_track_to_concept_album, add_track_to_playlist, bootstrap_app,
    build_initial_artist_image_map, build_initial_artist_profile_image_map, complete_playback,
    create_concept_album, create_playlist, delete_concept_album, delete_playlist,
    describe_concept_album_contract, describe_playback_contract, describe_playlist_contract,
    extract_score, get_album, get_artist_detail, get_artists_images_dir,
    get_artists_profile_images_dir, get_concept_album, get_persisted_volume, get_playlist,
    get_shell_state, handoff_playlist_to_queue, import_spotify_history_file,
    import_spotify_history_folder, list_albums, list_artists, list_concept_albums,
    list_excluded_artists, list_playlists, load_playback_track, move_concept_album_entry,
    move_playlist_entry, mutate_queue, playback_action, query_library, query_top_artists,
    query_top_tracks, query_track_play_stats, record_play_event, remove_concept_album_entry,
    remove_playlist_entry, replace_concept_album_entries, replace_playlist_entries, reorder_queue,
    report_playback_error, resolve_artwork_source, resolve_auto_continue,
    resolve_track_playback_source, scan_local_library, seek_playback, set_artist_analytics_excluded,
    set_artists_images_dir, set_artists_profile_images_dir, set_concept_album_sidebar_hidden,
    set_persisted_volume, set_playlist_sidebar_hidden, set_volume, sync_playback_timing,
    turn_playlist_to_mixtape, update_concept_album, update_now_playing, update_playlist,
    ArtistImageMapState, ArtistProfileImageMapState, DatabaseState,
};
use crate::database::AppDatabase;
use crate::playback::PlaybackRuntimeState;
use crate::presence::{register_global_presence, PresenceRuntimeState};

pub fn run() {
    let app_database =
        AppDatabase::initialize_default().expect("failed to initialize resona database");
    let playback_runtime_state = PlaybackRuntimeState::default();
    let presence_runtime_state = PresenceRuntimeState::new(app_database.app_data_dir().to_path_buf());
    register_global_presence(presence_runtime_state.clone());

    let initial_banner_map = build_initial_artist_image_map(&app_database);
    let artist_image_map_state = ArtistImageMapState(Arc::new(Mutex::new(initial_banner_map)));

    let initial_profile_map = build_initial_artist_profile_image_map(&app_database);
    let artist_profile_image_map_state =
        ArtistProfileImageMapState(Arc::new(Mutex::new(initial_profile_map)));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(DatabaseState { app_database })
        .manage(playback_runtime_state.clone())
        .manage(presence_runtime_state)
        .manage(artist_image_map_state)
        .manage(artist_profile_image_map_state)
        .setup(move |app| {
            use tauri::Emitter;
            use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};

            playback_runtime_state.register_app_handle(app.handle().clone());

            let media_keys: &[(&str, Code)] = &[
                ("media-play-pause", Code::MediaPlayPause),
                ("media-next-track", Code::MediaTrackNext),
                ("media-prev-track", Code::MediaTrackPrevious),
            ];

            for (event_name, code) in media_keys {
                let handle = app.handle().clone();
                let event = event_name.to_string();
                let shortcut = Shortcut::new(None, *code);
                if let Err(e) = app
                    .global_shortcut()
                    .on_shortcut(shortcut, move |_app, _shortcut, ev| {
                        if ev.state() == ShortcutState::Pressed {
                            let _ = handle.emit(&event, ());
                        }
                    })
                {
                    eprintln!("Failed to register global shortcut for {event_name}: {e}");
                }
            }

            #[cfg(target_os = "macos")]
            crate::platform::macos::register_macos_media_keys(app.handle().clone());

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
            import_spotify_history_file,
            import_spotify_history_folder,
            query_top_tracks,
            query_top_artists,
            query_track_play_stats,
            get_concept_album,
            get_playlist,
            get_shell_state,
            handoff_playlist_to_queue,
            mutate_queue,
            reorder_queue,
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
            set_artists_images_dir,
            get_artists_profile_images_dir,
            set_artists_profile_images_dir,
            set_playlist_sidebar_hidden,
            set_concept_album_sidebar_hidden,
            set_artist_analytics_excluded,
            list_excluded_artists,
            update_now_playing,
            set_volume,
            get_persisted_volume,
            set_persisted_volume
        ])
        .run(tauri::generate_context!())
        .expect("failed to run resona tauri application");
}
