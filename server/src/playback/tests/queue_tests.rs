use crate::playback::PlaybackRuntimeState;

#[test]
fn replace_queue_sets_track_ids_and_active_track() {
    let runtime = PlaybackRuntimeState::default();

    let snapshot = runtime.replace_queue(
        vec!["a".to_owned(), "b".to_owned()],
        Some("b"),
        "test-source",
    );

    assert_eq!(snapshot.track_ids, vec!["a", "b"]);
    assert_eq!(snapshot.active_track_id.as_deref(), Some("b"));
    assert_eq!(snapshot.source_label, "test-source");
}

#[test]
fn replace_queue_inserts_active_if_missing() {
    let runtime = PlaybackRuntimeState::default();

    let snapshot = runtime.replace_queue(
        vec!["a".to_owned(), "b".to_owned()],
        Some("c"),
        "test-source",
    );

    assert_eq!(snapshot.track_ids[0], "c");
    assert_eq!(snapshot.active_track_id.as_deref(), Some("c"));
}

#[test]
fn queue_snapshot_empty_defaults_to_manual_selection() {
    let runtime = PlaybackRuntimeState::default();

    let snapshot = runtime.queue_snapshot();

    assert!(snapshot.track_ids.is_empty());
    assert_eq!(snapshot.active_track_id, None);
    assert_eq!(snapshot.source_label, "manual-selection");
}
