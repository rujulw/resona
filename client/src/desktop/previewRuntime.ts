import type {
  BootstrapPayload,
  ConceptAlbumDetail,
  ConceptAlbumEntryInput,
  ConceptAlbumSummary,
  ShellStatePayload,
  PlaybackShellState,
  PlaylistDetail,
  PlaylistSummary,
  TrackListItem,
  PlaylistEntryInput,
  PlaybackQueueSnapshot,
  PlaylistPlaybackHandoffPayload,
} from "./types";

export function isPreviewRuntime(): boolean {
  if (typeof globalThis === "undefined") return true;
  return !("__TAURI_INTERNALS__" in globalThis) && !("__TAURI__" in globalThis);
}

export const previewBootstrapPayload: BootstrapPayload = {
  appName: "resona",
  appVersion: "2.1.0",
  windowTitle: "resona",
  platform: "browser",
  runtime: {
    desktopShell: "browser-preview",
    frontend: "react-vite",
    core: "rust",
  },
};

export const previewShellState: ShellStatePayload = {
  navSections: [
    { id: "tracks", label: "Tracks" },
    { id: "queue", label: "Queue" },
    { id: "insights", label: "Insights" },
    { id: "settings", label: "Settings" },
  ],
  libraryRows: [
    { title: "Library", detail: "No tracks loaded yet", state: "Idle" },
    { title: "atlas", detail: "Remote source not connected", state: "Idle" },
    { title: "timbre", detail: "Analysis queue unavailable", state: "Idle" },
  ],
  playback: {
    statusLabel: "Nothing playing",
    transportLabel: "Idle",
    outputOwner: "frontend",
    progressSeconds: 0,
    durationSeconds: 0,
    isPlaying: false,
    trackId: null,
  },
};

export function getPreviewPlaybackBase(): PlaybackShellState {
  return previewShellState.playback;
}

export function getPreviewPlaybackToggle(): PlaybackShellState {
  return {
    ...previewShellState.playback,
    transportLabel: "Preview only",
    outputOwner: "frontend",
  };
}

export function getPreviewPlaybackEnded(): PlaybackShellState {
  return {
    ...previewShellState.playback,
    statusLabel: "Ended",
    transportLabel: "Ended",
    outputOwner: "frontend",
  };
}

export function getPreviewPlaybackError(
  transportLabel?: string | null,
): PlaybackShellState {
  return {
    ...previewShellState.playback,
    statusLabel: "Error",
    transportLabel: transportLabel ?? "Playback error",
    outputOwner: "frontend",
  };
}

let playlistCounter = 0;
let playlistEntryCounter = 0;
let conceptAlbumCounter = 0;
let conceptAlbumEntryCounter = 0;

const playlists = new Map<string, PlaylistDetail>();
const conceptAlbums = new Map<string, ConceptAlbumDetail>();

export function resetPreviewRuntimeState(): void {
  playlistCounter = 0;
  playlistEntryCounter = 0;
  conceptAlbumCounter = 0;
  conceptAlbumEntryCounter = 0;
  playlists.clear();
  conceptAlbums.clear();
}

export function getPreviewPlaylists(): PlaylistSummary[] {
  return Array.from(playlists.values())
    .map((detail) => detail.playlist)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getPreviewPlaylist(playlistId: string): PlaylistDetail | null {
  return playlists.get(playlistId) ?? null;
}

export function getPreviewConceptAlbums(): ConceptAlbumSummary[] {
  return Array.from(conceptAlbums.values())
    .map((detail) => detail.conceptAlbum)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getPreviewConceptAlbum(
  conceptAlbumId: string,
): ConceptAlbumDetail | null {
  return conceptAlbums.get(conceptAlbumId) ?? null;
}

export function createPreviewConceptAlbum(
  title: string,
  artist: string | null,
  description: string | null,
  artworkPath: string | null,
): ConceptAlbumSummary {
  conceptAlbumCounter += 1;
  const now = `${Date.now()}`;

  const conceptAlbum: ConceptAlbumSummary = {
    id: `browser-concept-album-${conceptAlbumCounter}`,
    title: title.trim(),
    artist,
    description,
    artworkKey: artworkPath
      ? `browser-concept-album-artwork-${conceptAlbumCounter}`
      : null,
    artworkPath,
    entryCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  conceptAlbums.set(conceptAlbum.id, {
    conceptAlbum,
    entries: [],
  });

  return conceptAlbum;
}

export function updatePreviewConceptAlbum(
  conceptAlbumId: string,
  title: string,
  artist: string | null,
  description: string | null,
  artworkPath: string | null,
): ConceptAlbumSummary {
  const existing = conceptAlbums.get(conceptAlbumId);
  if (!existing) {
    throw new Error(`concept album ${conceptAlbumId} was not found`);
  }

  const updatedSummary: ConceptAlbumSummary = {
    ...existing.conceptAlbum,
    title: title.trim(),
    artist,
    description,
    artworkKey: artworkPath
      ? `browser-concept-album-artwork-${conceptAlbumId}`
      : existing.conceptAlbum.artworkKey,
    artworkPath,
    updatedAt: `${Date.now()}`,
  };

  conceptAlbums.set(conceptAlbumId, {
    ...existing,
    conceptAlbum: updatedSummary,
  });

  return updatedSummary;
}

export function deletePreviewConceptAlbum(conceptAlbumId: string): void {
  conceptAlbums.delete(conceptAlbumId);
}

export function addPreviewTrackToConceptAlbum(
  conceptAlbumId: string,
  track: TrackListItem,
): ConceptAlbumDetail {
  const existing = conceptAlbums.get(conceptAlbumId);
  if (!existing) {
    throw new Error(`concept album ${conceptAlbumId} was not found`);
  }

  conceptAlbumEntryCounter += 1;
  const now = `${Date.now()}`;

  const nextEntry = {
    entryId: `browser-concept-album-entry-${conceptAlbumEntryCounter}`,
    conceptAlbumId,
    trackId: track.id,
    position: existing.entries.length,
    addedAt: now,
    updatedAt: now,
    title: track.title,
    artist: track.artist,
    album: track.album,
    advisory: track.advisory ?? null,
    artworkKey: track.artworkKey,
    extension: track.extension,
    durationSeconds: track.durationSeconds,
    trackNumber: null,
    discNumber: null,
  };

  const detail: ConceptAlbumDetail = {
    conceptAlbum: {
      ...existing.conceptAlbum,
      entryCount: existing.entries.length + 1,
      updatedAt: now,
    },
    entries: [...existing.entries, nextEntry],
  };

  conceptAlbums.set(conceptAlbumId, detail);
  return detail;
}

export function removePreviewConceptAlbumEntry(
  conceptAlbumId: string,
  entryId: string,
): ConceptAlbumDetail {
  const existing = conceptAlbums.get(conceptAlbumId);
  if (!existing) {
    throw new Error(`concept album ${conceptAlbumId} was not found`);
  }

  const nextEntries = existing.entries.filter(
    (entry) => entry.entryId !== entryId,
  );
  if (nextEntries.length === existing.entries.length) {
    throw new Error(`concept album entry ${entryId} was not found`);
  }

  const detail: ConceptAlbumDetail = {
    conceptAlbum: {
      ...existing.conceptAlbum,
      entryCount: nextEntries.length,
      updatedAt: `${Date.now()}`,
    },
    entries: nextEntries.map((entry, index) => ({
      ...entry,
      position: index,
    })),
  };

  conceptAlbums.set(conceptAlbumId, detail);
  return detail;
}

export function movePreviewConceptAlbumEntry(
  conceptAlbumId: string,
  entryId: string,
  targetPosition: number,
): ConceptAlbumDetail {
  const existing = conceptAlbums.get(conceptAlbumId);
  if (!existing) {
    throw new Error(`concept album ${conceptAlbumId} was not found`);
  }

  const nextEntries = [...existing.entries];
  const currentIndex = nextEntries.findIndex(
    (entry) => entry.entryId === entryId,
  );
  if (currentIndex < 0) {
    throw new Error(`concept album entry ${entryId} was not found`);
  }

  const [movedEntry] = nextEntries.splice(currentIndex, 1);
  const boundedTarget = Math.max(
    0,
    Math.min(targetPosition, nextEntries.length),
  );
  nextEntries.splice(boundedTarget, 0, movedEntry);

  const detail: ConceptAlbumDetail = {
    conceptAlbum: {
      ...existing.conceptAlbum,
      updatedAt: `${Date.now()}`,
    },
    entries: nextEntries.map((entry, index) => ({
      ...entry,
      position: index,
    })),
  };

  conceptAlbums.set(conceptAlbumId, detail);
  return detail;
}

export function replacePreviewConceptAlbumEntries(
  conceptAlbumId: string,
  entries: ConceptAlbumEntryInput[],
): ConceptAlbumDetail {
  const existing = conceptAlbums.get(conceptAlbumId);
  if (!existing) {
    throw new Error(`concept album ${conceptAlbumId} was not found`);
  }

  const trackByEntryId = new Map(
    existing.entries.map((entry) => [entry.entryId, entry]),
  );
  const now = `${Date.now()}`;

  const nextEntries = entries.map((entry, index) => {
    const existingEntry =
      entry.entryId != null ? trackByEntryId.get(entry.entryId) : undefined;

    if (existingEntry) {
      return {
        ...existingEntry,
        position: index,
        updatedAt: now,
      };
    }

    conceptAlbumEntryCounter += 1;
    return {
      entryId: `browser-concept-album-entry-${conceptAlbumEntryCounter}`,
      conceptAlbumId,
      trackId: entry.trackId,
      position: index,
      addedAt: now,
      updatedAt: now,
      title: entry.trackId,
      artist: null,
      album: null,
      advisory: null,
      artworkKey: null,
      extension: "mp3",
      durationSeconds: null,
      trackNumber: null,
      discNumber: null,
    };
  });

  const detail: ConceptAlbumDetail = {
    conceptAlbum: {
      ...existing.conceptAlbum,
      entryCount: nextEntries.length,
      updatedAt: now,
    },
    entries: nextEntries,
  };

  conceptAlbums.set(conceptAlbumId, detail);
  return detail;
}

export function createPreviewPlaylist(
  name: string,
  description: string | null,
  artworkPath: string | null,
): PlaylistSummary {
  playlistCounter += 1;
  const now = `${Date.now()}`;

  const playlist: PlaylistSummary = {
    id: `browser-playlist-${playlistCounter}`,
    name: name.trim(),
    description,
    artworkKey: artworkPath
      ? `browser-playlist-artwork-${playlistCounter}`
      : null,
    artworkPath,
    entryCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  playlists.set(playlist.id, {
    playlist,
    entries: [],
  });

  return playlist;
}

export function addPreviewTrackToPlaylist(
  playlistId: string,
  track: TrackListItem,
): PlaylistDetail {
  const existing = playlists.get(playlistId);
  if (!existing) {
    throw new Error(`playlist ${playlistId} was not found`);
  }

  playlistEntryCounter += 1;
  const now = `${Date.now()}`;

  const nextEntry = {
    entryId: `browser-playlist-entry-${playlistEntryCounter}`,
    playlistId,
    trackId: track.id,
    position: existing.entries.length,
    addedAt: now,
    updatedAt: now,
    title: track.title,
    artist: track.artist,
    album: track.album,
    advisory: track.advisory ?? null,
    artworkKey: track.artworkKey,
    extension: track.extension,
    durationSeconds: track.durationSeconds,
  };

  const detail: PlaylistDetail = {
    playlist: {
      ...existing.playlist,
      entryCount: existing.entries.length + 1,
      updatedAt: now,
    },
    entries: [...existing.entries, nextEntry],
  };

  playlists.set(playlistId, detail);
  return detail;
}

export function removePreviewPlaylistEntry(
  playlistId: string,
  entryId: string,
): PlaylistDetail {
  const existing = playlists.get(playlistId);
  if (!existing) {
    throw new Error(`playlist ${playlistId} was not found`);
  }

  const nextEntries = existing.entries.filter(
    (entry) => entry.entryId !== entryId,
  );
  if (nextEntries.length === existing.entries.length) {
    throw new Error(`playlist entry ${entryId} was not found`);
  }

  const detail: PlaylistDetail = {
    playlist: {
      ...existing.playlist,
      entryCount: nextEntries.length,
      updatedAt: `${Date.now()}`,
    },
    entries: nextEntries.map((entry, index) => ({
      ...entry,
      position: index,
    })),
  };

  playlists.set(playlistId, detail);
  return detail;
}

export function movePreviewPlaylistEntry(
  playlistId: string,
  entryId: string,
  targetPosition: number,
): PlaylistDetail {
  const existing = playlists.get(playlistId);
  if (!existing) {
    throw new Error(`playlist ${playlistId} was not found`);
  }

  const nextEntries = [...existing.entries];
  const currentIndex = nextEntries.findIndex(
    (entry) => entry.entryId === entryId,
  );
  if (currentIndex < 0) {
    throw new Error(`playlist entry ${entryId} was not found`);
  }

  const [movedEntry] = nextEntries.splice(currentIndex, 1);
  const boundedTarget = Math.max(
    0,
    Math.min(targetPosition, nextEntries.length),
  );
  nextEntries.splice(boundedTarget, 0, movedEntry);

  const detail: PlaylistDetail = {
    playlist: {
      ...existing.playlist,
      updatedAt: `${Date.now()}`,
    },
    entries: nextEntries.map((entry, index) => ({
      ...entry,
      position: index,
    })),
  };

  playlists.set(playlistId, detail);
  return detail;
}

export function replacePreviewPlaylistEntries(
  playlistId: string,
  entries: PlaylistEntryInput[],
): PlaylistDetail {
  const existing = playlists.get(playlistId);
  if (!existing) {
    throw new Error(`playlist ${playlistId} was not found`);
  }

  const trackByEntryId = new Map(
    existing.entries.map((entry) => [entry.entryId, entry]),
  );
  const now = `${Date.now()}`;

  const nextEntries = entries.map((entry, index) => {
    const existingEntry =
      entry.entryId != null ? trackByEntryId.get(entry.entryId) : undefined;

    if (existingEntry) {
      return {
        ...existingEntry,
        position: index,
        updatedAt: now,
      };
    }

    playlistEntryCounter += 1;
    return {
      entryId: `browser-playlist-entry-${playlistEntryCounter}`,
      playlistId,
      trackId: entry.trackId,
      position: index,
      addedAt: now,
      updatedAt: now,
      title: entry.trackId,
      artist: null,
      album: null,
      advisory: null,
      artworkKey: null,
      extension: "mp3",
      durationSeconds: null,
    };
  });

  const detail: PlaylistDetail = {
    playlist: {
      ...existing.playlist,
      entryCount: nextEntries.length,
      updatedAt: now,
    },
    entries: nextEntries,
  };

  playlists.set(playlistId, detail);
  return detail;
}

export function handoffPreviewPlaylistToQueue(
  playlistId: string,
  startEntryId?: string | null,
): PlaylistPlaybackHandoffPayload {
  const detail = playlists.get(playlistId);
  if (!detail || detail.entries.length === 0) {
    throw new Error(`playlist ${playlistId} was not found`);
  }

  const activeEntry =
    detail.entries.find((entry) => entry.entryId === (startEntryId ?? "")) ??
    detail.entries[0];

  return {
    playback: {
      ...previewShellState.playback,
      statusLabel: "Ready",
      transportLabel: "Ready",
      outputOwner: "frontend",
      trackId: activeEntry.trackId,
      trackTitle: activeEntry.title,
      trackArtist: activeEntry.artist,
      trackAlbum: activeEntry.album,
      trackAdvisory: activeEntry.advisory ?? null,
      durationSeconds: activeEntry.durationSeconds
        ? Math.round(activeEntry.durationSeconds)
        : 0,
    },
    queue: {
      trackIds: detail.entries.map((entry) => entry.trackId),
      activeTrackId: activeEntry.trackId,
      sourceLabel: "playlist-handoff",
    },
    playlistId,
    activeEntryId: activeEntry.entryId,
  };
}

export function getPreviewLibraryPage() {
  return {
    items: [],
    nextCursor: null,
    total: 0,
    pageSize: 100,
  };
}

export function getNoopUnlisten(): () => void {
  return () => {};
}

export function updatePreviewPlaylist(
  playlistId: string,
  name: string,
  description: string | null,
  artworkPath: string | null,
): PlaylistSummary {
  const existing = playlists.get(playlistId);
  if (!existing) {
    throw new Error(`playlist ${playlistId} was not found`);
  }

  const updatedSummary: PlaylistSummary = {
    ...existing.playlist,
    name: name.trim(),
    description,
    artworkKey: artworkPath
      ? `browser-playlist-artwork-${playlistId}`
      : existing.playlist.artworkKey,
    artworkPath,
    updatedAt: `${Date.now()}`,
  };

  playlists.set(playlistId, {
    ...existing,
    playlist: updatedSummary,
  });

  return updatedSummary;
}

export function deletePreviewPlaylist(playlistId: string): void {
  playlists.delete(playlistId);
}

export function getPreviewBootstrapPayload(): BootstrapPayload {
  return previewBootstrapPayload;
}

export function getPreviewShellState(): ShellStatePayload {
  return {
    ...previewShellState,
    playback: { ...previewShellState.playback },
  };
}

import type { PlaybackContractPayload } from "./types";

export const previewPlaybackContract: PlaybackContractPayload = {
  currentOwner: "frontend-audio-element during v1 baseline",
  migrationTarget:
    "rust playback runtime owns transport queue progress and source state",
  runtimeBoundary:
    "tauri commands mutate playback runtime and tauri events broadcast playback snapshots",
  sourceResolutionOrder: ["local", "cache", "remote"],
  commands: [
    {
      name: "load_playback_track",
      summary:
        "Resolve a track and replace the active playback item without forcing autoplay.",
      requestShape: "{ trackId, queueTrackIds?, startPositionSeconds? }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "playback_action",
      summary:
        "Apply a transport action such as play pause previous next stop or toggle.",
      requestShape: "{ action }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "seek_playback",
      summary:
        "Move the active playback position to an explicit second offset.",
      requestShape: "{ positionSeconds }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "sync_playback_timing",
      summary:
        "Report renderer-observed playback timing back into the backend snapshot.",
      requestShape: "{ progressSeconds?, durationSeconds? }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "complete_playback",
      summary:
        "Mark the active playback item as ended when the renderer reaches the end.",
      requestShape: "{}",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "report_playback_error",
      summary:
        "Record a renderer playback failure without letting the shell invent its own error state.",
      requestShape: "{ transportLabel? }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
  ],
  events: [
    {
      name: "playback://state-changed",
      summary:
        "Broadcasts the latest backend playback snapshot after transport or source changes.",
      payloadShape: "PlaybackSnapshot",
      delivery:
        "emit to all frontend listeners after each committed playback state change",
    },
    {
      name: "playback://queue-changed",
      summary:
        "Broadcasts queue ownership changes when the backend replaces or advances the queue.",
      payloadShape: "PlaybackQueueSnapshot",
      delivery:
        "emit to all frontend listeners when queue order or active index changes",
    },
  ],
  guarantees: [
    "queue order remains stable even when the visible tracks table is filtered or resorted",
    "playback state snapshots include track identity transport status timing and source authority",
    "frontend shell renders playback state and dispatches commands but does not own transport truth after migration",
  ],
};

export function getPreviewPlaybackContract(): PlaybackContractPayload {
  return previewPlaybackContract;
}

import type { LoadedPlaybackTrackPayload, PlaybackSource } from "./types";

export function getPreviewLoadedPlaybackTrack(
  trackId: string,
  source: PlaybackSource,
): LoadedPlaybackTrackPayload {
  return {
    playback: {
      ...previewShellState.playback,
      statusLabel: "Ready",
      transportLabel: "Ready",
      outputOwner: "frontend",
      trackId,
    },
    source,
  };
}
export function getPreviewPlaybackTimingState(
  progressSeconds?: number,
  durationSeconds?: number,
): PlaybackShellState {
  return {
    ...previewShellState.playback,
    progressSeconds:
      progressSeconds ?? previewShellState.playback.progressSeconds,
    durationSeconds:
      durationSeconds ?? previewShellState.playback.durationSeconds,
  };
}
export function getPreviewPlaybackActionState(
  action: "previous" | "toggle" | "next",
): PlaybackShellState {
  if (action === "toggle") {
    return {
      ...previewShellState.playback,
      transportLabel: "Preview only",
      outputOwner: "frontend",
    };
  }

  return previewShellState.playback;
}

export function getPreviewPlaybackSeekState(
  positionSeconds: number,
): PlaybackShellState {
  return {
    ...previewShellState.playback,
    outputOwner: "frontend",
    progressSeconds: positionSeconds,
  };
}

export function getPreviewCompletedPlaybackState(): PlaybackShellState {
  return {
    ...previewShellState.playback,
    statusLabel: "Ended",
    transportLabel: "Ended",
    outputOwner: "frontend",
  };
}
