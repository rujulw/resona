import { invoke } from "@tauri-apps/api/core";

export type BootstrapPayload = {
  appName: string;
  appVersion: string;
  windowTitle: string;
  platform: string;
  runtime: {
    desktopShell: string;
    frontend: string;
    core: string;
  };
};

export type NavSection = {
  id: string;
  label: string;
};

export type LibraryRow = {
  title: string;
  detail: string;
  state: string;
};

export type PlaybackShellState = {
  statusLabel: string;
  transportLabel: string;
  progressSeconds: number;
  durationSeconds: number;
};

export type ShellStatePayload = {
  navSections: NavSection[];
  libraryRows: LibraryRow[];
  playback: PlaybackShellState;
};

const browserBootstrapPayload: BootstrapPayload = {
  appName: "resona",
  appVersion: "0.1.0",
  windowTitle: "resona",
  platform: "browser",
  runtime: {
    desktopShell: "browser-preview",
    frontend: "react-vite",
    core: "rust",
  },
};

const browserShellStatePayload: ShellStatePayload = {
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
    progressSeconds: 0,
    durationSeconds: 0,
  },
};

export async function bootstrapApp(): Promise<BootstrapPayload> {
  try {
    return await invoke<BootstrapPayload>("bootstrap_app");
  } catch {
    return browserBootstrapPayload;
  }
}

export async function getShellState(): Promise<ShellStatePayload> {
  try {
    return await invoke<ShellStatePayload>("get_shell_state");
  } catch {
    return browserShellStatePayload;
  }
}

export async function playbackAction(
  action: "previous" | "toggle" | "next",
): Promise<PlaybackShellState> {
  try {
    return await invoke<PlaybackShellState>("playback_action", { action });
  } catch {
    if (action === "toggle") {
      return {
        ...browserShellStatePayload.playback,
        transportLabel: "Preview only",
      };
    }

    return browserShellStatePayload.playback;
  }
}
