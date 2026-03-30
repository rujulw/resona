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

export async function bootstrapApp(): Promise<BootstrapPayload> {
  try {
    return await invoke<BootstrapPayload>("bootstrap_app");
  } catch {
    return browserBootstrapPayload;
  }
}
