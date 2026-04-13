import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import type { BootstrapPayload, TrackListItem } from "../../desktop";
import type {
  PlaylistsState,
  QueueState,
  ScanState,
  ShellState,
  TracksQueryState,
  TracksState,
} from "../../types/app";
import { PlaybackBar } from "./PlaybackBar";
import { Sidebar } from "./Sidebar";
import { HomePage } from "../../pages/HomePage";
import { PlaylistsPage } from "../../pages/PlaylistsPage";
import { QueuePage } from "../../pages/QueuePage";
import { SettingsPage } from "../../pages/SettingsPage";
import { TracksPage } from "../../pages/TracksPage";

export function AppShell({
  payload,
  playlistsState,
  queueState,
  shellState,
  tracksState,
  tracksQueryState,
  libraryPath,
  scanState,
  onPickLibraryDirectory,
  onPlaylistCreate,
  onPlaylistArtworkChange,
  onPlaylistDelete,
  onPlaylistEntryMove,
  onPlaylistEntryRemove,
  onPlaylistPlaybackHandoff,
  onPlaylistRename,
  onPlaylistSelect,
  onPlaylistTrackAdd,
  onPlaybackAction,
  onPlaybackSeek,
  onTrackSelect,
  onScan,
  onTracksSearchDraftChange,
  onTracksSearchSubmit,
  onTracksTitleHeaderSort,
  onTracksAlbumHeaderSort,
}: {
  payload: BootstrapPayload;
  playlistsState: PlaylistsState;
  queueState: QueueState;
  shellState: ShellState;
  tracksState: TracksState;
  tracksQueryState: TracksQueryState;
  libraryPath: string;
  scanState: ScanState;
  onPickLibraryDirectory: () => void;
  onPlaylistCreate: (
    name: string,
    description?: string | null,
    artworkPath?: string | null,
  ) => Promise<string | null>;
  onPlaylistArtworkChange: (playlistId: string, artworkPath: string) => void;
  onPlaylistDelete: (playlistId: string) => void;
  onPlaylistEntryMove: (playlistId: string, entryId: string, targetPosition: number) => void;
  onPlaylistEntryRemove: (playlistId: string, entryId: string) => void;
  onPlaylistPlaybackHandoff: (playlistId: string, startEntryId?: string) => void;
  onPlaylistRename: (
    playlistId: string,
    name: string,
    description?: string | null,
    artworkPath?: string | null,
  ) => void;
  onPlaylistSelect: (playlistId: string) => void;
  onPlaylistTrackAdd: (playlistId: string, track: TrackListItem) => void;
  onPlaybackAction: (action: "previous" | "toggle" | "next") => void;
  onPlaybackSeek: (positionSeconds: number) => void;
  onTrackSelect: (track: TrackListItem) => void;
  onScan: () => void;
  onTracksSearchDraftChange: (value: string) => void;
  onTracksSearchSubmit: () => void;
  onTracksTitleHeaderSort: () => void;
  onTracksAlbumHeaderSort: () => void;
}) {
  return (
    <BrowserRouter>
      <main className="grid h-screen grid-cols-[248px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-[#121212] text-[#e5e5e5]">
        <Sidebar
          appName={payload.appName}
          playlists={playlistsState.items}
          runtimeLabel={`${payload.runtime.desktopShell} desktop shell`}
        />

        <section className="min-h-0 min-w-0 overflow-hidden bg-[#121212]">
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route
              path="/home"
              element={
                <HomePage
                  libraryRows={shellState.libraryRows}
                  trackCount={tracksState.total}
                  appVersion={payload.appVersion}
                />
              }
            />
            <Route
              path="/tracks"
              element={
                <TracksPage
                  libraryPath={libraryPath}
                  scanState={scanState}
                  tracksQueryState={tracksQueryState}
                  tracksState={tracksState}
                  onTrackSelect={onTrackSelect}
                  onTracksSearchDraftChange={onTracksSearchDraftChange}
                  onTracksSearchSubmit={onTracksSearchSubmit}
                  onTracksTitleHeaderSort={onTracksTitleHeaderSort}
                  onTracksAlbumHeaderSort={onTracksAlbumHeaderSort}
                />
              }
            />
            <Route
              path="/playlists"
              element={
                <PlaylistsPage
                  playlistsState={playlistsState}
                  tracksState={tracksState}
                  onCreatePlaylist={onPlaylistCreate}
                  onPlaylistArtworkChange={onPlaylistArtworkChange}
                  onPlaylistDelete={onPlaylistDelete}
                  onPlaylistEntryMove={onPlaylistEntryMove}
                  onPlaylistEntryRemove={onPlaylistEntryRemove}
                  onPlaylistPlaybackHandoff={onPlaylistPlaybackHandoff}
                  onPlaylistRename={onPlaylistRename}
                  onPlaylistSelect={onPlaylistSelect}
                  onTrackAdd={onPlaylistTrackAdd}
                />
              }
            />
            <Route
              path="/playlists/:playlistId"
              element={
                <PlaylistsPage
                  playlistsState={playlistsState}
                  tracksState={tracksState}
                  onCreatePlaylist={onPlaylistCreate}
                  onPlaylistArtworkChange={onPlaylistArtworkChange}
                  onPlaylistDelete={onPlaylistDelete}
                  onPlaylistEntryMove={onPlaylistEntryMove}
                  onPlaylistEntryRemove={onPlaylistEntryRemove}
                  onPlaylistPlaybackHandoff={onPlaylistPlaybackHandoff}
                  onPlaylistRename={onPlaylistRename}
                  onPlaylistSelect={onPlaylistSelect}
                  onTrackAdd={onPlaylistTrackAdd}
                />
              }
            />
            <Route path="/queue" element={<QueuePage queueState={queueState} />} />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  libraryRows={shellState.libraryRows}
                  libraryPath={libraryPath}
                  platformLabel={payload.platform}
                  appVersion={payload.appVersion}
                  scanState={scanState}
                  onPickLibraryDirectory={onPickLibraryDirectory}
                  onScan={onScan}
                />
              }
            />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </section>

        <PlaybackBar
          activeTrack={queueState.activeTrack}
          playback={shellState.playback}
          onPlaybackAction={onPlaybackAction}
          onSeek={onPlaybackSeek}
        />
      </main>
    </BrowserRouter>
  );
}
