use crate::concept_albums::concept_album_contract;

#[test]
fn concept_album_contract_defines_editable_release_boundaries() {
    let contract = concept_album_contract();

    assert_eq!(contract.ordering_mode, "dense-zero-based-position");
    assert_eq!(
        contract.duplicate_policy,
        "allowed-as-distinct-sequenced-entries"
    );
    assert!(contract
        .editable_release_boundary
        .contains("app-authored release objects"));
    assert!(contract.album_reuse_rule.contains("library albums"));
    assert!(contract.playlist_reuse_rule.contains("playlist ordering"));
    assert_eq!(contract.planned_commands.len(), 4);
    assert_eq!(
        contract.planned_commands[3].name,
        "replace_concept_album_entries"
    );
}
