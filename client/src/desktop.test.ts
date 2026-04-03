import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const openMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (filePath: string) => `asset://localhost/${encodeURIComponent(filePath)}`,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
}));

describe("desktop bootstrap bridge", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    openMock.mockReset();
  });

  it("loads bootstrap metadata from the command bridge", async () => {
    invokeMock.mockResolvedValueOnce({
      appName: "resona",
      appVersion: "1.0.1",
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

  it("describes the rust playback migration contract through the command bridge", async () => {
    invokeMock.mockResolvedValueOnce({
      currentOwner: "frontend-audio-element during v1 baseline",
      migrationTarget: "rust playback runtime owns transport queue progress and source state",
      runtimeBoundary:
        "tauri commands mutate playback runtime and tauri events broadcast playback snapshots",
      sourceResolutionOrder: ["local", "cache", "remote"],
      commands: [
        {
          name: "load_playback_track",
          summary: "load active playback item",
          requestShape: "{ trackId }",
          responseShape: "PlaybackSnapshot",
          authority: "rust playback runtime",
        },
      ],
      events: [
        {
          name: "playback://state-changed",
          summary: "state sync",
          payloadShape: "PlaybackSnapshot",
          delivery: "emit to listeners",
        },
      ],
      guarantees: ["queue order remains stable"],
    });

    const { describePlaybackContract } = await import("./desktop");
    const payload = await describePlaybackContract();

    expect(invokeMock).toHaveBeenCalledWith("describe_playback_contract");
    expect(payload.commands[0].name).toBe("load_playback_track");
    expect(payload.events[0].name).toBe("playback://state-changed");
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

  it("resolves an artwork source into an asset url", async () => {
    invokeMock.mockResolvedValueOnce({
      artworkKey: "cover.png",
      localPath: "/Users/rujulw/Library/Application Support/resona/artwork/cover.png",
    });

    const { resolveArtworkSource } = await import("./desktop");
    const payload = await resolveArtworkSource("cover.png");

    expect(invokeMock).toHaveBeenCalledWith("resolve_artwork_source", {
      artworkKey: "cover.png",
    });
    expect(payload?.assetUrl).toContain("asset://localhost/");
    expect(payload?.artworkKey).toBe("cover.png");
  });

  it("opens a native directory picker for library selection", async () => {
    openMock.mockResolvedValueOnce("/Users/rujulw/Music");

    const { pickLibraryDirectory } = await import("./desktop");
    const payload = await pickLibraryDirectory("/Users/rujulw");

    expect(openMock).toHaveBeenCalledWith({
      title: "Choose music folder",
      directory: true,
      multiple: false,
      recursive: true,
      defaultPath: "/Users/rujulw",
    });
    expect(payload).toBe("/Users/rujulw/Music");
  });
});
