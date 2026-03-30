// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bootstrapAppMock = vi.fn();
const getShellStateMock = vi.fn();
const queryLibraryMock = vi.fn();
const playbackActionMock = vi.fn();
const resolveTrackPlaybackSourceMock = vi.fn();
const scanLocalLibraryMock = vi.fn();

vi.mock("./desktop", () => ({
  bootstrapApp: () => bootstrapAppMock(),
  getShellState: () => getShellStateMock(),
  queryLibrary: () => queryLibraryMock(),
  playbackAction: (...args: unknown[]) => playbackActionMock(...args),
  resolveTrackPlaybackSource: (...args: unknown[]) => resolveTrackPlaybackSourceMock(...args),
  scanLocalLibrary: (...args: unknown[]) => scanLocalLibraryMock(...args),
}));

describe("app shell smoke checks", () => {
  beforeEach(() => {
    bootstrapAppMock.mockReset();
    getShellStateMock.mockReset();
    queryLibraryMock.mockReset();
    playbackActionMock.mockReset();
    resolveTrackPlaybackSourceMock.mockReset();
    scanLocalLibraryMock.mockReset();

    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

    bootstrapAppMock.mockResolvedValue({
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
    getShellStateMock.mockResolvedValue({
      navSections: [
        { id: "tracks", label: "Tracks" },
        { id: "albums", label: "Albums" },
        { id: "artists", label: "Artists" },
        { id: "queue", label: "Queue" },
        { id: "settings", label: "Settings" },
      ],
      libraryRows: [
        { title: "Library", detail: "2 tracks indexed", state: "Ready" },
        { title: "atlas", detail: "Remote source not connected", state: "Idle" },
        { title: "timbre", detail: "Analysis queue unavailable", state: "Idle" },
      ],
      playback: {
        statusLabel: "Nothing playing",
        transportLabel: "Idle",
        progressSeconds: 0,
        durationSeconds: 0,
      },
    });
    queryLibraryMock.mockResolvedValue({
      items: [
        {
          id: "track-1",
          title: "Alpha",
          artist: "North",
          album: "Signals",
          durationSeconds: 182,
          relativePath: "alpha.mp3",
          sourceStatus: "local-only",
          cacheState: "none",
          analysisStatus: "pending",
          indexedAt: "1700000000",
        },
        {
          id: "track-2",
          title: "Bravo",
          artist: "South",
          album: "Horizons",
          durationSeconds: 205,
          relativePath: "bravo.mp3",
          sourceStatus: "local-only",
          cacheState: "none",
          analysisStatus: "pending",
          indexedAt: "1700000100",
        },
      ],
      nextCursor: null,
      total: 2,
      pageSize: 200,
    });
    resolveTrackPlaybackSourceMock.mockImplementation(async (trackId: string) => ({
      trackId,
      localPath: `/Users/rujulw/Music/${trackId}.mp3`,
      assetUrl: `asset://localhost/${trackId}.mp3`,
    }));

    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("boots the routed shell and lands on home", async () => {
    const { default: App } = await import("./App");
    render(<App />);

    await screen.findByText("desktop music utility");

    expect(screen.getByText("resona")).toBeTruthy();
    expect(screen.getByRole("link", { name: /tracks/i })).toBeTruthy();
    expect(screen.getByText("Nothing playing")).toBeTruthy();
    expect(bootstrapAppMock).toHaveBeenCalledTimes(1);
    expect(getShellStateMock).toHaveBeenCalledTimes(1);
    expect(queryLibraryMock).toHaveBeenCalledTimes(1);
  });

  it("renders the tracks route inside the fixed shell", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("./App");
    render(<App />);

    await screen.findByRole("heading", { name: "library table" });

    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Signals")).toBeTruthy();
    expect(screen.getByText("3:02")).toBeTruthy();
    expect(screen.getByText("Nothing playing")).toBeTruthy();
  });

  it("pushes the selected track into the playback shell state", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("./App");
    render(<App />);

    const trackRow = await screen.findByRole("button", { name: "Select Alpha" });
    fireEvent.click(trackRow);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Select Alpha" }).getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.getByText("Playing")).toBeTruthy();
    });
  });

  it("moves active-track state with previous and next transport controls", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Select Alpha" }).getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.getByText("Playing")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Next track" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Select Bravo" }).getAttribute("aria-pressed"),
      ).toBe("true");
    });

    fireEvent.click(screen.getByRole("button", { name: "Previous track" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Select Alpha" }).getAttribute("aria-pressed"),
      ).toBe("true");
    });
  });

  it("navigates from home to settings without losing the shell", async () => {
    const { default: App } = await import("./App");
    render(<App />);

    await screen.findByText("desktop music utility");

    fireEvent.click(screen.getByRole("link", { name: /settings/i }));

    await waitFor(() => {
      expect(screen.getByText("library roots and desktop wiring")).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: /scan library/i })).toBeTruthy();
    expect(screen.getByText("Nothing playing")).toBeTruthy();
  });
});
