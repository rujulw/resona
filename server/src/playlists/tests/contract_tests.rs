use crate::playlists::playlist_contract;

#[test]
fn playlist_contract_exposes_ordering_and_queue_handoff_rules() {
    let contract = playlist_contract();

    assert_eq!(contract.ordering_mode, "dense-zero-based-position");
    assert_eq!(contract.duplicate_policy, "allowed-as-distinct-entries");
    assert_eq!(
        contract.queue_handoff.mode,
        "replace-backend-queue-from-playlist-order"
    );
    assert_eq!(contract.planned_commands.len(), 4);
    assert_eq!(contract.planned_commands[0].name, "create_playlist");
    assert!(contract
        .queue_handoff
        .queue_order_rule
        .contains("drag targets"));
    assert!(contract.planned_commands[2]
        .summary
        .contains("full-order replacement"));
    assert!(
        contract.guarantees[3].contains("before-or-after placement"),
        "playlist contract should describe explicit drop-target resolution"
    );
    assert!(
        contract.guarantees[4].contains("explicit replacement payload"),
        "playlist contract should describe reorder persistence only on explicit replacement"
    );
    assert_eq!(
        contract.planned_commands[3].name,
        "handoff_playlist_to_queue"
    );
}
