import { queryLibrary, type TrackListItem } from "../desktop";
import type { ImportSummary, PlaylistsState, QueueState } from "../types/app";

export async function fetchAllTracks(options: {
  search: string | null;
  sortKey: "title" | "artist" | "album" | "indexed_at";
  sortDirection: "asc" | "desc";
}) {
  const items: TrackListItem[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let total = 0;

  while (true) {
    const page = await queryLibrary({
      pageSize: 200,
      cursor,
      search: options.search,
      sortKey: options.sortKey,
      sortDirection: options.sortDirection,
    });

    items.push(...page.items);
    total = page.total;

    if (!page.nextCursor || seenCursors.has(page.nextCursor)) {
      return {
        items,
        total,
      };
    }

    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}

export function toImportSummary(summary: {
  libraryRootId: string;
  libraryRootName: string;
  rootPath: string;
  discoveredTracks: number;
  insertedTracks: number;
  updatedTracks: number;
  removedTracks: number;
}): ImportSummary {
  return {
    libraryRootId: summary.libraryRootId,
    libraryRootName: summary.libraryRootName,
    rootPath: summary.rootPath,
    discoveredTracks: summary.discoveredTracks,
    insertedTracks: summary.insertedTracks,
    updatedTracks: summary.updatedTracks,
    removedTracks: summary.removedTracks,
  };
}

export function existingSelectedTrackId(
  items: TrackListItem[],
  currentSelectedTrackId: string | null,
): string | null {
  if (!currentSelectedTrackId) {
    return null;
  }

  return items.some((item) => item.id === currentSelectedTrackId)
    ? currentSelectedTrackId
    : null;
}

export function deriveQueueState(
  trackCatalog: Map<string, TrackListItem>,
  queueTrackIds: string[],
  activeTrackId: string | null | undefined,
  sourceLabel?: string,
): QueueState {
  if (!activeTrackId) {
    return {
      activeTrack: null,
      upcomingTracks: [],
      totalTracks: 0,
      sourceLabel,
    };
  }

  const queueItems = queueTrackIds
    .map((trackId) => trackCatalog.get(trackId))
    .filter((track): track is TrackListItem => Boolean(track));
  const activeIndex = queueItems.findIndex((item) => item.id === activeTrackId);
  if (activeIndex < 0) {
    return {
      activeTrack: trackCatalog.get(activeTrackId) ?? null,
      upcomingTracks: [],
      totalTracks: trackCatalog.has(activeTrackId) ? 1 : 0,
      sourceLabel,
    };
  }

  return {
    activeTrack: queueItems[activeIndex],
    upcomingTracks: queueItems.slice(activeIndex + 1),
    totalTracks: queueItems.length - activeIndex,
    sourceLabel,
  };
}

export function existingQueueSnapshot(playlistsState: PlaylistsState) {
  return playlistsState.playbackQueue ?? null;
}

export function mergeTrackCatalog(
  trackCatalog: Map<string, TrackListItem>,
  items: TrackListItem[],
) {
  for (const item of items) {
    trackCatalog.set(item.id, item);
  }
}
