import {
  invokeDesktop,
  invokeWithPreviewFallback,
  normalizeConceptAlbumMutationPayload,
} from "./runtime";
import type {
  ConceptAlbumDetail,
  ConceptAlbumEntryInput,
  ConceptAlbumSummary,
  TrackListItem,
} from "./types";
import {
  addPreviewTrackToConceptAlbum,
  createPreviewConceptAlbum,
  deletePreviewConceptAlbum,
  getPreviewConceptAlbum,
  getPreviewConceptAlbums,
  movePreviewConceptAlbumEntry,
  removePreviewConceptAlbumEntry,
  replacePreviewConceptAlbumEntries,
  updatePreviewConceptAlbum,
} from "./previewRuntime";

export async function listConceptAlbums(): Promise<ConceptAlbumSummary[]> {
  return invokeWithPreviewFallback("list_concept_albums", undefined, () =>
    getPreviewConceptAlbums(),
  );
}

export async function getConceptAlbum(
  conceptAlbumId: string,
): Promise<ConceptAlbumDetail | null> {
  return invokeWithPreviewFallback("get_concept_album", { conceptAlbumId }, () =>
    getPreviewConceptAlbum(conceptAlbumId),
  );
}

export async function createConceptAlbum(
  title: string,
  artist?: string | null,
  description?: string | null,
  artworkPath?: string | null,
): Promise<ConceptAlbumSummary> {
  const payload = normalizeConceptAlbumMutationPayload(
    title,
    artist,
    description,
    artworkPath,
  );

  return invokeWithPreviewFallback("create_concept_album", payload, () =>
    createPreviewConceptAlbum(
      payload.title,
      payload.artist,
      payload.description,
      payload.artworkPath,
    ),
  );
}

export async function updateConceptAlbum(
  conceptAlbumId: string,
  title: string,
  artist?: string | null,
  description?: string | null,
  artworkPath?: string | null,
): Promise<ConceptAlbumSummary> {
  const payload = {
    conceptAlbumId,
    ...normalizeConceptAlbumMutationPayload(title, artist, description, artworkPath),
  };

  return invokeWithPreviewFallback("update_concept_album", payload, () =>
    updatePreviewConceptAlbum(
      conceptAlbumId,
      payload.title,
      payload.artist,
      payload.description,
      payload.artworkPath,
    ),
  );
}

export async function deleteConceptAlbum(conceptAlbumId: string): Promise<void> {
  return invokeWithPreviewFallback("delete_concept_album", { conceptAlbumId }, () => {
    deletePreviewConceptAlbum(conceptAlbumId);
  });
}

export async function addTrackToConceptAlbum(
  conceptAlbumId: string,
  track: TrackListItem,
): Promise<ConceptAlbumDetail> {
  return invokeWithPreviewFallback(
    "add_track_to_concept_album",
    {
      conceptAlbumId,
      trackId: track.id,
    },
    () => addPreviewTrackToConceptAlbum(conceptAlbumId, track),
  );
}

export async function moveConceptAlbumEntry(
  conceptAlbumId: string,
  entryId: string,
  targetPosition: number,
): Promise<ConceptAlbumDetail> {
  return invokeWithPreviewFallback(
    "move_concept_album_entry",
    {
      conceptAlbumId,
      entryId,
      targetPosition,
    },
    () => movePreviewConceptAlbumEntry(conceptAlbumId, entryId, targetPosition),
  );
}

export async function replaceConceptAlbumEntries(
  conceptAlbumId: string,
  entries: ConceptAlbumEntryInput[],
): Promise<ConceptAlbumDetail> {
  return invokeWithPreviewFallback(
    "replace_concept_album_entries",
    {
      conceptAlbumId,
      entries,
    },
    () => replacePreviewConceptAlbumEntries(conceptAlbumId, entries),
  );
}

export async function setConceptAlbumSidebarHidden(
  conceptAlbumId: string,
  hidden: boolean,
): Promise<void> {
  return invokeDesktop("set_concept_album_sidebar_hidden", { conceptAlbumId, hidden });
}

export async function removeConceptAlbumEntry(
  conceptAlbumId: string,
  entryId: string,
): Promise<ConceptAlbumDetail> {
  return invokeWithPreviewFallback(
    "remove_concept_album_entry",
    {
      conceptAlbumId,
      entryId,
    },
    () => removePreviewConceptAlbumEntry(conceptAlbumId, entryId),
  );
}
