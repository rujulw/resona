import { AppShell } from "./components/layout/AppShell";
import { ShellStateScreen } from "./components/ui/ShellStateScreen";
import { useAppShell } from "./hooks/useAppShell";
import type { AppShellViewModel } from "./types/app";

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

  const shellViewModel: AppShellViewModel = {
    chrome: {
      appName: appShell.bootstrapState.payload.appName,
      runtimeLabel: `${appShell.bootstrapState.payload.runtime.desktopShell} desktop shell`,
      playlists: appShell.playlistsState.items,
      queueState: appShell.queueState,
      playback: appShell.shellState.playback,
    },
    routes: {
      home: {
        libraryRows: appShell.shellState.libraryRows,
        trackCount: appShell.tracksState.total,
        appVersion: appShell.bootstrapState.payload.appVersion,
      },
      tracks: {
        libraryPath: appShell.libraryPath,
        scanState: appShell.scanState,
        tracksQueryState: appShell.tracksQueryState,
        tracksState: appShell.tracksState,
      },
      playlists: {
        playlistsState: appShell.playlistsState,
        tracksState: appShell.tracksState,
      },
      queue: {
        queueState: appShell.queueState,
      },
      settings: {
        libraryRows: appShell.shellState.libraryRows,
        libraryPath: appShell.libraryPath,
        platformLabel: appShell.bootstrapState.payload.platform,
        appVersion: appShell.bootstrapState.payload.appVersion,
        scanState: appShell.scanState,
      },
    },
    actions: {
      playlists: {
        onCreatePlaylist: appShell.handlePlaylistCreate,
        onPlaylistArtworkChange: appShell.handlePlaylistArtworkChange,
        onPlaylistDelete: appShell.handlePlaylistDelete,
        onPlaylistEntryMove: appShell.handlePlaylistEntryMove,
        onPlaylistEntriesReplace: appShell.handlePlaylistEntriesReplace,
        onPlaylistEntryRemove: appShell.handlePlaylistEntryRemove,
        onPlaylistPlaybackHandoff: appShell.handlePlaylistPlaybackHandoff,
        onPlaylistRename: appShell.handlePlaylistRename,
        onPlaylistSelect: appShell.handlePlaylistSelection,
        onTrackAdd: appShell.handlePlaylistTrackAdd,
      },
      tracks: {
        onTrackSelect: appShell.handleTrackSelection,
        onTracksSearchDraftChange: appShell.handleTracksSearchDraftChange,
        onTracksSearchSubmit: appShell.handleTracksSearchSubmit,
        onTracksTitleHeaderSort: appShell.handleTracksTitleHeaderSort,
        onTracksAlbumHeaderSort: appShell.handleTracksAlbumHeaderSort,
      },
      settings: {
        onPickLibraryDirectory: appShell.handlePickLibraryDirectory,
        onScan: appShell.handleScan,
      },
    },
    playback: {
      onPlaybackAction: appShell.handlePlaybackAction,
      onPlaybackSeek: appShell.handlePlaybackSeek,
    },
  };

  return (
    <AppShell
      chrome={shellViewModel.chrome}
      routes={shellViewModel.routes}
      actions={shellViewModel.actions}
      playback={shellViewModel.playback}
    />
  );
}
