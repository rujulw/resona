import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { invokeDesktop, invokeWithPreviewFallback, rethrowInDesktopRuntime, isBrowserPreviewRuntime } from "./desktop/runtime";

export type BootstrapPayload = {
  appName: string;
  appVersion: string;
  windowTitle: string;
  platform: string;
  runtime: {
    desktopShell: string;
    frontend: string;
    core: string;
  };
};

export type NavSection = {
  id: string;
  label: string;
};

export type LibraryRow = {
  title: string;
  detail: string;
  state: string;
};

export type PlaybackShellState = {
  statusLabel: string;
  transportLabel: string;
  outputOwner?: string;
  progressSeconds: number;
  durationSeconds: number;
  isPlaying?: boolean;
  trackId?: string | null;
  trackTitle?: string | null;
  trackArtist?: string | null;
  trackAlbum?: string | null;
  trackAdvisory?: boolean | null;
};

export type PlaybackCommandContract = {
  name: string;
  summary: string;
  requestShape: string;
  responseShape: string;
  authority: string;
};

export type PlaybackEventContract = {
  name: string;
  summary: string;
  payloadShape: string;
  delivery: string;
};

export type PlaybackContractPayload = {
  currentOwner: string;
  migrationTarget: string;
  runtimeBoundary: string;
  sourceResolutionOrder: string[];
  commands: PlaybackCommandContract[];
  events: PlaybackEventContract[];
  guarantees: string[];
};

export type PlaybackSource = {
  trackId: string;
  localPath: string;
  extension?: string;
  assetUrl: string;
};

export type LoadedPlaybackTrackPayload = {
  playback: PlaybackShellState;
  source: PlaybackSource;
};

export type UnlistenPlaybackState = () => void;

export type ArtworkSource = {
  artworkKey: string;
  localPath: string;
  assetUrl: string;
};

export type ShellStatePayload = {
  navSections: NavSection[];
  libraryRows: LibraryRow[];
  playback: PlaybackShellState;
};

export type ScanSummary = {
  libraryRootId: string;
  libraryRootName: string;
  rootPath: string;
  discoveredTracks: number;
  insertedTracks: number;
  updatedTracks: number;
  removedTracks: number;
};

export type TrackListItem = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  advisory?: boolean | null;
  durationSeconds: number | null;
  artworkKey: string | null;
  relativePath: string;
  extension?: string;
  sourceStatus: string;
  cacheState: string;
  analysisStatus: string;
  indexedAt: string;
};

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  artworkKey: string | null;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PlaylistEntryItem = {
  entryId: string;
  playlistId: string;
  trackId: string;
  position: number;
  addedAt: string;
  updatedAt: string;
  title: string;
  artist: string | null;
  album: string | null;
  advisory?: boolean | null;
  artworkKey: string | null;
  extension?: string;
  durationSeconds: number | null;
};

export type PlaylistDetail = {
  playlist: PlaylistSummary;
  entries: PlaylistEntryItem[];
};

export type PlaylistEntryInput = {
  entryId?: string;
  trackId: string;
  position: number;
};

export type PlaybackQueueSnapshot = {
  trackIds: string[];
  activeTrackId: string | null;
  sourceLabel: string;
};

export type PlaylistPlaybackHandoffPayload = {
  playback: PlaybackShellState;
  queue: PlaybackQueueSnapshot;
  playlistId: string;
  activeEntryId: string;
};

export type LibraryPagePayload = {
  items: TrackListItem[];
  nextCursor: string | null;
  total: number;
  pageSize: number;
};

const browserBootstrapPayload: BootstrapPayload = {
  appName: "resona",
  appVersion: "1.3.0",
  windowTitle: "resona",
  platform: "browser",
  runtime: {
    desktopShell: "browser-preview",
    frontend: "react-vite",
    core: "rust",
  },
};

const browserShellStatePayload: ShellStatePayload = {
  navSections: [
    { id: "tracks", label: "Tracks" },
    { id: "albums", label: "Albums" },
    { id: "artists", label: "Artists" },
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
    trackTitle: null,
    trackArtist: null,
    trackAlbum: null,
    trackAdvisory: null,
  },
};

const browserPlaybackContractPayload: PlaybackContractPayload = {
  currentOwner: "frontend-audio-element during v1 baseline",
  migrationTarget: "rust playback runtime owns transport queue progress and source state",
  runtimeBoundary:
    "tauri commands mutate playback runtime and tauri events broadcast playback snapshots",
  sourceResolutionOrder: ["local", "cache", "remote"],
  commands: [
    {
      name: "load_playback_track",
      summary: "Resolve a track and replace the active playback item without forcing autoplay.",
      requestShape: "{ trackId, queueTrackIds?, startPositionSeconds? }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "playback_action",
      summary: "Apply a transport action such as play pause previous next stop or toggle.",
      requestShape: "{ action }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "seek_playback",
      summary: "Move the active playback position to an explicit second offset.",
      requestShape: "{ positionSeconds }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "sync_playback_timing",
      summary: "Report renderer-observed playback timing back into the backend snapshot.",
      requestShape: "{ progressSeconds?, durationSeconds? }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "complete_playback",
      summary: "Mark the active playback item as ended when the renderer reaches the end.",
      requestShape: "{}",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "report_playback_error",
      summary: "Record a renderer playback failure without letting the shell invent its own error state.",
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
      delivery: "emit to all frontend listeners after each committed playback state change",
    },
    {
      name: "playback://queue-changed",
      summary:
        "Broadcasts queue ownership changes when the backend replaces or advances the queue.",
      payloadShape: "PlaybackQueueSnapshot",
      delivery: "emit to all frontend listeners when queue order or active index changes",
    },
  ],
  guarantees: [
    "queue order remains stable even when the visible tracks table is filtered or resorted",
    "playback state snapshots include track identity transport status timing and source authority",
    "frontend shell renders playback state and dispatches commands but does not own transport truth after migration",
  ],
};

let browserPlaylistCounter = 0;
let browserPlaylistEntryCounter = 0;
const browserPlaylists = new Map<string, PlaylistDetail>();

function normalizeOptionalText(value?: string | null): string | null {
  return value?.trim() ? value.trim() : null;
}

function normalizeOptionalNumber(value?: number | null): number | null {
  return value ?? null;
}

function normalizePlaylistMutationPayload(
  name: string,
  description?: string | null,
  artworkPath?: string | null,
): {
  name: string;
  description: string | null;
  artworkPath: string | null;
} {
  return {
    name,
    description: normalizeOptionalText(description),
    artworkPath: normalizeOptionalText(artworkPath),
  };
}

function normalizeTimingPayload(
  progressSeconds?: number,
  durationSeconds?: number,
): {
  progressSeconds: number | null;
  durationSeconds: number | null;
} {
  return {
    progressSeconds: normalizeOptionalNumber(progressSeconds),
    durationSeconds: normalizeOptionalNumber(durationSeconds),
  };
}

function normalizePlaybackErrorPayload(transportLabel?: string): {
  transportLabel: string | null;
} {
  return {
    transportLabel: normalizeOptionalText(transportLabel),
  };
}

export async function bootstrapApp(): Promise<BootstrapPayload> {
  return invokeWithPreviewFallback("bootstrap_app", undefined, () => browserBootstrapPayload);
}

export async function getShellState(): Promise<ShellStatePayload> {
  return invokeWithPreviewFallback("get_shell_state", undefined, () => browserShellStatePayload);
}

export async function loadPlaybackTrack(
  trackId: string,
): Promise<LoadedPlaybackTrackPayload | null> {
  type DesktopLoadedPlaybackTrackPayload = {
    playback: PlaybackShellState;
    source: { trackId: string; localPath: string; extension?: string };
  };

  const payload = await invokeWithPreviewFallback<
    DesktopLoadedPlaybackTrackPayload | LoadedPlaybackTrackPayload | null,
    { trackId: string }
  >(
    "load_playback_track",
    { trackId },
    async () => {
      const source = await resolveTrackPlaybackSource(trackId);
      if (!source) {
        return null;
      }

      return {
        playback: {
          ...browserShellStatePayload.playback,
          statusLabel: "Ready",
          transportLabel: "Ready",
          outputOwner: "frontend",
          trackId,
        },
        source,
      };
    },
  );

  if (!payload) {
    return null;
  }
    return {
      playback: payload.playback,
      source: {
        trackId: payload.source.trackId,
        localPath: payload.source.localPath,
        extension: payload.source.extension,
        assetUrl: convertFileSrc(payload.source.localPath),
      },
    };
}

export async function describePlaybackContract(): Promise<PlaybackContractPayload> {
  return invokeWithPreviewFallback(
    "describe_playback_contract",
    undefined,
    () => browserPlaybackContractPayload,
  );
}

export async function listPlaylists(): Promise<PlaylistSummary[]> {
  return invokeWithPreviewFallback("list_playlists", undefined, () =>
    Array.from(browserPlaylists.values())
      .map((detail) => detail.playlist)
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
}

export async function getPlaylist(playlistId: string): Promise<PlaylistDetail | null> {
  return invokeWithPreviewFallback("get_playlist", { playlistId }, () =>
    browserPlaylists.get(playlistId) ?? null,
  );
}

export async function createPlaylist(
  name: string,
  description?: string | null,
  artworkPath?: string | null,
): Promise<PlaylistSummary> {
  return invokeWithPreviewFallback(
    "create_playlist",
    normalizePlaylistMutationPayload(name, description, artworkPath),
    () => {
      browserPlaylistCounter += 1;
      const now = `${Date.now()}`;
      const normalizedDescription = normalizeOptionalText(description);
      const normalizedArtworkPath = normalizeOptionalText(artworkPath);

      const playlist: PlaylistSummary = {
        id: `browser-playlist-${browserPlaylistCounter}`,
        name: name.trim(),
        description: normalizedDescription,
        artworkKey: normalizedArtworkPath
          ? `browser-playlist-artwork-${browserPlaylistCounter}`
          : null,
        entryCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      browserPlaylists.set(playlist.id, {
        playlist,
        entries: [],
      });

      return playlist;
    },
  );
}

export async function updatePlaylist(
  playlistId: string,
  name: string,
  description?: string | null,
  artworkPath?: string | null,
): Promise<PlaylistSummary> {
  return invokeWithPreviewFallback(
    "update_playlist",
    {
      playlistId,
      ...normalizePlaylistMutationPayload(name, description, artworkPath),
    },
    () => {
      const existing = browserPlaylists.get(playlistId);
      if (!existing) {
        throw new Error(`playlist ${playlistId} was not found`);
      }

      const normalizedDescription = normalizeOptionalText(description);
      const normalizedArtworkPath = normalizeOptionalText(artworkPath);

      const updatedSummary: PlaylistSummary = {
        ...existing.playlist,
        name: name.trim(),
        description: normalizedDescription,
        artworkKey: normalizedArtworkPath
          ? `browser-playlist-artwork-${playlistId}`
          : existing.playlist.artworkKey,
        updatedAt: `${Date.now()}`,
      };

      browserPlaylists.set(playlistId, {
        ...existing,
        playlist: updatedSummary,
      });

      return updatedSummary;
    },
  );
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  return invokeWithPreviewFallback("delete_playlist", { playlistId }, () => {
    browserPlaylists.delete(playlistId);
  });
}

export async function addTrackToPlaylist(playlistId: string, track: TrackListItem, ): Promise<PlaylistDetail> {
  return invokeWithPreviewFallback(
    "add_track_to_playlist",
  {
    playlistId,
    trackId: track.id,
  },
  () => {
    const existing = browserPlaylists.get(playlistId);
    if (!existing) {
      throw new Error(`playlist ${playlistId} was not found`);
    }

    browserPlaylistEntryCounter += 1;
    const nextEntry = {
      entryId: `browser-playlist-entry-${browserPlaylistEntryCounter}`,
      playlistId,
      trackId: track.id,
      position: existing.entries.length,
      addedAt: `${Date.now()}`,
      updatedAt: `${Date.now()}`,
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
        updatedAt: `${Date.now()}`,
      },
      entries: [...existing.entries, nextEntry],
    };
    browserPlaylists.set(playlistId, detail);
    return detail;
  },
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
    () => {
      const existing = browserPlaylists.get(playlistId);
      if (!existing) {
        throw new Error(`playlist ${playlistId} was not found`);
      }

      const nextEntries = [...existing.entries];
      const currentIndex = nextEntries.findIndex((entry) => entry.entryId === entryId);
      if (currentIndex < 0) {
        throw new Error(`playlist entry ${entryId} was not found`);
      }

      const [movedEntry] = nextEntries.splice(currentIndex, 1);
      const boundedTarget = Math.max(0, Math.min(targetPosition, nextEntries.length));
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

      browserPlaylists.set(playlistId, detail);
      return detail;
    },
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
    () => {
      const existing = browserPlaylists.get(playlistId);
      if (!existing) {
        throw new Error(`playlist ${playlistId} was not found`);
      }

      const trackByEntryId = new Map(existing.entries.map((entry) => [entry.entryId, entry]));
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

        browserPlaylistEntryCounter += 1;
        return {
          entryId: `browser-playlist-entry-${browserPlaylistEntryCounter}`,
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

      browserPlaylists.set(playlistId, detail);
      return detail;
    },
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
    () => {
      const existing = browserPlaylists.get(playlistId);
      if (!existing) {
        throw new Error(`playlist ${playlistId} was not found`);
      }

      const nextEntries = existing.entries.filter((entry) => entry.entryId !== entryId);
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

      browserPlaylists.set(playlistId, detail);
      return detail;
    },
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
    () => {
      const detail = browserPlaylists.get(playlistId);
      if (!detail || detail.entries.length === 0) {
        throw new Error(`playlist ${playlistId} was not found`);
      }

      const activeEntry =
        detail.entries.find((entry) => entry.entryId === (startEntryId ?? "")) ??
        detail.entries[0];

      return {
        playback: {
          ...browserShellStatePayload.playback,
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
    },
  );
}

export async function subscribePlaybackState(
  onPlayback: (playback: PlaybackShellState) => void,
): Promise<UnlistenPlaybackState> {
  try {
    return await listen<PlaybackShellState>("playback://state-changed", (event) => {
      onPlayback(event.payload);
    });
  } catch (error) {
    const { isBrowserPreviewRuntime, rethrowInDesktopRuntime } = await import("./desktop/runtime");

    if (!isBrowserPreviewRuntime()) {
      rethrowInDesktopRuntime(error);
    }

    return () => undefined;
  }
}

export async function playbackAction(
  action: "previous" | "toggle" | "next",
): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback("playback_action", { action }, () => {
    if (action === "toggle") {
      return {
        ...browserShellStatePayload.playback,
        transportLabel: "Preview only",
        outputOwner: "frontend",
      };
    }

    return browserShellStatePayload.playback;
  });
}

export async function syncPlaybackTiming(
  progressSeconds?: number,
  durationSeconds?: number,
): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback(
    "sync_playback_timing",
    normalizeTimingPayload(progressSeconds, durationSeconds),
    () => browserShellStatePayload.playback,
  );
}

export async function seekPlayback(positionSeconds: number): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback("seek_playback", { positionSeconds }, () => ({
    ...browserShellStatePayload.playback,
    outputOwner: "frontend",
    progressSeconds: positionSeconds,
  }));
}

export async function completePlayback(): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback("complete_playback", undefined, () => ({
    ...browserShellStatePayload.playback,
    statusLabel: "Ended",
    transportLabel: "Ended",
    outputOwner: "frontend",
  }));
}

export async function reportPlaybackError(
  transportLabel?: string,
): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback(
    "report_playback_error",
    normalizePlaybackErrorPayload(transportLabel),
    () => ({
      ...browserShellStatePayload.playback,
      statusLabel: "Error",
      transportLabel: normalizeOptionalText(transportLabel) ?? "Playback error",
      outputOwner: "frontend",
    }),
  );
}

export async function scanLocalLibrary(
  rootPath: string,
  displayName?: string,
): Promise<ScanSummary> {
  return invokeDesktop("scan_local_library", {
    rootPath,
    displayName: normalizeOptionalText(displayName),
  });
}

export async function queryLibrary(options?: {
  pageSize?: number;
  cursor?: string | null;
  search?: string | null;
  sortKey?: "title" | "artist" | "album" | "indexed_at";
  sortDirection?: "asc" | "desc";
}): Promise<LibraryPagePayload> {
  return invokeWithPreviewFallback(
    "query_library",
    {
      pageSize: options?.pageSize ?? 100,
      cursor: options?.cursor ?? null,
      search: options?.search ?? null,
      sortKey: options?.sortKey ?? "title",
      sortDirection: options?.sortDirection ?? "asc",
    },
    () => ({
      items: [],
      nextCursor: null,
      total: 0,
      pageSize: options?.pageSize ?? 100,
    }),
  );
}

export async function resolveTrackPlaybackSource(
  trackId: string,
): Promise<PlaybackSource | null> {
  return invokeWithPreviewFallback<
    { trackId: string; localPath: string; extension: string } | null,
    { trackId: string }
  >(
    "resolve_track_playback_source",
    { trackId },
    () => null,
  ).then((payload) => {
    if (!payload) {
      return null;
    }

    return {
      trackId: payload.trackId,
      localPath: payload.localPath,
      extension: payload.extension,
      assetUrl: convertFileSrc(payload.localPath),
    };
  });
}

export async function resolveArtworkSource(
  artworkKey: string,
): Promise<ArtworkSource | null> {
  return invokeWithPreviewFallback<
    { artworkKey: string; localPath: string } | null,
    { artworkKey: string }
  >(
    "resolve_artwork_source",
    { artworkKey },
    () => null,
  ).then((payload) => {
    if (!payload) {
      return null;
    }

    return {
      artworkKey: payload.artworkKey,
      localPath: payload.localPath,
      assetUrl: convertFileSrc(payload.localPath),
    };
  });
}

export async function pickLibraryDirectory(
  defaultPath?: string | null,
): Promise<string | null> {
  const selected = await open({
    title: "Choose music folder",
    directory: true,
    multiple: false,
    recursive: true,
    defaultPath: defaultPath?.trim() ? defaultPath : undefined,
  });

  return typeof selected === "string" ? selected : null;
}

export async function pickPlaylistArtwork(
  defaultPath?: string | null,
): Promise<string | null> {
  const selected = await open({
    title: "Choose playlist cover",
    directory: false,
    multiple: false,
    recursive: false,
    defaultPath: defaultPath?.trim() ? defaultPath : undefined,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp"],
      },
    ],
  });

  return typeof selected === "string" ? selected : null;
}
