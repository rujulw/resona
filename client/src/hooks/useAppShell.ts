import { useEffect, useState } from "react";

import {
  bootstrapApp,
  getShellState,
  playbackAction,
  queryLibrary,
  scanLocalLibrary,
} from "../desktop";
import type { BootstrapState, ScanState, ShellState, TracksState } from "../types/app";

export function useAppShell() {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>({
    status: "loading",
  });
  const [shellState, setShellState] = useState<ShellState | null>(null);
  const [tracksState, setTracksState] = useState<TracksState>({
    status: "loading",
    items: [],
    total: 0,
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
        });
      })
      .catch((error: unknown) => {
        setTracksState({
          status: "error",
          items: [],
          total: 0,
          message:
            error instanceof Error ? error.message : "Failed to load track library.",
        });
      });
  };

  const handlePlaybackAction = (action: "previous" | "toggle" | "next") => {
    void playbackAction(action).then((playback) => {
      setShellState((existing) => {
        if (!existing) {
          return existing;
        }

        return {
          ...existing,
          playback,
        };
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
    handleScan,
  };
}
