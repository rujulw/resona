import { useEffect, useRef, useState } from "react";

import {
  addTrackToPlaylist,
  bootstrapApp,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  getShellState,
  listPlaylists,
  movePlaylistEntry,
  pickLibraryDirectory,
  replacePlaylistEntries,
  removePlaylistEntry,
  scanLocalLibrary,
  updatePlaylist,
  type TrackListItem,
} from "../desktop";
import type {
  BootstrapState,
  PlaylistsState,
  ScanState,
  ShellState,
  TracksQueryState,
  TracksState,
} from "../types/app";
import {
  existingQueueSnapshot,
  existingSelectedTrackId,
  fetchAllTracks,
  mergeTrackCatalog,
  toImportSummary,
} from "./appShellShared";

export function useShellQueryState() {
  const tracksRequestIdRef = useRef(0);
  const trackCatalogRef = useRef(new Map<string, TrackListItem>());
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
  const [playlistsState, setPlaylistsState] = useState<PlaylistsState>({
    status: "loading",
    items: [],
    activePlaylistId: null,
    activePlaylist: null,
    playbackQueue: null,
  });

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
          playbackQueue: null,
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

  const refreshShellState = () => {
    void getShellState().then((shellPayload) => {
      setShellState((existing) => ({
        libraryRows: shellPayload.libraryRows,
        playback: existing?.playback ?? shellPayload.playback,
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
        if (tracksRequestIdRef.current !== requestId) {
          return;
        }

        mergeTrackCatalog(trackCatalogRef.current, libraryPage.items);
        setTracksState({
          status: "ready",
          items: libraryPage.items,
          total: libraryPage.total,
          selectedTrackId: existingSelectedTrackId(
            libraryPage.items,
            tracksState.selectedTrackId,
          ),
        });
        setTracksQueryState((existing) => ({
          ...existing,
          ...overrides,
        }));
      })
      .catch((error: unknown) => {
        if (tracksRequestIdRef.current !== requestId) {
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
          playbackQueue: existingQueueSnapshot(playlistsState),
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
          playbackQueue: existingQueueSnapshot(playlistsState),
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

  const handlePlaylistCreate = async (
    name: string,
    description?: string | null,
    artworkPath?: string | null,
  ) => {
    try {
      const playlist = await createPlaylist(
        name,
        description?.trim() ? description.trim() : null,
        artworkPath,
      );
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
    artworkPath?: string | null,
  ) => {
    void updatePlaylist(
      playlistId,
      name,
      description?.trim() ? description.trim() : null,
      artworkPath ?? null,
    )
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

  const handlePlaylistArtworkChange = (playlistId: string, artworkPath: string) => {
    const playlistSummary = playlistsState.items.find((item) => item.id === playlistId);
    if (!playlistSummary) {
      return;
    }

    void updatePlaylist(
      playlistId,
      playlistSummary.name,
      playlistSummary.description ?? null,
      artworkPath,
    )
      .then((playlist) => {
        refreshPlaylists(playlist.id);
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to update playlist artwork.",
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
          playbackQueue: existing.playbackQueue,
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

  const handlePlaylistEntryMove = (
    playlistId: string,
    entryId: string,
    targetPosition: number,
  ) => {
    void movePlaylistEntry(playlistId, entryId, targetPosition)
      .then((detail) => {
        setPlaylistsState((existing) => ({
          status: "ready",
          items: existing.items.map((item) =>
            item.id === detail.playlist.id ? detail.playlist : item,
          ),
          activePlaylistId: detail.playlist.id,
          activePlaylist: detail,
          playbackQueue: existing.playbackQueue,
        }));
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to reorder playlist.",
        }));
      });
  };

  const handlePlaylistEntriesReplace = (
    playlistId: string,
    entries: Array<{ entryId?: string; trackId: string; position: number }>,
  ) => {
    void replacePlaylistEntries(playlistId, entries)
      .then((detail) => {
        setPlaylistsState((existing) => ({
          status: "ready",
          items: existing.items.map((item) =>
            item.id === detail.playlist.id ? detail.playlist : item,
          ),
          activePlaylistId: detail.playlist.id,
          activePlaylist: detail,
          playbackQueue: existing.playbackQueue,
        }));
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to reorder playlist.",
        }));
      });
  };

  const handlePlaylistEntryRemove = (playlistId: string, entryId: string) => {
    void removePlaylistEntry(playlistId, entryId)
      .then((detail) => {
        setPlaylistsState((existing) => ({
          status: "ready",
          items: existing.items.map((item) =>
            item.id === detail.playlist.id ? detail.playlist : item,
          ),
          activePlaylistId: detail.playlist.id,
          activePlaylist: detail,
          playbackQueue: existing.playbackQueue,
        }));
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to remove playlist entry.",
        }));
      });
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

  return {
    bootstrapState,
    playlistsState,
    shellState,
    tracksState,
    tracksQueryState,
    libraryPath,
    scanState,
    trackCatalogRef,
    setShellState,
    setTracksState,
    setPlaylistsState,
    handlePickLibraryDirectory,
    handlePlaylistCreate,
    handlePlaylistDelete,
    handlePlaylistArtworkChange,
    handlePlaylistEntryMove,
    handlePlaylistEntriesReplace,
    handlePlaylistEntryRemove,
    handlePlaylistRename,
    handlePlaylistSelection,
    handlePlaylistTrackAdd,
    handleScan,
    handleTracksSearchDraftChange,
    handleTracksSearchSubmit,
    handleTracksTitleHeaderSort,
    handleTracksAlbumHeaderSort,
  };
}
