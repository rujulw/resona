import { AppShell } from "./components/layout/AppShell";
import { ShellStateScreen } from "./components/ui/ShellStateScreen";
import { useAppShell } from "./hooks/useAppShell";

export default function App() {
  const appShell = useAppShell();

  if (appShell.bootstrapState.status === "loading") {
    return <ShellStateScreen title="resona" />;
  }

  if (appShell.bootstrapState.status === "error") {
    return (
      <ShellStateScreen
        title="resona"
        detail={appShell.bootstrapState.message}
      />
    );
  }

  if (!appShell.shellState) {
    return <ShellStateScreen title={appShell.bootstrapState.payload.appName} />;
  }

  return (
    <AppShell
      payload={appShell.bootstrapState.payload}
      playlistsState={appShell.playlistsState}
      queueState={appShell.queueState}
      shellState={appShell.shellState}
      tracksState={appShell.tracksState}
      tracksQueryState={appShell.tracksQueryState}
      libraryPath={appShell.libraryPath}
      scanState={appShell.scanState}
      onPickLibraryDirectory={appShell.handlePickLibraryDirectory}
      onPlaylistCreate={appShell.handlePlaylistCreate}
      onPlaylistDelete={appShell.handlePlaylistDelete}
      onPlaylistRename={appShell.handlePlaylistRename}
      onPlaylistSelect={appShell.handlePlaylistSelection}
      onPlaylistTrackAdd={appShell.handlePlaylistTrackAdd}
      onPlaybackAction={appShell.handlePlaybackAction}
      onPlaybackSeek={appShell.handlePlaybackSeek}
      onTrackSelect={appShell.handleTrackSelection}
      onScan={appShell.handleScan}
      onTracksSearchDraftChange={appShell.handleTracksSearchDraftChange}
      onTracksSearchSubmit={appShell.handleTracksSearchSubmit}
      onTracksTitleHeaderSort={appShell.handleTracksTitleHeaderSort}
      onTracksAlbumHeaderSort={appShell.handleTracksAlbumHeaderSort}
    />
  );
}
