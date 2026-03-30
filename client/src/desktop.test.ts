import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (filePath: string) => `asset://localhost/${encodeURIComponent(filePath)}`,
}));

describe("desktop bootstrap bridge", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("loads bootstrap metadata from the command bridge", async () => {
    invokeMock.mockResolvedValueOnce({
      appName: "resona",
      appVersion: "0.1.0",
      windowTitle: "resona",
      platform: "macos",
      runtime: {
        desktopShell: "tauri",
        frontend: "react-vite",
        core: "rust",
      },
    });

    const { bootstrapApp } = await import("./desktop");
    const payload = await bootstrapApp();

    expect(invokeMock).toHaveBeenCalledWith("bootstrap_app");
    expect(payload.runtime.desktopShell).toBe("tauri");
    expect(payload.windowTitle).toBe("resona");
  });

  it("falls back to browser preview bootstrap state when invoke fails", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));

    const { bootstrapApp } = await import("./desktop");
    const payload = await bootstrapApp();

    expect(payload.platform).toBe("browser");
    expect(payload.runtime.desktopShell).toBe("browser-preview");
  });

  it("falls back to preview playback state when shell actions are unavailable", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));

    const { playbackAction } = await import("./desktop");
    const payload = await playbackAction("toggle");

    expect(payload.statusLabel).toBe("Nothing playing");
    expect(payload.transportLabel).toBe("Preview only");
  });

  it("resolves a local playback source into an asset url", async () => {
    invokeMock.mockResolvedValueOnce({
      trackId: "track-1",
      localPath: "/Users/rujulw/Music/alpha.mp3",
    });

    const { resolveTrackPlaybackSource } = await import("./desktop");
    const payload = await resolveTrackPlaybackSource("track-1");

    expect(invokeMock).toHaveBeenCalledWith("resolve_track_playback_source", {
      trackId: "track-1",
    });
    expect(payload?.assetUrl).toContain("asset://localhost/");
    expect(payload?.trackId).toBe("track-1");
  });
});
