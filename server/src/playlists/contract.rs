use super::types::{PlaylistCommandContract, PlaylistContract, PlaylistQueueHandoffContract};

const PLAYLIST_ORDERING_MODE: &str = "dense-zero-based-position";
const PLAYLIST_DUPLICATE_POLICY: &str = "allowed-as-distinct-entries";
const PLAYLIST_QUEUE_HANDOFF_MODE: &str = "replace-backend-queue-from-playlist-order";

pub fn playlist_contract() -> PlaylistContract {
    PlaylistContract {
        storage_boundary: "sqlite persists playlist identity separately from ordered playlist entries so reorders do not rewrite playlist records",
        ordering_mode: PLAYLIST_ORDERING_MODE,
        duplicate_policy: PLAYLIST_DUPLICATE_POLICY,
        queue_handoff: PlaylistQueueHandoffContract {
            mode: PLAYLIST_QUEUE_HANDOFF_MODE,
            request_shape: "{ playlistId, startEntryId? }",
            response_shape: "PlaybackQueueSnapshot",
            active_entry_rule: "if startEntryId is present it must belong to playlistId; otherwise playback begins from the first playlist entry",
            queue_order_rule: "queue track order matches playlist entry order exactly at handoff time and stays stable even if the visible playlist view later previews drag targets or commits a saved-order replacement",
        },
        planned_commands: vec![
            PlaylistCommandContract {
                name: "create_playlist",
                summary: "Create a local playlist shell with a user-visible name before entries are added.",
                request_shape: "{ name, description?, artworkPath? }",
                response_shape: "PlaylistSummary",
            },
            PlaylistCommandContract {
                name: "update_playlist",
                summary: "Update playlist metadata without affecting entry order or queue state.",
                request_shape: "{ playlistId, name, description?, artworkPath? }",
                response_shape: "PlaylistSummary",
            },
            PlaylistCommandContract {
                name: "replace_playlist_entries",
                summary: "Commit one explicit full-order replacement for playlist entries after add, remove, or drag-reorder operations.",
                request_shape: "{ playlistId, entries: [{ entryId?, trackId, position }] }",
                response_shape: "PlaylistDetail",
            },
            PlaylistCommandContract {
                name: "handoff_playlist_to_queue",
                summary: "Replace the backend playback queue from playlist order and optionally begin from a chosen playlist entry.",
                request_shape: "{ playlistId, startEntryId? }",
                response_shape: "PlaybackQueueSnapshot",
            },
        ],
        guarantees: vec![
            "playlist entry identity is separate from track identity so the same track can appear more than once in a playlist without ambiguity",
            "playlist order is determined only by ascending entry position and never by track title artist album or insertion timestamp",
            "positions are dense and zero-based after each committed reorder so neighboring inserts and moves remain deterministic",
            "drag-reorder drop intent resolves against one row at a time with explicit before-or-after placement instead of ambiguous freeform insertion",
            "saved-order changes persist only when the client commits one explicit replacement payload rather than while hover previews are still in flight",
            "queue handoff copies playlist order into the backend playback queue at one moment in time instead of creating a live coupled view",
            "playlist deletion cascades to playlist entries while track deletion removes dependent local-playlist entries for the current local-first milestone",
        ],
    }
}
