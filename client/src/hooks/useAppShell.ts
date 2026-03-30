import { useEffect, useRef, useState } from "react";

import {
  bootstrapApp,
  getShellState,
  playbackAction,
  queryLibrary,
  resolveTrackPlaybackSource,
  scanLocalLibrary,
  type TrackListItem,
} from "../desktop";
import type { BootstrapState, ScanState, ShellState, TracksState } from "../types/app";

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
  });

  useEffect(() => {
    let cancelled = false;

    void Promise.all([bootstrapApp(), getShellState(), queryLibrary({ pageSize: 200 })])
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
      }));
    };

    const handleEnded = () => {
      syncPlayback((existing) => ({
        ...existing,
        statusLabel: existing.trackTitle ? "Ended" : existing.statusLabel,
        transportLabel: existing.trackTitle ? "Ended" : existing.transportLabel,
        progressSeconds: existing.durationSeconds,
      }));
    };

    const handleError = () => {
      syncPlayback((existing) => ({
        ...existing,
        statusLabel: existing.trackTitle ? "Error" : existing.statusLabel,
        transportLabel: "Playback error",
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

  const refreshTracks = () => {
    setTracksState((existing) => ({
      ...existing,
      status: "loading",
    }));

    void queryLibrary({ pageSize: 200 })
      .then((libraryPage) => {
        setTracksState({
          status: "ready",
          items: libraryPage.items,
          total: libraryPage.total,
          selectedTrackId:
            existingSelectedTrackId(libraryPage.items, tracksState.selectedTrackId),
        });
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
      });
  };

  const handlePlaybackAction = (action: "previous" | "toggle" | "next") => {
    if (action === "toggle") {
      const audio = audioRef.current;
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
              },
            };
          });
        }

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
      });
      return;
    }

    setScanState({
      status: "running",
      message: "Scanning local library...",
    });

    void scanLocalLibrary(trimmedPath)
      .then((summary) => {
        setScanState({
          status: "success",
          message: `Indexed ${summary.discoveredTracks} track(s) from ${summary.libraryRootName}.`,
        });
        refreshShellState();
        refreshTracks();
      })
      .catch((error: unknown) => {
        setScanState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to scan local library.",
        });
      });
  };

  return {
    bootstrapState,
    shellState,
    tracksState,
    libraryPath,
    scanState,
    setLibraryPath,
    handlePlaybackAction,
    handleTrackSelection,
    handleScan,
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
