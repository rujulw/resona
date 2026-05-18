import type { ConceptAlbumDetail, PlaylistDetail } from "../../desktop";
import type {
  ConceptAlbumsState,
  PlaylistsState,
  TracksQueryState,
} from "../../types/app";

export function toAsyncErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = "message" in error ? (error as { message?: unknown }).message : null;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      // Fall through to the fallback when the thrown object is not serializable.
    }
  }

  return fallback;
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

export function withActiveConceptAlbumDetail(
  existing: ConceptAlbumsState,
  detail: ConceptAlbumDetail,
): ConceptAlbumsState {
  return {
    status: "ready",
    items: existing.items.map((item) =>
      item.id === detail.conceptAlbum.id ? detail.conceptAlbum : item,
    ),
    activeConceptAlbumId: detail.conceptAlbum.id,
    activeConceptAlbum: detail,
  };
}
