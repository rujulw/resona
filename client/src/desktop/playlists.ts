import {
  invokeWithPreviewFallback,
  normalizeOptionalText,
  normalizePlaylistMutationPayload,
} from "./runtime";
import type {
  PlaylistDetail,
  PlaylistEntryInput,
  PlaylistPlaybackHandoffPayload,
  PlaylistSummary,
  TrackListItem,
} from "./types";
import {
  createPreviewPlaylist,
  addPreviewTrackToPlaylist,
  movePreviewPlaylistEntry,
  replacePreviewPlaylistEntries,
  removePreviewPlaylistEntry,
  handoffPreviewPlaylistToQueue,
  getPreviewPlaylist,
  getPreviewPlaylists,
  updatePreviewPlaylist,
  deletePreviewPlaylist,
  turnPreviewPlaylistToMixtape,
} from "./previewRuntime";

export async function listPlaylists(): Promise<PlaylistSummary[]> {
  return invokeWithPreviewFallback("list_playlists", undefined, () =>
    getPreviewPlaylists(),
  );
}

export async function getPlaylist(playlistId: string): Promise<PlaylistDetail | null> {
  return invokeWithPreviewFallback("get_playlist", { playlistId }, () =>
    getPreviewPlaylist(playlistId),
  );
}

export async function createPlaylist(
  name: string,
  description?: string | null,
  artworkPath?: string | null,
): Promise<PlaylistSummary> {
  const payload = normalizePlaylistMutationPayload(name, description, artworkPath);

  return invokeWithPreviewFallback(
    "create_playlist",
    payload,
    () => createPreviewPlaylist(payload.name, payload.description, payload.artworkPath),
  );
}

export async function updatePlaylist(
  playlistId: string,
  name: string,
  description?: string | null,
  artworkPath?: string | null,
): Promise<PlaylistSummary> {
  const payload = {
    playlistId,
    ...normalizePlaylistMutationPayload(name, description, artworkPath),
  };

  return invokeWithPreviewFallback(
    "update_playlist",
    payload,
    () =>
      updatePreviewPlaylist(
        playlistId,
        payload.name,
        payload.description,
        payload.artworkPath,
      ),
  );
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  return invokeWithPreviewFallback("delete_playlist", { playlistId }, () => {
    deletePreviewPlaylist(playlistId);
  });
}

export async function turnPlaylistToMixtape(
  playlistId: string,
): Promise<PlaylistSummary> {
  return invokeWithPreviewFallback(
    "turn_playlist_to_mixtape",
    { playlistId },
    () => turnPreviewPlaylistToMixtape(playlistId),
  );
}

export async function addTrackToPlaylist(
  playlistId: string,
  track: TrackListItem,
): Promise<PlaylistDetail> {
  return invokeWithPreviewFallback(
    "add_track_to_playlist",
    {
      playlistId,
      trackId: track.id,
    },
    () => addPreviewTrackToPlaylist(playlistId, track),
  );
}

export async function movePlaylistEntry(
  playlistId: string,
  entryId: string,
  targetPosition: number,
): Promise<PlaylistDetail> {
  return invokeWithPreviewFallback(
    "move_playlist_entry",
    {
      playlistId,
      entryId,
      targetPosition,
    },
    () => movePreviewPlaylistEntry(playlistId, entryId, targetPosition),
  );
}

export async function replacePlaylistEntries(
  playlistId: string,
  entries: PlaylistEntryInput[],
): Promise<PlaylistDetail> {
  return invokeWithPreviewFallback(
    "replace_playlist_entries",
    {
      playlistId,
      entries,
    },
    () => replacePreviewPlaylistEntries(playlistId, entries),
  );
}

export async function removePlaylistEntry(
  playlistId: string,
  entryId: string,
): Promise<PlaylistDetail> {
  return invokeWithPreviewFallback(
    "remove_playlist_entry",
    {
      playlistId,
      entryId,
    },
    () => removePreviewPlaylistEntry(playlistId, entryId),
  );
}

export async function handoffPlaylistToQueue(
  playlistId: string,
  startEntryId?: string | null,
): Promise<PlaylistPlaybackHandoffPayload> {
  return invokeWithPreviewFallback(
    "handoff_playlist_to_queue",
    {
      playlistId,
      startEntryId: startEntryId ?? null,
    },
    () => handoffPreviewPlaylistToQueue(playlistId, startEntryId),
  );
}
