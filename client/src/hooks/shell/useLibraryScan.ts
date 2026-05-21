import { useState } from "react";

import { pickLibraryDirectory, scanLocalLibrary } from "../../desktop";
import type { ScanState, TracksQueryState } from "../../types/app";
import { toImportSummary } from "../appShellShared";
import { toAsyncErrorMessage } from "./shellQueryShared";

type UseLibraryScanArgs = {
  refreshShellState: () => void;
  refreshTracks: (overrides?: Partial<TracksQueryState>) => void;
};

export function useLibraryScan({
  refreshShellState,
  refreshTracks,
}: UseLibraryScanArgs) {
  const [libraryPath, setLibraryPath] = useState("");
  const [scanState, setScanState] = useState<ScanState>({
    status: "idle",
    message: "",
    lastScan: null,
  });

  const handleScan = () => {
    const trimmedPath = libraryPath.trim();
    if (!trimmedPath) {
      setScanState((existing) => ({
        status: "error",
        message: "Choose a folder before scanning your library.",
        lastScan: existing.lastScan,
      }));
      return;
    }

    setScanState((existing) => ({
      status: "running",
      message: "Scanning local library...",
      lastScan: existing.lastScan,
    }));

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
        setScanState((existing) => ({
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to scan local library."),
          lastScan: existing.lastScan,
        }));
      });
  };

  const handlePickLibraryDirectory = () => {
    void pickLibraryDirectory(libraryPath)
      .then((selectedPath) => {
        if (!selectedPath) {
          return;
        }

        setLibraryPath(selectedPath);
        setScanState((existing) => ({
          status: "idle",
          message: `Selected ${selectedPath}.`,
          lastScan: existing.lastScan,
        }));
      })
      .catch((error: unknown) => {
        setScanState((existing) => ({
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to open folder picker."),
          lastScan: existing.lastScan,
        }));
      });
  };

  return {
    libraryPath,
    scanState,
    handlePickLibraryDirectory,
    handleScan,
  };
}
