use crate::playback::PlaybackRuntimeState;

// Direct access to PlaybackQueue from within the playback module tree.
use super::super::queue::PlaybackQueue;

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
#[test]
fn user_queue_takes_priority_over_context() {
    let mut queue = PlaybackQueue::default();
    queue.replace_context(
        vec!["ctx-1".to_owned(), "ctx-2".to_owned()],
        Some("ctx-1"),
        "album",
    );
    queue.push_next("user-1".to_owned());

    let first = queue.resolve_next();
    let second = queue.resolve_next();

    assert_eq!(first.as_deref(), Some("user-1"), "user queue item should come before context");
    assert_eq!(second.as_deref(), Some("ctx-2"), "context advances after user queue drains");
}

#[test]
fn push_next_and_push_back_ordering() {
    let mut queue = PlaybackQueue::default();
    queue.replace_context(vec![], None, "test");

    queue.push_next("priority".to_owned());
    queue.push_back("last".to_owned());
    queue.push_next("first".to_owned());

    assert_eq!(queue.resolve_next().as_deref(), Some("first"));
    assert_eq!(queue.resolve_next().as_deref(), Some("priority"));
    assert_eq!(queue.resolve_next().as_deref(), Some("last"));
}

#[test]
fn context_cursor_advances_sequentially() {
    let mut queue = PlaybackQueue::default();
    queue.replace_context(
        vec!["a".to_owned(), "b".to_owned(), "c".to_owned()],
        Some("a"),
        "playlist",
    );

    assert_eq!(queue.resolve_next().as_deref(), Some("b"));
    assert_eq!(queue.resolve_next().as_deref(), Some("c"));
    assert_eq!(queue.resolve_next(), None, "context exhausted returns None");
}

#[test]
fn resolve_next_returns_none_on_empty_queue() {
    let mut queue = PlaybackQueue::default();

    assert_eq!(queue.resolve_next(), None);
}

#[test]
fn resolve_next_returns_none_after_full_context_consumed() {
    let mut queue = PlaybackQueue::default();
    queue.replace_context(
        vec!["x".to_owned(), "y".to_owned()],
        Some("x"),
        "source",
    );

    queue.resolve_next(); // advances to "y"
    queue.resolve_next(); // past end

    assert_eq!(queue.resolve_next(), None);
}

#[test]
fn replace_context_clears_user_queue() {
    let mut queue = PlaybackQueue::default();
    queue.push_next("stale".to_owned());
    queue.replace_context(vec!["fresh".to_owned()], Some("fresh"), "new-source");

    // resolve_next on the context starting from cursor 0 (the active), which
    // means the next item would be beyond "fresh" — but since "fresh" is the
    // only track AND it is at the cursor, the next call should return None.
    assert_eq!(queue.resolve_next(), None, "user queue flushed on replace_context");
}

#[test]
fn is_empty_reflects_both_tiers() {
    let mut queue = PlaybackQueue::default();
    assert!(queue.is_empty());

    queue.push_back("track".to_owned());
    assert!(!queue.is_empty());

    queue.replace_context(vec![], None, "clear");
    // user queue was cleared by replace_context; context is empty; should be empty again
    assert!(queue.is_empty());
}
