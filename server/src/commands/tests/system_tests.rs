use super::test_database_state;
use crate::commands::{
    bootstrap_app, build_shell_state, build_shell_state_with_playback, playback_state_for_action,
};

#[test]
fn bootstrap_payload_exposes_shell_runtime() {
    let payload = bootstrap_app();

    assert_eq!(payload.app_name, "resona");
    assert_eq!(payload.window_title, "resona");
    assert_eq!(payload.runtime.desktop_shell, "tauri");
    assert_eq!(payload.runtime.frontend, "react-vite");
    assert_eq!(payload.runtime.core, "rust");
}

#[test]
fn shell_state_returns_nav_rows_and_playback_defaults() {
    let database_state = test_database_state();
    let payload = build_shell_state(&database_state.app_database);

    assert_eq!(payload.nav_sections.len(), 6);
    assert_eq!(payload.library_rows.len(), 3);
    assert_eq!(payload.library_rows[1].title, "atlas");
    assert_eq!(payload.persistence.status_label, "Ready");
    assert_eq!(payload.persistence.track_count, 0);
    assert_eq!(payload.playback.status_label, "Nothing playing");
    assert_eq!(payload.playback.transport_label, "Idle");
}

#[test]
fn shell_state_can_embed_runtime_playback_snapshot() {
    let database_state = test_database_state();
    let playback = playback_state_for_action("toggle");
    let payload = build_shell_state_with_playback(&database_state.app_database, playback);

    assert_eq!(payload.playback.transport_label, "Play requested");
}
