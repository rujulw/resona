import { Navigate, Route, Routes } from "react-router-dom";

import type { AppShellRouteActions, AppShellRoutesState } from "../../types/app";
import { AlbumsPage } from "../../pages/AlbumsPage";
import { ArtistPage } from "../../pages/ArtistPage";
import { ConceptAlbumsPage } from "../../pages/ConceptAlbumsPage";
import { HomePage } from "../../pages/HomePage";
import { PlaylistsPage } from "../../pages/PlaylistsPage";
import { QueuePage } from "../../pages/QueuePage";
import { ScoresPage } from "../../pages/ScoresPage";
import { SettingsPage } from "../../pages/SettingsPage";

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
            tracksState={routes.home.tracksState}
            albumsState={routes.home.albumsState}
            playlistsState={routes.home.playlistsState}
            conceptAlbumsState={routes.home.conceptAlbumsState}
            onTrackSelect={actions.home.onTrackSelect}
          />
        }
      />
      <Route
        path="/albums"
        element={
          <AlbumsPage
            albumsState={routes.albums.albumsState}
            tracksState={routes.albums.tracksState}
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
            tracksState={routes.albums.tracksState}
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
            onPlaylistTurnToMixtape={actions.playlists.onPlaylistTurnToMixtape}
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
            onPlaylistTurnToMixtape={actions.playlists.onPlaylistTurnToMixtape}
            onTrackAdd={actions.playlists.onTrackAdd}
          />
        }
      />
      <Route
        path="/concept-albums"
        element={
          <ConceptAlbumsPage
            conceptAlbumsState={routes.conceptAlbums.conceptAlbumsState}
            tracksState={routes.conceptAlbums.tracksState}
            albumsState={routes.conceptAlbums.albumsState}
            onConceptAlbumCreate={actions.conceptAlbums.onConceptAlbumCreate}
            onConceptAlbumArtworkChange={actions.conceptAlbums.onConceptAlbumArtworkChange}
            onConceptAlbumDelete={actions.conceptAlbums.onConceptAlbumDelete}
            onConceptAlbumEntryMove={actions.conceptAlbums.onConceptAlbumEntryMove}
            onConceptAlbumEntriesReplace={actions.conceptAlbums.onConceptAlbumEntriesReplace}
            onConceptAlbumEntryRemove={actions.conceptAlbums.onConceptAlbumEntryRemove}
            onConceptAlbumPlaybackHandoff={
              actions.conceptAlbums.onConceptAlbumPlaybackHandoff
            }
            onConceptAlbumRename={actions.conceptAlbums.onConceptAlbumRename}
            onConceptAlbumSelect={actions.conceptAlbums.onConceptAlbumSelect}
            onConceptAlbumTrackAdd={actions.conceptAlbums.onConceptAlbumTrackAdd}
          />
        }
      />
      <Route
        path="/concept-albums/:conceptAlbumId"
        element={
          <ConceptAlbumsPage
            conceptAlbumsState={routes.conceptAlbums.conceptAlbumsState}
            tracksState={routes.conceptAlbums.tracksState}
            albumsState={routes.conceptAlbums.albumsState}
            onConceptAlbumCreate={actions.conceptAlbums.onConceptAlbumCreate}
            onConceptAlbumArtworkChange={actions.conceptAlbums.onConceptAlbumArtworkChange}
            onConceptAlbumDelete={actions.conceptAlbums.onConceptAlbumDelete}
            onConceptAlbumEntryMove={actions.conceptAlbums.onConceptAlbumEntryMove}
            onConceptAlbumEntriesReplace={actions.conceptAlbums.onConceptAlbumEntriesReplace}
            onConceptAlbumEntryRemove={actions.conceptAlbums.onConceptAlbumEntryRemove}
            onConceptAlbumPlaybackHandoff={
              actions.conceptAlbums.onConceptAlbumPlaybackHandoff
            }
            onConceptAlbumRename={actions.conceptAlbums.onConceptAlbumRename}
            onConceptAlbumSelect={actions.conceptAlbums.onConceptAlbumSelect}
            onConceptAlbumTrackAdd={actions.conceptAlbums.onConceptAlbumTrackAdd}
          />
        }
      />
      <Route path="/player" element={<QueuePage queueState={routes.queue.queueState} />} />
      <Route path="/scores" element={<ScoresPage />} />
      <Route
        path="/settings"
        element={
          <SettingsPage
            libraryPath={routes.settings.libraryPath}
            platformLabel={routes.settings.platformLabel}
            appVersion={routes.settings.appVersion}
            scanState={routes.settings.scanState}
            onPickLibraryDirectory={actions.settings.onPickLibraryDirectory}
            onScan={actions.settings.onScan}
          />
        }
      />
      <Route
        path="/artist/:artistName"
        element={<ArtistPage onPlayAlbum={actions.albums.onPlayAlbumById} />}
      />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
