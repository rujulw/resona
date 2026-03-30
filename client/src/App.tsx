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
      shellState={appShell.shellState}
      tracksState={appShell.tracksState}
      libraryPath={appShell.libraryPath}
      scanState={appShell.scanState}
      onLibraryPathChange={appShell.setLibraryPath}
      onPlaybackAction={appShell.handlePlaybackAction}
      onScan={appShell.handleScan}
    />
  );
}
