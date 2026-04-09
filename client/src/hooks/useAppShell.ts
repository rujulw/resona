import { useEffect, useRef, useState } from "react";

import {
  addTrackToPlaylist,
  bootstrapApp,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  getShellState,
  listPlaylists,
  loadPlaybackTrack,
  pickLibraryDirectory,
  playbackAction,
  queryLibrary,
  reportPlaybackError,
  scanLocalLibrary,
  seekPlayback,
  subscribePlaybackState,
  updatePlaylist,
  type TrackListItem,
} from "../desktop";
import type {
  BootstrapState,
  ImportSummary,
  PlaylistsState,
  QueueState,
  ScanState,
  ShellState,
  TracksQueryState,
  TracksState,
} from "../types/app";

export function useAppShell() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackRequestIdRef = useRef(0);
  const tracksRequestIdRef = useRef(0);
  const trackCatalogRef = useRef(new Map<string, TrackListItem>());
  const playbackQueueTrackIdsRef = useRef<string[]>([]);
  const activeTrackIdRef = useRef<string | null>(null);
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>({
    status: "loading",
  });
  const [shellState, setShellState] = useState<ShellState | null>(null);
  const [tracksState, setTracksState] = useState<TracksState>({
    status: "loading",
    items: [],
    total: 0,
    selectedTrackId: null,
  });
  const [libraryPath, setLibraryPath] = useState("");
  const [scanState, setScanState] = useState<ScanState>({
    status: "idle",
    message: "",
    lastScan: null,
  });
  const [tracksQueryState, setTracksQueryState] = useState<TracksQueryState>({
    searchDraft: "",
    search: "",
    sortKey: "title",
    sortDirection: "asc",
  });
  const [playbackQueueTrackIds, setPlaybackQueueTrackIds] = useState<string[]>([]);
  const [playlistsState, setPlaylistsState] = useState<PlaylistsState>({
    status: "loading",
    items: [],
    activePlaylistId: null,
    activePlaylist: null,
  });
  const completionHandledRef = useRef<string | null>(null);

  const isRustOutputPlayback = shellState?.playback.outputOwner === "rust";

  useEffect(() => {
    playbackQueueTrackIdsRef.current = playbackQueueTrackIds;
  }, [playbackQueueTrackIds]);

  useEffect(() => {
    activeTrackIdRef.current = shellState?.playback.trackId ?? tracksState.selectedTrackId;
  }, [shellState?.playback.trackId, tracksState.selectedTrackId]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      bootstrapApp(),
      getShellState(),
      fetchAllTracks({
        search: null,
        sortKey: "title",
        sortDirection: "asc",
      }),
      listPlaylists(),
    ])
      .then(([payload, shellPayload, libraryPage, playlists]) => {
        if (cancelled) {
          return;
        }

        document.title = payload.windowTitle;
        setBootstrapState({ status: "ready", payload });
        setShellState({
          libraryRows: shellPayload.libraryRows,
          playback: shellPayload.playback,
        });
        setTracksState({
          status: "ready",
          items: libraryPage.items,
          total: libraryPage.total,
          selectedTrackId: null,
        });
        setPlaylistsState({
          status: "ready",
          items: playlists,
          activePlaylistId: playlists[0]?.id ?? null,
          activePlaylist: null,
        });
        mergeTrackCatalog(trackCatalogRef.current, libraryPage.items);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Failed to bootstrap app";
        setBootstrapState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let detached = false;
    let unlisten: (() => void) | undefined;

    void subscribePlaybackState((playback) => {
      if (detached) {
        return;
      }

      setShellState((existing) => {
        if (!existing) {
          return existing;
        }

        return {
          ...existing,
          playback: {
            ...existing.playback,
            ...playback,
            isPlaying: playback.isPlaying ?? existing.playback.isPlaying ?? false,
            trackId: playback.trackId ?? existing.playback.trackId ?? null,
            trackTitle: playback.trackTitle ?? existing.playback.trackTitle ?? null,
            trackArtist: playback.trackArtist ?? existing.playback.trackArtist ?? null,
            trackAlbum: playback.trackAlbum ?? existing.playback.trackAlbum ?? null,
            trackAdvisory:
              playback.trackAdvisory ?? existing.playback.trackAdvisory ?? null,
          },
        };
      });
    }).then((dispose) => {
      if (detached) {
        dispose();
        return;
      }

      unlisten = dispose;
    });

    return () => {
      detached = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    return () => {
      try {
        audio.pause();
      } catch {
        // jsdom does not implement media teardown fully, but the browser/webview does.
      }
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !shellState?.playback.trackId) {
      return;
    }

    if (shellState.playback.outputOwner === "rust") {
      if (!audio.paused) {
        audio.pause();
      }
      return;
    }

    if (!audio.src) {
      return;
    }

    if (shellState.playback.isPlaying) {
      if (!audio.paused) {
        return;
      }

      void audio.play().catch(() => {
        void playbackAction("toggle");
      });
      return;
    }

    if (!audio.paused) {
      audio.pause();
    }
  }, [
    shellState?.playback.isPlaying,
    shellState?.playback.outputOwner,
    shellState?.playback.trackId,
  ]);

  useEffect(() => {
    const playback = shellState?.playback;
    if (!playback || playback.outputOwner !== "rust" || playback.statusLabel !== "Ended") {
      completionHandledRef.current = null;
      return;
    }

    const completionKey = `${playback.trackId ?? "none"}:${playback.progressSeconds}`;
    if (completionHandledRef.current === completionKey) {
      return;
    }
    completionHandledRef.current = completionKey;

    const activeTrackId = playback.trackId ?? tracksState.selectedTrackId;
    const activeIndex = activeTrackId
      ? playbackQueueTrackIdsRef.current.findIndex((trackId) => trackId === activeTrackId)
      : -1;
    const nextTrackId =
      activeIndex >= 0 ? playbackQueueTrackIdsRef.current[activeIndex + 1] : undefined;
    const nextTrack = nextTrackId
      ? trackCatalogRef.current.get(nextTrackId)
      : undefined;

    if (nextTrack) {
      void startTrackPlayback(nextTrack, true);
    }
  }, [
    shellState?.playback.outputOwner,
    shellState?.playback.progressSeconds,
    shellState?.playback.statusLabel,
    shellState?.playback.trackId,
    tracksState.selectedTrackId,
  ]);

  const refreshShellState = () => {
    void getShellState().then((shellPayload) => {
      setShellState((existing) => ({
        libraryRows: shellPayload.libraryRows,
        playback: existing?.playback ?? shellPayload.playback,
      }));
    });
  };

  const refreshPlaylists = (
    nextActivePlaylistId?: string | null,
    options?: { preserveSelection?: boolean },
  ) => {
    setPlaylistsState((existing) => ({
      ...existing,
      status: "loading",
    }));

    void listPlaylists()
      .then(async (playlists) => {
        const fallbackActivePlaylistId =
          options?.preserveSelection === false
            ? null
            : nextActivePlaylistId ?? playlistsState.activePlaylistId ?? playlists[0]?.id ?? null;
        const activePlaylist =
          fallbackActivePlaylistId != null
            ? await getPlaylist(fallbackActivePlaylistId)
            : null;

        setPlaylistsState({
          status: "ready",
          items: playlists,
          activePlaylistId: activePlaylist?.playlist.id ?? fallbackActivePlaylistId,
          activePlaylist,
        });
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to load playlists.",
        }));
      });
  };

  const handlePlaylistSelection = (playlistId: string) => {
    setPlaylistsState((existing) => ({
      ...existing,
      status: "loading",
      activePlaylistId: playlistId,
    }));

    void Promise.all([listPlaylists(), getPlaylist(playlistId)])
      .then(([playlists, activePlaylist]) => {
        setPlaylistsState({
          status: "ready",
          items: playlists,
          activePlaylistId: playlistId,
          activePlaylist,
        });
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to load playlist.",
        }));
      });
  };

  const handlePlaylistCreate = async (name: string) => {
    try {
      const playlist = await createPlaylist(name);
      refreshPlaylists(playlist.id);
      return playlist.id;
    } catch (error: unknown) {
      setPlaylistsState((existing) => ({
        ...existing,
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to create playlist.",
      }));
      return null;
    }
  };

  const handlePlaylistRename = (
    playlistId: string,
    name: string,
    description?: string | null,
  ) => {
    void updatePlaylist(playlistId, name, description ?? null)
      .then((playlist) => {
        refreshPlaylists(playlist.id);
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to update playlist.",
        }));
      });
  };

  const handlePlaylistDelete = (playlistId: string) => {
    void deletePlaylist(playlistId)
      .then(() => {
        const remainingPlaylists = playlistsState.items.filter((item) => item.id !== playlistId);
        refreshPlaylists(remainingPlaylists[0]?.id ?? null, { preserveSelection: false });
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to delete playlist.",
        }));
      });
  };

  const handlePlaylistTrackAdd = (playlistId: string, track: TrackListItem) => {
    void addTrackToPlaylist(playlistId, track)
      .then((detail) => {
        setPlaylistsState((existing) => ({
          status: "ready",
          items: existing.items.map((item) =>
            item.id === detail.playlist.id ? detail.playlist : item,
          ),
          activePlaylistId: detail.playlist.id,
          activePlaylist: detail,
        }));
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to add track to playlist.",
        }));
      });
  };

  const refreshTracks = (overrides?: Partial<TracksQueryState>) => {
    const effectiveQuery = {
      ...tracksQueryState,
      ...overrides,
    };
    const requestId = tracksRequestIdRef.current + 1;
    tracksRequestIdRef.current = requestId;

    setTracksState((existing) => ({
      ...existing,
      status: "loading",
    }));

    void fetchAllTracks({
      search: effectiveQuery.search || null,
      sortKey: effectiveQuery.sortKey,
      sortDirection: effectiveQuery.sortDirection,
    })
      .then((libraryPage) => {
        if (tracksRequestIdRef.current != requestId) {
          return;
        }

        mergeTrackCatalog(trackCatalogRef.current, libraryPage.items);
        setTracksState({
          status: "ready",
          items: libraryPage.items,
          total: libraryPage.total,
          selectedTrackId:
            existingSelectedTrackId(libraryPage.items, tracksState.selectedTrackId),
        });
        setTracksQueryState((existing) => ({
          ...existing,
          ...overrides,
        }));
      })
      .catch((error: unknown) => {
        if (tracksRequestIdRef.current != requestId) {
          return;
        }

        setTracksState({
          status: "error",
          items: [],
          total: 0,
          selectedTrackId: null,
          message:
            error instanceof Error ? error.message : "Failed to load track library.",
        });
        setTracksQueryState((existing) => ({
          ...existing,
          ...overrides,
        }));
      });
  };

  const handlePlaybackAction = (action: "previous" | "toggle" | "next") => {
    const audio = audioRef.current;

    if (action === "previous" || action === "next") {
      const activeTrackId = shellState?.playback.trackId ?? tracksState.selectedTrackId;
      const activeIndex = activeTrackId
        ? playbackQueueTrackIds.findIndex((trackId) => trackId === activeTrackId)
        : -1;

      const currentProgressSeconds = isRustOutputPlayback
        ? shellState?.playback.progressSeconds ?? 0
        : audio?.currentTime ?? 0;

      if (action === "previous" && currentProgressSeconds > 3 && activeTrackId) {
        if (audio) {
          audio.currentTime = 0;
        }
        void seekPlayback(0);
        return;
      }

      const targetIndex =
        activeIndex >= 0
          ? action === "previous"
            ? activeIndex - 1
            : activeIndex + 1
          : action === "next"
            ? 0
            : -1;
      const targetTrackId =
        targetIndex >= 0 ? playbackQueueTrackIds[targetIndex] : undefined;
      const targetTrack = targetTrackId
        ? trackCatalogRef.current.get(targetTrackId)
        : undefined;

      if (targetTrack) {
        void startTrackPlayback(targetTrack, true);
        return;
      }
    }

    if (action === "toggle") {
      if (shellState?.playback.trackId && (isRustOutputPlayback || (audio && audio.src))) {
        void playbackAction("toggle");
        return;
      }

      if (!shellState?.playback.trackId && tracksState.items.length > 0) {
        void startTrackPlayback(tracksState.items[0], true);
        return;
      }
    }

    void playbackAction(action);
  };

  const handleTrackSelection = (track: TrackListItem) => {
    startTrackPlayback(track, true);
  };

  const handlePlaybackSeek = (positionSeconds: number) => {
    const clampedSeconds = Math.max(
      0,
      Math.min(
        Math.round(positionSeconds),
        shellState?.playback.durationSeconds ?? Math.round(positionSeconds),
      ),
    );

    if (audioRef.current && !isRustOutputPlayback) {
      audioRef.current.currentTime = clampedSeconds;
    }

    void seekPlayback(clampedSeconds);
  };

  const startTrackPlayback = async (track: TrackListItem, autoplay: boolean) => {
    const requestId = playbackRequestIdRef.current + 1;
    playbackRequestIdRef.current = requestId;
    setPlaybackQueueTrackIds((existing) => {
      const visibleTrackIds = tracksState.items.map((item) => item.id);
      if (visibleTrackIds.includes(track.id)) {
        return visibleTrackIds;
      }

      if (existing.includes(track.id)) {
        return existing;
      }

      return [track.id];
    });
    trackCatalogRef.current.set(track.id, track);

    setTracksState((existing) => ({
      ...existing,
      selectedTrackId: track.id,
    }));
    const payload = await loadPlaybackTrack(track.id);
    if (playbackRequestIdRef.current != requestId) {
      return;
    }

    if (!payload) {
      void reportPlaybackError("Local source unavailable");
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.pause();
    if (payload.playback.outputOwner === "rust") {
      audio.src = "";
    } else {
      audio.src = payload.source.assetUrl;
    }
    audio.currentTime = 0;

    if (!autoplay) {
      return;
    }

    void playbackAction("toggle");
  };

  const handleScan = () => {
    const trimmedPath = libraryPath.trim();
    if (!trimmedPath) {
      setScanState({
        status: "error",
        message: "Choose a folder before scanning your library.",
        lastScan: scanState.lastScan,
      });
      return;
    }

    setScanState({
      status: "running",
      message: "Scanning local library...",
      lastScan: scanState.lastScan,
    });

    void scanLocalLibrary(trimmedPath)
      .then((summary) => {
        const lastScan = toImportSummary(summary);
        setScanState({
          status: "success",
          message:
            summary.discoveredTracks > 0
              ? `Indexed ${summary.discoveredTracks} track(s) from ${summary.libraryRootName}.`
              : `Scan finished for ${summary.libraryRootName}, but no supported audio files were found.`,
          lastScan,
        });
        refreshShellState();
        refreshTracks();
      })
      .catch((error: unknown) => {
        setScanState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to scan local library.",
          lastScan: scanState.lastScan,
        });
      });
  };

  const handlePickLibraryDirectory = () => {
    void pickLibraryDirectory(libraryPath)
      .then((selectedPath) => {
        if (!selectedPath) {
          return;
        }

        setLibraryPath(selectedPath);
        setScanState({
          status: "idle",
          message: `Selected ${selectedPath}.`,
          lastScan: scanState.lastScan,
        });
      })
      .catch((error: unknown) => {
        setScanState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to open folder picker.",
          lastScan: scanState.lastScan,
        });
      });
  };

  const handleTracksSearchDraftChange = (value: string) => {
    setTracksQueryState((existing) => ({
      ...existing,
      searchDraft: value,
    }));
  };

  const handleTracksSearchSubmit = () => {
    refreshTracks({
      search: tracksQueryState.searchDraft.trim(),
    });
  };

  const handleTracksTitleHeaderSort = () => {
    const nextSort =
      tracksQueryState.sortKey === "title" && tracksQueryState.sortDirection === "asc"
        ? { sortKey: "title" as const, sortDirection: "desc" as const }
        : tracksQueryState.sortKey === "title" &&
            tracksQueryState.sortDirection === "desc"
          ? { sortKey: "artist" as const, sortDirection: "asc" as const }
          : tracksQueryState.sortKey === "artist" &&
              tracksQueryState.sortDirection === "asc"
            ? { sortKey: "artist" as const, sortDirection: "desc" as const }
            : { sortKey: "title" as const, sortDirection: "asc" as const };

    refreshTracks({
      ...nextSort,
    });
  };

  const handleTracksAlbumHeaderSort = () => {
    const nextSort =
      tracksQueryState.sortKey === "album" && tracksQueryState.sortDirection === "asc"
        ? { sortKey: "album" as const, sortDirection: "desc" as const }
        : tracksQueryState.sortKey === "album" &&
            tracksQueryState.sortDirection === "desc"
          ? { sortKey: "title" as const, sortDirection: "asc" as const }
          : { sortKey: "album" as const, sortDirection: "asc" as const };

    refreshTracks({
      ...nextSort,
    });
  };

  const queueState = deriveQueueState(
    trackCatalogRef.current,
    playbackQueueTrackIds,
    shellState?.playback.trackId ?? tracksState.selectedTrackId,
  );

  return {
    bootstrapState,
    playlistsState,
    queueState,
    shellState,
    tracksState,
    tracksQueryState,
    libraryPath,
    scanState,
    setLibraryPath,
    handlePickLibraryDirectory,
    handlePlaylistCreate,
    handlePlaylistDelete,
    handlePlaylistRename,
    handlePlaylistSelection,
    handlePlaylistTrackAdd,
    handlePlaybackAction,
    handlePlaybackSeek,
    handleTrackSelection,
    handleScan,
    handleTracksSearchDraftChange,
    handleTracksSearchSubmit,
    handleTracksTitleHeaderSort,
    handleTracksAlbumHeaderSort,
  };
}

async function fetchAllTracks(options: {
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

function toImportSummary(summary: {
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

function existingSelectedTrackId(
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

function deriveQueueState(
  trackCatalog: Map<string, TrackListItem>,
  queueTrackIds: string[],
  activeTrackId: string | null | undefined,
): QueueState {
  if (!activeTrackId) {
    return {
      activeTrack: null,
      upcomingTracks: [],
      totalTracks: 0,
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
    };
  }

  return {
    activeTrack: queueItems[activeIndex],
    upcomingTracks: queueItems.slice(activeIndex + 1),
    totalTracks: queueItems.length - activeIndex,
  };
}

function mergeTrackCatalog(
  trackCatalog: Map<string, TrackListItem>,
  items: TrackListItem[],
) {
  for (const item of items) {
    trackCatalog.set(item.id, item);
  }
}
