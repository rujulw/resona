import type {
  AppShellChromeState,
  PlaybackChromeActions,
} from "../../types/app";
import { PlaybackBar } from "./PlaybackBar";
import { Sidebar } from "./Sidebar";
import type { ReactNode } from "react";

export function AppShell({
  chrome,
  playback,
  children,
}: {
  chrome: AppShellChromeState;
  playback: PlaybackChromeActions;
  children: ReactNode;
}) {
  return (
    <main className="grid h-screen grid-cols-[248px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-[#121212] text-[#e5e5e5]">
      <Sidebar
        appName={chrome.appName}
        conceptAlbums={chrome.conceptAlbums}
        playlists={chrome.playlists}
        runtimeLabel={chrome.runtimeLabel}
      />

      <section className="min-h-0 min-w-0 overflow-hidden bg-[#121212]">{children}</section>

      <PlaybackBar
        activeTrack={chrome.queueState.activeTrack}
        playback={chrome.playback}
        onPlaybackAction={playback.onPlaybackAction}
        onSeek={playback.onPlaybackSeek}
      />
    </main>
  );
}
