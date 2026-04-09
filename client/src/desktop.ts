import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

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

export type LibraryPagePayload = {
  items: TrackListItem[];
  nextCursor: string | null;
  total: number;
  pageSize: number;
};

const browserBootstrapPayload: BootstrapPayload = {
  appName: "resona",
  appVersion: "1.2.0",
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

export async function bootstrapApp(): Promise<BootstrapPayload> {
  try {
    return await invoke<BootstrapPayload>("bootstrap_app");
  } catch {
    return browserBootstrapPayload;
  }
}

export async function getShellState(): Promise<ShellStatePayload> {
  try {
    return await invoke<ShellStatePayload>("get_shell_state");
  } catch {
    return browserShellStatePayload;
  }
}

export async function loadPlaybackTrack(
  trackId: string,
): Promise<LoadedPlaybackTrackPayload | null> {
  try {
    const payload = await invoke<{
      playback: PlaybackShellState;
      source: { trackId: string; localPath: string; extension?: string };
    }>("load_playback_track", { trackId });

    return {
      playback: payload.playback,
      source: {
        trackId: payload.source.trackId,
        localPath: payload.source.localPath,
        extension: payload.source.extension,
        assetUrl: convertFileSrc(payload.source.localPath),
      },
    };
  } catch {
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
  }
}

export async function describePlaybackContract(): Promise<PlaybackContractPayload> {
  try {
    return await invoke<PlaybackContractPayload>("describe_playback_contract");
  } catch {
    return browserPlaybackContractPayload;
  }
}

export async function listPlaylists(): Promise<PlaylistSummary[]> {
  try {
    return await invoke<PlaylistSummary[]>("list_playlists");
  } catch {
    return Array.from(browserPlaylists.values())
      .map((detail) => detail.playlist)
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}

export async function getPlaylist(playlistId: string): Promise<PlaylistDetail | null> {
  try {
    return await invoke<PlaylistDetail>("get_playlist", {
      playlistId,
    });
  } catch {
    return browserPlaylists.get(playlistId) ?? null;
  }
}

export async function createPlaylist(
  name: string,
  description?: string | null,
): Promise<PlaylistSummary> {
  try {
    return await invoke<PlaylistSummary>("create_playlist", {
      name,
      description: description?.trim() ? description : null,
    });
  } catch {
    browserPlaylistCounter += 1;
    const now = `${Date.now()}`;
    const playlist: PlaylistSummary = {
      id: `browser-playlist-${browserPlaylistCounter}`,
      name: name.trim(),
      description: description?.trim() ? description.trim() : null,
      entryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    browserPlaylists.set(playlist.id, {
      playlist,
      entries: [],
    });
    return playlist;
  }
}

export async function updatePlaylist(
  playlistId: string,
  name: string,
  description?: string | null,
): Promise<PlaylistSummary> {
  try {
    return await invoke<PlaylistSummary>("update_playlist", {
      playlistId,
      name,
      description: description?.trim() ? description : null,
    });
  } catch {
    const existing = browserPlaylists.get(playlistId);
    if (!existing) {
      throw new Error(`playlist ${playlistId} was not found`);
    }

    const updatedSummary: PlaylistSummary = {
      ...existing.playlist,
      name: name.trim(),
      description: description?.trim() ? description.trim() : null,
      updatedAt: `${Date.now()}`,
    };
    browserPlaylists.set(playlistId, {
      ...existing,
      playlist: updatedSummary,
    });
    return updatedSummary;
  }
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  try {
    await invoke("delete_playlist", { playlistId });
  } catch {
    browserPlaylists.delete(playlistId);
  }
}

export async function addTrackToPlaylist(
  playlistId: string,
  track: TrackListItem,
): Promise<PlaylistDetail> {
  try {
    return await invoke<PlaylistDetail>("add_track_to_playlist", {
      playlistId,
      trackId: track.id,
    });
  } catch {
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
  }
}

export async function subscribePlaybackState(
  onPlayback: (playback: PlaybackShellState) => void,
): Promise<UnlistenPlaybackState> {
  try {
    return await listen<PlaybackShellState>("playback://state-changed", (event) => {
      onPlayback(event.payload);
    });
  } catch {
    return () => undefined;
  }
}

export async function playbackAction(
  action: "previous" | "toggle" | "next",
): Promise<PlaybackShellState> {
  try {
    return await invoke<PlaybackShellState>("playback_action", { action });
  } catch {
    if (action === "toggle") {
      return {
        ...browserShellStatePayload.playback,
        transportLabel: "Preview only",
        outputOwner: "frontend",
      };
    }

    return browserShellStatePayload.playback;
  }
}

export async function syncPlaybackTiming(
  progressSeconds?: number,
  durationSeconds?: number,
): Promise<PlaybackShellState> {
  try {
    return await invoke<PlaybackShellState>("sync_playback_timing", {
      progressSeconds: progressSeconds ?? null,
      durationSeconds: durationSeconds ?? null,
    });
  } catch {
    return browserShellStatePayload.playback;
  }
}

export async function seekPlayback(positionSeconds: number): Promise<PlaybackShellState> {
  try {
    return await invoke<PlaybackShellState>("seek_playback", {
      positionSeconds,
    });
  } catch {
    return {
      ...browserShellStatePayload.playback,
      outputOwner: "frontend",
      progressSeconds: positionSeconds,
    };
  }
}

export async function completePlayback(): Promise<PlaybackShellState> {
  try {
    return await invoke<PlaybackShellState>("complete_playback");
  } catch {
    return {
      ...browserShellStatePayload.playback,
      statusLabel: "Ended",
      transportLabel: "Ended",
      outputOwner: "frontend",
    };
  }
}

export async function reportPlaybackError(
  transportLabel?: string,
): Promise<PlaybackShellState> {
  try {
    return await invoke<PlaybackShellState>("report_playback_error", {
      transportLabel: transportLabel ?? null,
    });
  } catch {
    return {
      ...browserShellStatePayload.playback,
      statusLabel: "Error",
      transportLabel: transportLabel ?? "Playback error",
      outputOwner: "frontend",
    };
  }
}

export async function scanLocalLibrary(
  rootPath: string,
  displayName?: string,
): Promise<ScanSummary> {
  return invoke<ScanSummary>("scan_local_library", {
    rootPath,
    displayName: displayName?.trim() ? displayName : null,
  });
}

export async function queryLibrary(options?: {
  pageSize?: number;
  cursor?: string | null;
  search?: string | null;
  sortKey?: "title" | "artist" | "album" | "indexed_at";
  sortDirection?: "asc" | "desc";
}): Promise<LibraryPagePayload> {
  try {
    return await invoke<LibraryPagePayload>("query_library", {
      pageSize: options?.pageSize ?? 100,
      cursor: options?.cursor ?? null,
      search: options?.search ?? null,
      sortKey: options?.sortKey ?? "title",
      sortDirection: options?.sortDirection ?? "asc",
    });
  } catch {
    return {
      items: [],
      nextCursor: null,
      total: 0,
      pageSize: options?.pageSize ?? 100,
    };
  }
}

export async function resolveTrackPlaybackSource(
  trackId: string,
): Promise<PlaybackSource | null> {
  try {
    const payload = await invoke<{ trackId: string; localPath: string }>(
      "resolve_track_playback_source",
      {
        trackId,
      },
    );

    return {
      trackId: payload.trackId,
      localPath: payload.localPath,
      assetUrl: convertFileSrc(payload.localPath),
    };
  } catch {
    return null;
  }
}

export async function resolveArtworkSource(
  artworkKey: string,
): Promise<ArtworkSource | null> {
  try {
    const payload = await invoke<{ artworkKey: string; localPath: string }>(
      "resolve_artwork_source",
      {
        artworkKey,
      },
    );

    return {
      artworkKey: payload.artworkKey,
      localPath: payload.localPath,
      assetUrl: convertFileSrc(payload.localPath),
    };
  } catch {
    return null;
  }
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
