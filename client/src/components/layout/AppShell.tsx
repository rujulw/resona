import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import type { BootstrapPayload, TrackListItem } from "../../desktop";
import type { QueueState, ScanState, ShellState, TracksState } from "../../types/app";
import { PlaybackBar } from "./PlaybackBar";
import { Sidebar } from "./Sidebar";
import { HomePage } from "../../pages/HomePage";
import { QueuePage } from "../../pages/QueuePage";
import { SettingsPage } from "../../pages/SettingsPage";
import { TracksPage } from "../../pages/TracksPage";

export function AppShell({
  payload,
  queueState,
  shellState,
  tracksState,
  libraryPath,
  scanState,
  onPickLibraryDirectory,
  onPlaybackAction,
  onTrackSelect,
  onScan,
}: {
  payload: BootstrapPayload;
  queueState: QueueState;
  shellState: ShellState;
  tracksState: TracksState;
  libraryPath: string;
  scanState: ScanState;
  onPickLibraryDirectory: () => void;
  onPlaybackAction: (action: "previous" | "toggle" | "next") => void;
  onTrackSelect: (track: TrackListItem) => void;
  onScan: () => void;
}) {
  return (
    <BrowserRouter>
      <main className="grid h-screen grid-cols-[248px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-[#121212] text-[#e5e5e5]">
        <Sidebar
          appName={payload.appName}
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
                  tracksState={tracksState}
                  onTrackSelect={onTrackSelect}
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

        <PlaybackBar playback={shellState.playback} onPlaybackAction={onPlaybackAction} />
      </main>
    </BrowserRouter>
  );
}
