import { Navigate, Route, Routes } from "react-router-dom";

import type { AppShellRouteActions, AppShellRoutesState } from "../../types/app";
import { AlbumsPage } from "../../pages/AlbumsPage";
import { HomePage } from "../../pages/HomePage";
import { PlaylistsPage } from "../../pages/PlaylistsPage";
import { QueuePage } from "../../pages/QueuePage";
import { SettingsPage } from "../../pages/SettingsPage";
import { TracksPage } from "../../pages/TracksPage";

export function AppShellRoutes({
  routes,
  actions,
}: {
  routes: AppShellRoutesState;
  actions: AppShellRouteActions;
}) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route
        path="/home"
        element={
          <HomePage
            libraryRows={routes.home.libraryRows}
            trackCount={routes.home.trackCount}
            appVersion={routes.home.appVersion}
          />
        }
      />
      <Route
        path="/tracks"
        element={
          <TracksPage
            libraryPath={routes.tracks.libraryPath}
            scanState={routes.tracks.scanState}
            tracksQueryState={routes.tracks.tracksQueryState}
            tracksState={routes.tracks.tracksState}
            albumsState={routes.tracks.albumsState}
            onTrackSelect={actions.tracks.onTrackSelect}
            onTracksSearchDraftChange={actions.tracks.onTracksSearchDraftChange}
            onTracksSearchSubmit={actions.tracks.onTracksSearchSubmit}
            onTracksTitleHeaderSort={actions.tracks.onTracksTitleHeaderSort}
            onTracksAlbumHeaderSort={actions.tracks.onTracksAlbumHeaderSort}
          />
        }
      />
      <Route
        path="/albums"
        element={
          <AlbumsPage
            albumsState={routes.albums.albumsState}
            tracksState={routes.tracks.tracksState}
            onAlbumSelect={actions.albums.onAlbumSelect}
            onPlayAlbum={actions.albums.onAlbumPlaybackHandoff}
            onAlbumTrackSelect={actions.albums.onAlbumTrackSelect}
          />
        }
      />
      <Route
        path="/albums/:albumId"
        element={
          <AlbumsPage
            albumsState={routes.albums.albumsState}
            tracksState={routes.tracks.tracksState}
            onAlbumSelect={actions.albums.onAlbumSelect}
            onPlayAlbum={actions.albums.onAlbumPlaybackHandoff}
            onAlbumTrackSelect={actions.albums.onAlbumTrackSelect}
          />
        }
      />
      <Route
        path="/playlists"
        element={
          <PlaylistsPage
            playlistsState={routes.playlists.playlistsState}
            tracksState={routes.playlists.tracksState}
            albumsState={routes.playlists.albumsState}
            onCreatePlaylist={actions.playlists.onCreatePlaylist}
            onPlaylistArtworkChange={actions.playlists.onPlaylistArtworkChange}
            onPlaylistDelete={actions.playlists.onPlaylistDelete}
            onPlaylistEntryMove={actions.playlists.onPlaylistEntryMove}
            onPlaylistEntriesReplace={actions.playlists.onPlaylistEntriesReplace}
            onPlaylistEntryRemove={actions.playlists.onPlaylistEntryRemove}
            onPlaylistPlaybackHandoff={actions.playlists.onPlaylistPlaybackHandoff}
            onPlaylistRename={actions.playlists.onPlaylistRename}
            onPlaylistSelect={actions.playlists.onPlaylistSelect}
            onTrackAdd={actions.playlists.onTrackAdd}
          />
        }
      />
      <Route
        path="/playlists/:playlistId"
        element={
          <PlaylistsPage
            playlistsState={routes.playlists.playlistsState}
            tracksState={routes.playlists.tracksState}
            albumsState={routes.playlists.albumsState}
            onCreatePlaylist={actions.playlists.onCreatePlaylist}
            onPlaylistArtworkChange={actions.playlists.onPlaylistArtworkChange}
            onPlaylistDelete={actions.playlists.onPlaylistDelete}
            onPlaylistEntryMove={actions.playlists.onPlaylistEntryMove}
            onPlaylistEntriesReplace={actions.playlists.onPlaylistEntriesReplace}
            onPlaylistEntryRemove={actions.playlists.onPlaylistEntryRemove}
            onPlaylistPlaybackHandoff={actions.playlists.onPlaylistPlaybackHandoff}
            onPlaylistRename={actions.playlists.onPlaylistRename}
            onPlaylistSelect={actions.playlists.onPlaylistSelect}
            onTrackAdd={actions.playlists.onTrackAdd}
          />
        }
      />
      <Route path="/queue" element={<QueuePage queueState={routes.queue.queueState} />} />
      <Route
        path="/settings"
        element={
          <SettingsPage
            libraryRows={routes.settings.libraryRows}
            libraryPath={routes.settings.libraryPath}
            platformLabel={routes.settings.platformLabel}
            appVersion={routes.settings.appVersion}
            scanState={routes.settings.scanState}
            onPickLibraryDirectory={actions.settings.onPickLibraryDirectory}
            onScan={actions.settings.onScan}
          />
        }
      />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
