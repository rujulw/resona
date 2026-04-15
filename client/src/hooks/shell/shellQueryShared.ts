import type { PlaylistDetail } from "../../desktop";
import type { PlaylistsState, TracksQueryState } from "../../types/app";

export function toAsyncErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function getNextTracksTitleHeaderSort(tracksQueryState: TracksQueryState) {
  return tracksQueryState.sortKey === "title" && tracksQueryState.sortDirection === "asc"
    ? { sortKey: "title" as const, sortDirection: "desc" as const }
    : tracksQueryState.sortKey === "title" && tracksQueryState.sortDirection === "desc"
      ? { sortKey: "artist" as const, sortDirection: "asc" as const }
      : tracksQueryState.sortKey === "artist" && tracksQueryState.sortDirection === "asc"
        ? { sortKey: "artist" as const, sortDirection: "desc" as const }
        : { sortKey: "title" as const, sortDirection: "asc" as const };
}

export function getNextTracksAlbumHeaderSort(tracksQueryState: TracksQueryState) {
  return tracksQueryState.sortKey === "album" && tracksQueryState.sortDirection === "asc"
    ? { sortKey: "album" as const, sortDirection: "desc" as const }
    : tracksQueryState.sortKey === "album" && tracksQueryState.sortDirection === "desc"
      ? { sortKey: "title" as const, sortDirection: "asc" as const }
      : { sortKey: "album" as const, sortDirection: "asc" as const };
}

export function withActivePlaylistDetail(
  existing: PlaylistsState,
  detail: PlaylistDetail,
): PlaylistsState {
  return {
    status: "ready",
    items: existing.items.map((item) =>
      item.id === detail.playlist.id ? detail.playlist : item,
    ),
    activePlaylistId: detail.playlist.id,
    activePlaylist: detail,
    playbackQueue: existing.playbackQueue,
  };
}