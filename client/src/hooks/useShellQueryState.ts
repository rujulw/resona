import { useEffect, useRef, useState } from "react";

import { bootstrapApp, getShellState, type TrackListItem } from "../desktop";
import type { BootstrapState, ShellState } from "../types/app";
import { useLibraryScan } from "./shell/useLibraryScan";
import { usePlaylistQueries } from "./shell/usePlaylistQueries";
import { useTracksQuery } from "./shell/useTracksQuery";
import { toAsyncErrorMessage } from "./shell/shellQueryShared";

export function useShellQueryState() {
  const trackCatalogRef = useRef(new Map<string, TrackListItem>());
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>({
    status: "loading",
  });
  const [shellState, setShellState] = useState<ShellState | null>(null);

  const {
    tracksState,
    setTracksState,
    tracksQueryState,
    setTracksQueryState,
    refreshTracks,
    handleTracksSearchDraftChange,
    handleTracksSearchSubmit,
    handleTracksTitleHeaderSort,
    handleTracksAlbumHeaderSort,
  } = useTracksQuery({
    trackCatalogRef,
  });

  const {
    playlistsState,
    setPlaylistsState,
    refreshPlaylists,
    handlePlaylistSelection,
    handlePlaylistCreate,
    handlePlaylistRename,
    handlePlaylistArtworkChange,
    handlePlaylistDelete,
    handlePlaylistTrackAdd,
    handlePlaylistEntryMove,
    handlePlaylistEntriesReplace,
    handlePlaylistEntryRemove,
  } = usePlaylistQueries();

  const refreshShellState = () => {
    void getShellState().then((shellPayload) => {
      setShellState((existing) => ({
        libraryRows: shellPayload.libraryRows,
        playback: existing?.playback ?? shellPayload.playback,
      }));
    });
  };

  const { libraryPath, scanState, handlePickLibraryDirectory, handleScan } = useLibraryScan({
    refreshShellState,
    refreshTracks,
  });

  useEffect(() => {
    let cancelled = false;

    void Promise.all([bootstrapApp(), getShellState()])
      .then(([payload, shellPayload]) => {
        if (cancelled) {
          return;
        }

        document.title = payload.windowTitle;
        setBootstrapState({ status: "ready", payload });
        setShellState({
          libraryRows: shellPayload.libraryRows,
          playback: shellPayload.playback,
        });
        refreshTracks({
          search: "",
          sortKey: "title",
          sortDirection: "asc",
        });
        refreshPlaylists();
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        const message = toAsyncErrorMessage(error, "Failed to bootstrap app");
        setBootstrapState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
    setTracksQueryState,
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
