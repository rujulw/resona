import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import type {
  AppShellViewModel,
} from "../../types/app";
import { PlaybackBar } from "./PlaybackBar";
import { Sidebar } from "./Sidebar";
import { HomePage } from "../../pages/HomePage";
import { PlaylistsPage } from "../../pages/PlaylistsPage";
import { QueuePage } from "../../pages/QueuePage";
import { SettingsPage } from "../../pages/SettingsPage";
import { TracksPage } from "../../pages/TracksPage";

export function AppShell({ chrome, routes, actions, playback }: AppShellViewModel) {
  return (
    <BrowserRouter>
      <main className="grid h-screen grid-cols-[248px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-[#121212] text-[#e5e5e5]">
        <Sidebar
          appName={chrome.appName}
          playlists={chrome.playlists}
          runtimeLabel={chrome.runtimeLabel}
        />

        <section className="min-h-0 min-w-0 overflow-hidden bg-[#121212]">
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
                  onTrackSelect={actions.tracks.onTrackSelect}
                  onTracksSearchDraftChange={actions.tracks.onTracksSearchDraftChange}
                  onTracksSearchSubmit={actions.tracks.onTracksSearchSubmit}
                  onTracksTitleHeaderSort={actions.tracks.onTracksTitleHeaderSort}
                  onTracksAlbumHeaderSort={actions.tracks.onTracksAlbumHeaderSort}
                />
              }
            />
            <Route
              path="/playlists"
              element={
                <PlaylistsPage
                  playlistsState={routes.playlists.playlistsState}
                  tracksState={routes.playlists.tracksState}
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
        </section>

        <PlaybackBar
          activeTrack={chrome.queueState.activeTrack}
          playback={chrome.playback}
          onPlaybackAction={playback.onPlaybackAction}
          onSeek={playback.onPlaybackSeek}
        />
      </main>
    </BrowserRouter>
  );
}
