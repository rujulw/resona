import { useEffect, useRef, useState } from "react";

import {
  bootstrapApp,
  getShellState,
  pickLibraryDirectory,
  playbackAction,
  queryLibrary,
  resolveTrackPlaybackSource,
  scanLocalLibrary,
  type TrackListItem,
} from "../desktop";
import type {
  BootstrapState,
  ImportSummary,
  QueueState,
  ScanState,
  ShellState,
  TracksQueryState,
  TracksState,
} from "../types/app";

export function useAppShell() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
    ])
      .then(([payload, shellPayload, libraryPage]) => {
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
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const syncPlayback = (update: (existing: NonNullable<ShellState["playback"]>) => NonNullable<ShellState["playback"]>) => {
      setShellState((existing) => {
        if (!existing) {
          return existing;
        }

        return {
          ...existing,
          playback: update(existing.playback),
        };
      });
    };

    const handleLoadedMetadata = () => {
      syncPlayback((existing) => ({
        ...existing,
        durationSeconds: Number.isFinite(audio.duration) ? Math.round(audio.duration) : existing.durationSeconds,
      }));
    };

    const handleTimeUpdate = () => {
      syncPlayback((existing) => ({
        ...existing,
        progressSeconds: Math.round(audio.currentTime),
        durationSeconds:
          Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.round(audio.duration)
            : existing.durationSeconds,
      }));
    };

    const handlePlay = () => {
      syncPlayback((existing) => ({
        ...existing,
        statusLabel: "Playing",
        transportLabel: "Playing",
        isPlaying: true,
      }));
    };

    const handlePause = () => {
      if (audio.ended) {
        return;
      }

      syncPlayback((existing) => ({
        ...existing,
        statusLabel: existing.trackTitle ? "Paused" : existing.statusLabel,
        transportLabel: existing.trackTitle ? "Paused" : existing.transportLabel,
        isPlaying: false,
      }));
    };

    const handleEnded = () => {
      syncPlayback((existing) => ({
        ...existing,
        statusLabel: existing.trackTitle ? "Ended" : existing.statusLabel,
        transportLabel: existing.trackTitle ? "Ended" : existing.transportLabel,
        progressSeconds: existing.durationSeconds,
        isPlaying: false,
      }));
    };

    const handleError = () => {
      syncPlayback((existing) => ({
        ...existing,
        statusLabel: existing.trackTitle ? "Error" : existing.statusLabel,
        transportLabel: "Playback error",
        isPlaying: false,
      }));
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      try {
        audio.pause();
      } catch {
        // jsdom does not implement media teardown fully, but the browser/webview does.
      }
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audioRef.current = null;
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
        ? tracksState.items.findIndex((item) => item.id === activeTrackId)
        : -1;

      if (action === "previous" && audio && audio.currentTime > 3 && activeIndex >= 0) {
        audio.currentTime = 0;
        setShellState((existing) => {
          if (!existing) {
            return existing;
          }

          return {
            ...existing,
            playback: {
              ...existing.playback,
              progressSeconds: 0,
              transportLabel: existing.playback.isPlaying ? "Playing" : "Restarted",
            },
          };
        });
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
      const targetTrack = targetIndex >= 0 ? tracksState.items[targetIndex] : undefined;

      if (targetTrack) {
        startTrackPlayback(targetTrack, true);
        return;
      }
    }

    if (action === "toggle") {
      if (audio && shellState?.playback.trackId && audio.src) {
        if (audio.paused) {
          void audio
            .play()
            .then(() => {
              setShellState((existing) => {
                if (!existing) {
                  return existing;
                }

                return {
                  ...existing,
                  playback: {
                    ...existing.playback,
                    statusLabel: "Playing",
                    transportLabel: "Playing",
                    isPlaying: true,
                  },
                };
              });
            })
            .catch(() => {
              setShellState((existing) => {
                if (!existing) {
                  return existing;
                }

                return {
                  ...existing,
                  playback: {
                    ...existing.playback,
                    statusLabel: "Error",
                    transportLabel: "Playback blocked",
                    isPlaying: false,
                  },
                };
              });
            });
        } else {
          audio.pause();
          setShellState((existing) => {
            if (!existing) {
              return existing;
            }

            return {
              ...existing,
              playback: {
                ...existing.playback,
                statusLabel: "Paused",
                transportLabel: "Paused",
                isPlaying: false,
              },
            };
          });
        }

        return;
      }

      if (!shellState?.playback.trackId && tracksState.items.length > 0) {
        startTrackPlayback(tracksState.items[0], true);
        return;
      }
    }

    void playbackAction(action).then((playback) => {
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
          },
        };
      });
    });
  };

  const handleTrackSelection = (track: TrackListItem) => {
    startTrackPlayback(track, true);
  };

  const startTrackPlayback = (track: TrackListItem, autoplay: boolean) => {
    setTracksState((existing) => ({
      ...existing,
      selectedTrackId: track.id,
    }));

    setShellState((existing) => {
      if (!existing) {
        return existing;
      }

      return {
        ...existing,
        playback: {
          ...existing.playback,
          statusLabel: "Loading",
          transportLabel: "Loading source",
          progressSeconds: 0,
          durationSeconds: Math.round(track.durationSeconds ?? 0),
          isPlaying: false,
          trackId: track.id,
          trackTitle: track.title,
          trackArtist: track.artist,
          trackAlbum: track.album,
        },
      };
    });

    void resolveTrackPlaybackSource(track.id).then((source) => {
      if (!source) {
        setShellState((existing) => {
          if (!existing || existing.playback.trackId !== track.id) {
            return existing;
          }

          return {
            ...existing,
            playback: {
              ...existing.playback,
              statusLabel: "Unavailable",
              transportLabel: "Local source unavailable",
            },
          };
        });
        return;
      }

      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      audio.src = source.assetUrl;
      audio.currentTime = 0;

      if (!autoplay) {
        setShellState((existing) => {
          if (!existing || existing.playback.trackId !== track.id) {
            return existing;
          }

          return {
            ...existing,
            playback: {
              ...existing.playback,
              statusLabel: "Ready",
              transportLabel: "Ready",
              isPlaying: false,
            },
          };
        });
        return;
      }

      void audio
        .play()
        .then(() => {
          setShellState((existing) => {
            if (!existing || existing.playback.trackId !== track.id) {
              return existing;
            }

            return {
              ...existing,
              playback: {
                ...existing.playback,
                statusLabel: "Playing",
                transportLabel: "Playing",
                isPlaying: true,
              },
            };
          });
        })
        .catch(() => {
          setShellState((existing) => {
            if (!existing || existing.playback.trackId !== track.id) {
              return existing;
            }

            return {
              ...existing,
              playback: {
                ...existing.playback,
                statusLabel: "Ready",
                transportLabel: "Tap play to start",
                isPlaying: false,
              },
            };
          });
        });
    });
  };

  const handleScan = () => {
    const trimmedPath = libraryPath.trim();
    if (!trimmedPath) {
      setScanState({
        status: "error",
        message: "Enter a local folder path for this temporary scaffold.",
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
              : `Scan finished for ${summary.libraryRootName}, but no MP3 files were found.`,
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
    tracksState.items,
    shellState?.playback.trackId ?? tracksState.selectedTrackId,
  );

  return {
    bootstrapState,
    queueState,
    shellState,
    tracksState,
    tracksQueryState,
    libraryPath,
    scanState,
    setLibraryPath,
    handlePickLibraryDirectory,
    handlePlaybackAction,
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
  items: TrackListItem[],
  activeTrackId: string | null | undefined,
): QueueState {
  if (!activeTrackId) {
    return {
      activeTrack: null,
      upcomingTracks: [],
      totalTracks: 0,
    };
  }

  const activeIndex = items.findIndex((item) => item.id === activeTrackId);
  if (activeIndex < 0) {
    return {
      activeTrack: null,
      upcomingTracks: [],
      totalTracks: 0,
    };
  }

  return {
    activeTrack: items[activeIndex],
    upcomingTracks: items.slice(activeIndex + 1),
    totalTracks: items.length - activeIndex,
  };
}
