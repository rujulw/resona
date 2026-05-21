use super::types::{ConceptAlbumCommandContract, ConceptAlbumContract};

const CONCEPT_ALBUM_ORDERING_MODE: &str = "dense-zero-based-position";
const CONCEPT_ALBUM_DUPLICATE_POLICY: &str = "allowed-as-distinct-sequenced-entries";

pub fn concept_album_contract() -> ConceptAlbumContract {
    ConceptAlbumContract {
        storage_boundary: "sqlite persists concept album identity separately from ordered concept album entries so editable release metadata and sequence updates can evolve without mutating library album records",
        editable_release_boundary: "concept albums are app-authored release objects whose title artist description artwork and ordered entries are editable even when borrowed tracks originated from locked local-library album metadata",
        album_reuse_rule: "library albums may be used as discovery and inspiration sources but editing a concept album never rewrites track tags or derived album groupings in the scanned library",
        playlist_reuse_rule: "playlist ordering and concept album ordering may borrow the same tracks yet remain separate saved objects so changing one sequence never mutates the other",
        ordering_mode: CONCEPT_ALBUM_ORDERING_MODE,
        duplicate_policy: CONCEPT_ALBUM_DUPLICATE_POLICY,
        planned_commands: vec![
            ConceptAlbumCommandContract {
                name: "create_concept_album",
                summary: "Create an editable release shell with album-style identity before sequencing tracks.",
                request_shape: "{ title, artist?, description?, artworkPath? }",
                response_shape: "ConceptAlbumSummary",
            },
            ConceptAlbumCommandContract {
                name: "update_concept_album",
                summary: "Update concept album metadata without changing the saved ordered entries.",
                request_shape: "{ conceptAlbumId, title, artist?, description?, artworkPath? }",
                response_shape: "ConceptAlbumSummary",
            },
            ConceptAlbumCommandContract {
                name: "get_concept_album",
                summary: "Hydrate one concept album with its saved ordered entries and track details.",
                request_shape: "{ conceptAlbumId }",
                response_shape: "ConceptAlbumDetail",
            },
            ConceptAlbumCommandContract {
                name: "replace_concept_album_entries",
                summary: "Commit one explicit full-order replacement for concept album sequencing after add remove or reorder operations.",
                request_shape: "{ conceptAlbumId, entries: [{ entryId?, trackId, position }] }",
                response_shape: "ConceptAlbumDetail",
            },
        ],
        guarantees: vec![
            "concept album identity stays app-authored and separate from scanned library album grouping",
            "concept album ordering is determined only by ascending entry position and never by source album track numbers or insertion timestamps",
            "positions are dense and zero-based after each committed reorder so sequence edits remain deterministic",
            "the same track may appear more than once in a concept album when the authored sequence intentionally repeats or reprises it",
            "detail hydration joins saved concept album entries to current track metadata at read time so playback-facing track labels stay current without erasing concept album ordering",
            "deleting a concept album cascades to its entries while track deletion removes dependent concept album entries for the current local-first milestone",
        ],
    }
}
