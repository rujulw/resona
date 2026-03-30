import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
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
});
