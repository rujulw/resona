import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe("desktop shell bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    delete (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    delete (globalThis as typeof globalThis & { __TAURI__?: unknown }).__TAURI__;
  });

  it("loads bootstrap metadata from the command bridge", async () => {
    invokeMock.mockResolvedValueOnce({
      appName: "resona",
      appVersion: "1.3.0",
      windowTitle: "resona",
      platform: "macos",
      runtime: {
        desktopShell: "tauri",
        frontend: "react-vite",
        core: "rust",
      },
    });

    const { bootstrapApp } = await import("./shell");
    const payload = await bootstrapApp();

    expect(invokeMock).toHaveBeenCalledWith("bootstrap_app");
    expect(payload.runtime.desktopShell).toBe("tauri");
    expect(payload.windowTitle).toBe("resona");
  });

  it("falls back to browser preview bootstrap state when invoke fails", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));

    const { bootstrapApp } = await import("./shell");
    const payload = await bootstrapApp();

    expect(payload.platform).toBe("browser");
    expect(payload.runtime.desktopShell).toBe("browser-preview");
  });

  it("loads shell state from the command bridge", async () => {
    invokeMock.mockResolvedValueOnce({
      navSections: [{ id: "tracks", label: "Tracks" }],
      libraryRows: [{ title: "Library", detail: "120 tracks", state: "Ready" }],
      playback: {
        statusLabel: "Playing",
        transportLabel: "Playing",
        outputOwner: "rust",
        progressSeconds: 12,
        durationSeconds: 182,
        isPlaying: true,
        trackId: "track-1",
        trackTitle: "Alpha",
        trackArtist: "North",
        trackAlbum: "Signals",
        trackAdvisory: null,
      },
    });

    const { getShellState } = await import("./shell");
    const payload = await getShellState();

    expect(invokeMock).toHaveBeenCalledWith("get_shell_state");
    expect(payload.libraryRows[0].state).toBe("Ready");
    expect(payload.playback.outputOwner).toBe("rust");
  });

  it("falls back to browser preview shell state when the bridge is unavailable", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));

    const { getShellState } = await import("./shell");
    const payload = await getShellState();

    expect(payload.navSections.map((section) => section.id)).toEqual([
      "tracks",
      "albums",
      "artists",
      "queue",
      "insights",
      "settings",
    ]);
    expect(payload.playback.outputOwner).toBe("frontend");
  });
});
