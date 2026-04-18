import { usePlaybackCoordinator } from "./usePlaybackCoordinator";
import { useShellQueryState } from "./useShellQueryState";

export function useAppShell() {
  const shellQueryState = useShellQueryState();
  const playbackCoordinator = usePlaybackCoordinator({
    shellState: shellQueryState.shellState,
    tracksState: shellQueryState.tracksState,
    playlistsState: shellQueryState.playlistsState,
    trackCatalogRef: shellQueryState.trackCatalogRef,
    setShellState: shellQueryState.setShellState,
    setTracksState: shellQueryState.setTracksState,
    setPlaylistsState: shellQueryState.setPlaylistsState,
  });

  return {
    bootstrapState: shellQueryState.bootstrapState,
    albumsState: shellQueryState.albumsState,
    playlistsState: shellQueryState.playlistsState,
    queueState: playbackCoordinator.queueState,
    shellState: shellQueryState.shellState,
    tracksState: shellQueryState.tracksState,
    tracksQueryState: shellQueryState.tracksQueryState,
    libraryPath: shellQueryState.libraryPath,
    scanState: shellQueryState.scanState,
    handlePickLibraryDirectory: shellQueryState.handlePickLibraryDirectory,
    handleAlbumSelection: shellQueryState.handleAlbumSelection,
    handlePlaylistCreate: shellQueryState.handlePlaylistCreate,
    handlePlaylistDelete: shellQueryState.handlePlaylistDelete,
    handlePlaylistArtworkChange: shellQueryState.handlePlaylistArtworkChange,
    handlePlaylistEntryMove: shellQueryState.handlePlaylistEntryMove,
    handlePlaylistEntriesReplace: shellQueryState.handlePlaylistEntriesReplace,
    handlePlaylistEntryRemove: shellQueryState.handlePlaylistEntryRemove,
    handlePlaylistPlaybackHandoff: playbackCoordinator.handlePlaylistPlaybackHandoff,
    handlePlaylistRename: shellQueryState.handlePlaylistRename,
    handlePlaylistSelection: shellQueryState.handlePlaylistSelection,
    handlePlaylistTrackAdd: shellQueryState.handlePlaylistTrackAdd,
    handlePlaybackAction: playbackCoordinator.handlePlaybackAction,
    handlePlaybackSeek: playbackCoordinator.handlePlaybackSeek,
    handleTrackSelection: playbackCoordinator.handleTrackSelection,
    handleAlbumTrackSelection: (trackId: string) => {
      const track = shellQueryState.trackCatalogRef.current.get(trackId);
      if (track) {
        playbackCoordinator.handleTrackSelection(track);
      }
    },
    handleScan: shellQueryState.handleScan,
    handleTracksSearchDraftChange: shellQueryState.handleTracksSearchDraftChange,
    handleTracksSearchSubmit: shellQueryState.handleTracksSearchSubmit,
    handleTracksTitleHeaderSort: shellQueryState.handleTracksTitleHeaderSort,
    handleTracksAlbumHeaderSort: shellQueryState.handleTracksAlbumHeaderSort,
  };
}
