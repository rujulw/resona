import { invokeWithPreviewFallback } from "./runtime";
import type { BootstrapPayload, ShellStatePayload } from "./types";

const browserBootstrapPayload: BootstrapPayload = {
  appName: "resona",
  appVersion: "1.3.0",
  windowTitle: "resona",
  platform: "browser",
  runtime: {
    desktopShell: "browser-preview",
    frontend: "react-vite",
    core: "rust",
  },
};

export const browserShellStatePayload: ShellStatePayload = {
  navSections: [
    { id: "tracks", label: "Tracks" },
    { id: "albums", label: "Albums" },
    { id: "artists", label: "Artists" },
    { id: "queue", label: "Queue" },
    { id: "insights", label: "Insights" },
    { id: "settings", label: "Settings" },
  ],
  libraryRows: [
    { title: "Library", detail: "No tracks loaded yet", state: "Idle" },
    { title: "atlas", detail: "Remote source not connected", state: "Idle" },
    { title: "timbre", detail: "Analysis queue unavailable", state: "Idle" },
  ],
  playback: {
    statusLabel: "Nothing playing",
    transportLabel: "Idle",
    outputOwner: "frontend",
    progressSeconds: 0,
    durationSeconds: 0,
    isPlaying: false,
    trackId: null,
    trackTitle: null,
    trackArtist: null,
    trackAlbum: null,
    trackAdvisory: null,
  },
};

export async function bootstrapApp(): Promise<BootstrapPayload> {
  return invokeWithPreviewFallback("bootstrap_app", undefined, () => browserBootstrapPayload);
}

export async function getShellState(): Promise<ShellStatePayload> {
  return invokeWithPreviewFallback("get_shell_state", undefined, () => browserShellStatePayload);
}