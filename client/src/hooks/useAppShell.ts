import { usePlaybackCoordinator } from "./usePlaybackCoordinator";
import { useShellQueryState } from "./useShellQueryState";
import type { AlbumDetail, TrackListItem } from "../desktop";

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

  const buildAlbumQueueItems = (albumDetail: AlbumDetail): TrackListItem[] =>
    albumDetail.tracks.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist ?? albumDetail.album.artist,
      album: albumDetail.album.title,
      advisory: track.advisory ?? null,
      durationSeconds: track.durationSeconds,
      artworkKey: track.artworkKey ?? albumDetail.album.artworkKey,
      relativePath: "",
      extension: track.extension,
      sourceStatus: "local-only",
      cacheState: "none",
      analysisStatus: "pending",
      indexedAt: "",
    }));

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
    handleAlbumPlaybackHandoff: (albumId: string, startTrackId?: string) => {
      const activeAlbum = shellQueryState.albumsState.activeAlbum;
      if (!activeAlbum || activeAlbum.album.id !== albumId || activeAlbum.tracks.length === 0) {
        return;
      }

      const queueItems = buildAlbumQueueItems(activeAlbum);
      const selectedTrack =
        queueItems.find((track) => track.id === startTrackId) ?? queueItems[0];

      playbackCoordinator.handleTrackSelection(selectedTrack, {
        queueTrackIds: queueItems.map((track) => track.id),
        queueItems,
        sourceLabel: "album-handoff",
      });
    },
    handleAlbumTrackSelection: (trackId: string) => {
      const activeAlbum = shellQueryState.albumsState.activeAlbum;
      if (!activeAlbum) {
        return;
      }

      const queueItems = buildAlbumQueueItems(activeAlbum);
      const track = queueItems.find((item) => item.id === trackId);
      if (track) {
        playbackCoordinator.handleTrackSelection(track, {
          queueTrackIds: queueItems.map((item) => item.id),
          queueItems,
          sourceLabel: "album-handoff",
        });
      }
    },
    handleScan: shellQueryState.handleScan,
    handleTracksSearchDraftChange: shellQueryState.handleTracksSearchDraftChange,
    handleTracksSearchSubmit: shellQueryState.handleTracksSearchSubmit,
    handleTracksTitleHeaderSort: shellQueryState.handleTracksTitleHeaderSort,
    handleTracksAlbumHeaderSort: shellQueryState.handleTracksAlbumHeaderSort,
  };
}
