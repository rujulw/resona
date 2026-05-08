import { useEffect, useRef, useState } from "react";

import { bootstrapApp, getShellState, type TrackListItem } from "../desktop";
import type { BootstrapState, ShellState } from "../types/app";
import { useLibraryScan } from "./shell/useLibraryScan";
import { useAlbumQueries } from "./shell/useAlbumQueries";
import { useConceptAlbumQueries } from "./shell/useConceptAlbumQueries";
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
    refreshTracks,
  } = useTracksQuery({
    trackCatalogRef,
  });

  const {
    albumsState,
    setAlbumsState,
    refreshAlbums,
    handleAlbumSelection,
  } = useAlbumQueries();

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
    handlePlaylistTurnToMixtape,
  } = usePlaylistQueries();

  const {
    conceptAlbumsState,
    setConceptAlbumsState,
    refreshConceptAlbums,
    handleConceptAlbumSelection,
    handleConceptAlbumCreate,
    handleConceptAlbumRename,
    handleConceptAlbumArtworkChange,
    handleConceptAlbumDelete,
    handleConceptAlbumTrackAdd,
    handleConceptAlbumEntryMove,
    handleConceptAlbumEntriesReplace,
    handleConceptAlbumEntryRemove,
  } = useConceptAlbumQueries();

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
    refreshTracks: (...args) => {
      refreshTracks(...args);
      refreshAlbums();
      refreshConceptAlbums();
    },
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
        refreshAlbums();
        refreshPlaylists();
        refreshConceptAlbums();
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
    albumsState,
    conceptAlbumsState,
    playlistsState,
    shellState,
    tracksState,
    libraryPath,
    scanState,
    trackCatalogRef,
    setShellState,
    setTracksState,
    setPlaylistsState,
    setAlbumsState,
    setConceptAlbumsState,
    handlePickLibraryDirectory,
    handleAlbumSelection,
    handleConceptAlbumSelection,
    handleConceptAlbumCreate,
    handleConceptAlbumDelete,
    handleConceptAlbumArtworkChange,
    handleConceptAlbumEntryMove,
    handleConceptAlbumEntriesReplace,
    handleConceptAlbumEntryRemove,
    handleConceptAlbumRename,
    handleConceptAlbumTrackAdd,
    handlePlaylistCreate,
    handlePlaylistDelete,
    handlePlaylistArtworkChange,
    handlePlaylistEntryMove,
    handlePlaylistEntriesReplace,
    handlePlaylistEntryRemove,
    handlePlaylistRename,
    handlePlaylistSelection,
    handlePlaylistTurnToMixtape,
    handlePlaylistTrackAdd,
    handleScan,
  };
}
