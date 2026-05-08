import { usePlaybackCoordinator } from "./usePlaybackCoordinator";
import { useShellQueryState } from "./useShellQueryState";
import { getAlbum } from "../desktop";
import type { AlbumDetail, TrackListItem } from "../desktop";

export function useAppShell() {
  const shellQueryState = useShellQueryState();
  const playbackCoordinator = usePlaybackCoordinator({
    shellState: shellQueryState.shellState,
    tracksState: shellQueryState.tracksState,
    playlistsState: shellQueryState.playlistsState,
    conceptAlbumsState: shellQueryState.conceptAlbumsState,
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
    conceptAlbumsState: shellQueryState.conceptAlbumsState,
    playlistsState: shellQueryState.playlistsState,
    queueState: playbackCoordinator.queueState,
    shellState: shellQueryState.shellState,
    tracksState: shellQueryState.tracksState,
    libraryPath: shellQueryState.libraryPath,
    scanState: shellQueryState.scanState,
    handlePickLibraryDirectory: shellQueryState.handlePickLibraryDirectory,
    handleAlbumSelection: shellQueryState.handleAlbumSelection,
    handleConceptAlbumCreate: shellQueryState.handleConceptAlbumCreate,
    handleConceptAlbumDelete: shellQueryState.handleConceptAlbumDelete,
    handleConceptAlbumArtworkChange: shellQueryState.handleConceptAlbumArtworkChange,
    handleConceptAlbumEntryMove: shellQueryState.handleConceptAlbumEntryMove,
    handleConceptAlbumEntriesReplace: shellQueryState.handleConceptAlbumEntriesReplace,
    handleConceptAlbumEntryRemove: shellQueryState.handleConceptAlbumEntryRemove,
    handleConceptAlbumRename: shellQueryState.handleConceptAlbumRename,
    handleConceptAlbumSelection: shellQueryState.handleConceptAlbumSelection,
    handleConceptAlbumTrackAdd: shellQueryState.handleConceptAlbumTrackAdd,
    handlePlaylistCreate: shellQueryState.handlePlaylistCreate,
    handlePlaylistDelete: shellQueryState.handlePlaylistDelete,
    handlePlaylistArtworkChange: shellQueryState.handlePlaylistArtworkChange,
    handlePlaylistEntryMove: shellQueryState.handlePlaylistEntryMove,
    handlePlaylistEntriesReplace: shellQueryState.handlePlaylistEntriesReplace,
    handlePlaylistEntryRemove: shellQueryState.handlePlaylistEntryRemove,
    handlePlaylistPlaybackHandoff: playbackCoordinator.handlePlaylistPlaybackHandoff,
    handlePlaylistRename: shellQueryState.handlePlaylistRename,
    handlePlaylistSelection: shellQueryState.handlePlaylistSelection,
    handlePlaylistTurnToMixtape: shellQueryState.handlePlaylistTurnToMixtape,
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
    handlePlayAlbumById: async (albumId: string) => {
      const albumDetail = await getAlbum(albumId);
      if (!albumDetail || albumDetail.tracks.length === 0) return;
      const queueItems = buildAlbumQueueItems(albumDetail);
      playbackCoordinator.handleTrackSelection(queueItems[0], {
        queueTrackIds: queueItems.map((t) => t.id),
        queueItems,
        sourceLabel: "artist-handoff",
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
    handleConceptAlbumPlaybackHandoff: (
      conceptAlbumId: string,
      startEntryId?: string,
    ) => {
      const activeConceptAlbum = shellQueryState.conceptAlbumsState.activeConceptAlbum;
      if (
        !activeConceptAlbum ||
        activeConceptAlbum.conceptAlbum.id !== conceptAlbumId ||
        activeConceptAlbum.entries.length === 0
      ) {
        return;
      }

      const queueItems = activeConceptAlbum.entries.map((entry) => ({
        id: entry.trackId,
        title: entry.title,
        artist: entry.artist ?? activeConceptAlbum.conceptAlbum.artist,
        album: activeConceptAlbum.conceptAlbum.title,
        advisory: entry.advisory ?? null,
        durationSeconds: entry.durationSeconds,
        artworkKey: entry.artworkKey ?? activeConceptAlbum.conceptAlbum.artworkKey,
        relativePath: "",
        extension: entry.extension,
        sourceStatus: "local-only",
        cacheState: "none",
        analysisStatus: "pending",
        indexedAt: "",
      }));
      const selectedEntry =
        activeConceptAlbum.entries.find((entry) => entry.entryId === startEntryId) ??
        activeConceptAlbum.entries[0];
      const selectedTrack =
        queueItems.find((track) => track.id === selectedEntry.trackId) ?? queueItems[0];

      playbackCoordinator.handleTrackSelection(selectedTrack, {
        queueTrackIds: queueItems.map((track) => track.id),
        queueItems,
        sourceLabel: "concept-album-handoff",
      });
    },
    handleScan: shellQueryState.handleScan,
  };
}
