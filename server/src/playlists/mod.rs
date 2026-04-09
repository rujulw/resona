use serde::Serialize;

pub const PLAYLIST_ORDERING_MODE: &str = "dense-zero-based-position";
pub const PLAYLIST_DUPLICATE_POLICY: &str = "allowed-as-distinct-entries";
pub const PLAYLIST_QUEUE_HANDOFF_MODE: &str = "replace-backend-queue-from-playlist-order";

#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistContract {
    pub storage_boundary: &'static str,
    pub ordering_mode: &'static str,
    pub duplicate_policy: &'static str,
    pub queue_handoff: PlaylistQueueHandoffContract,
    pub planned_commands: Vec<PlaylistCommandContract>,
    pub guarantees: Vec<&'static str>,
}

#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistQueueHandoffContract {
    pub mode: &'static str,
    pub request_shape: &'static str,
    pub response_shape: &'static str,
    pub active_entry_rule: &'static str,
    pub queue_order_rule: &'static str,
}

#[derive(Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistCommandContract {
    pub name: &'static str,
    pub summary: &'static str,
    pub request_shape: &'static str,
    pub response_shape: &'static str,
}

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
            queue_order_rule: "queue track order matches playlist entry order exactly at handoff time and stays stable even if the visible library view is filtered or resorted later",
        },
        planned_commands: vec![
            PlaylistCommandContract {
                name: "create_playlist",
                summary: "Create a local playlist shell with a user-visible name before entries are added.",
                request_shape: "{ name, description? }",
                response_shape: "PlaylistSummary",
            },
            PlaylistCommandContract {
                name: "rename_playlist",
                summary: "Update playlist metadata without affecting entry order or queue state.",
                request_shape: "{ playlistId, name, description? }",
                response_shape: "PlaylistSummary",
            },
            PlaylistCommandContract {
                name: "replace_playlist_entries",
                summary: "Commit an explicit ordered list of playlist entries after add, remove, or reorder operations.",
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
            "queue handoff copies playlist order into the backend playback queue at one moment in time instead of creating a live coupled view",
            "playlist deletion cascades to playlist entries while track deletion removes dependent local-playlist entries for the current local-first milestone",
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::{
        playlist_contract, PLAYLIST_DUPLICATE_POLICY, PLAYLIST_ORDERING_MODE,
        PLAYLIST_QUEUE_HANDOFF_MODE,
    };

    #[test]
    fn playlist_contract_exposes_ordering_and_queue_handoff_rules() {
        let contract = playlist_contract();

        assert_eq!(contract.ordering_mode, PLAYLIST_ORDERING_MODE);
        assert_eq!(contract.duplicate_policy, PLAYLIST_DUPLICATE_POLICY);
        assert_eq!(contract.queue_handoff.mode, PLAYLIST_QUEUE_HANDOFF_MODE);
        assert_eq!(contract.planned_commands.len(), 4);
        assert_eq!(contract.planned_commands[0].name, "create_playlist");
        assert_eq!(
            contract.planned_commands[3].name,
            "handoff_playlist_to_queue"
        );
    }
}
