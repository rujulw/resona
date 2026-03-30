// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bootstrapAppMock = vi.fn();
const getShellStateMock = vi.fn();
const queryLibraryMock = vi.fn();
const pickLibraryDirectoryMock = vi.fn();
const playbackActionMock = vi.fn();
const resolveArtworkSourceMock = vi.fn();
const resolveTrackPlaybackSourceMock = vi.fn();
const scanLocalLibraryMock = vi.fn();
const mockAudioInstances: MockAudio[] = [];

vi.mock("./desktop", () => ({
  bootstrapApp: () => bootstrapAppMock(),
  getShellState: () => getShellStateMock(),
  pickLibraryDirectory: (...args: unknown[]) => pickLibraryDirectoryMock(...args),
  queryLibrary: () => queryLibraryMock(),
  playbackAction: (...args: unknown[]) => playbackActionMock(...args),
  resolveArtworkSource: (...args: unknown[]) => resolveArtworkSourceMock(...args),
  resolveTrackPlaybackSource: (...args: unknown[]) => resolveTrackPlaybackSourceMock(...args),
  scanLocalLibrary: (...args: unknown[]) => scanLocalLibraryMock(...args),
}));

class MockAudio extends EventTarget {
  src = "";
  preload = "";
  currentTime = 0;
  duration = 0;
  paused = true;
  ended = false;

  play = vi.fn(async () => {
    this.paused = false;
    this.ended = false;
    this.dispatchEvent(new Event("play"));
  });

  pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  });

  emitLoadedMetadata(duration?: number) {
    if (typeof duration === "number") {
      this.duration = duration;
    }

    this.dispatchEvent(new Event("loadedmetadata"));
  }

  emitTimeUpdate(currentTime: number, duration = this.duration) {
    this.currentTime = currentTime;
    this.duration = duration;
    this.dispatchEvent(new Event("timeupdate"));
  }
}

describe("app shell smoke checks", () => {
  beforeEach(() => {
    bootstrapAppMock.mockReset();
    getShellStateMock.mockReset();
    queryLibraryMock.mockReset();
    pickLibraryDirectoryMock.mockReset();
    playbackActionMock.mockReset();
    resolveArtworkSourceMock.mockReset();
    resolveTrackPlaybackSourceMock.mockReset();
    scanLocalLibraryMock.mockReset();
    mockAudioInstances.length = 0;
    vi.stubGlobal(
      "Audio",
      vi.fn(() => {
        const instance = new MockAudio();
        mockAudioInstances.push(instance);
        return instance;
      }),
    );

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
          artworkKey: "alpha-cover.png",
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
          artworkKey: "bravo-cover.png",
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
    resolveArtworkSourceMock.mockImplementation(async (artworkKey: string) => ({
      artworkKey,
      localPath: `/Users/rujulw/Library/Application Support/resona/artwork/${artworkKey}`,
      assetUrl: `asset://localhost/${artworkKey}`,
    }));
    pickLibraryDirectoryMock.mockResolvedValue("/Users/rujulw/Music");

    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
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
    await waitFor(() => {
      expect(screen.getByAltText("Alpha artwork")).toBeTruthy();
    });
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

  it("derives queue state from the current selection and next-up order", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Select Alpha" }).getAttribute("aria-pressed"),
      ).toBe("true");
    });

    fireEvent.click(screen.getByRole("link", { name: /queue/i }));

    await waitFor(() => {
      expect(screen.getByText("now playing")).toBeTruthy();
      expect(screen.getByText("derived from the current local selection")).toBeTruthy();
      expect(screen.getByAltText("Alpha artwork")).toBeTruthy();
      expect(
        screen.queryByText("No additional indexed tracks are queued after the current selection."),
      ).toBeNull();
    });

    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bravo").length).toBeGreaterThan(0);
    expect(screen.getByText("01")).toBeTruthy();
  });

  it("syncs progress labels from the active audio element", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(mockAudioInstances.length).toBeGreaterThan(0);
      expect(
        screen.getByRole("button", { name: "Select Alpha" }).getAttribute("aria-pressed"),
      ).toBe("true");
    });

    const audio = mockAudioInstances.at(-1);
    if (!audio) {
      throw new Error("Expected a mock audio instance");
    }

    audio.emitLoadedMetadata(182);
    audio.emitTimeUpdate(41, 182);

    await waitFor(() => {
      expect(screen.getByText("0:41")).toBeTruthy();
      expect(screen.getAllByText("3:02").length).toBeGreaterThan(0);
    });
  });

  it("restarts the current track when previous is pressed after progress has advanced", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(mockAudioInstances.length).toBeGreaterThan(0);
    });

    const audio = mockAudioInstances.at(-1);
    if (!audio) {
      throw new Error("Expected a mock audio instance");
    }

    audio.emitLoadedMetadata(182);
    audio.emitTimeUpdate(12, 182);

    fireEvent.click(screen.getByRole("button", { name: "Previous track" }));

    await waitFor(() => {
      expect(screen.getByText("0:00")).toBeTruthy();
      expect(audio.currentTime).toBe(0);
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

  it("replaces raw path typing with the folder picker flow", async () => {
    window.history.replaceState({}, "", "/settings");

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "choose folder" }));

    await waitFor(() => {
      expect(pickLibraryDirectoryMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("/Users/rujulw/Music")).toBeTruthy();
      expect(screen.getByRole("button", { name: "scan library" })).toBeTruthy();
    });
  });

  it("shows recursive import feedback and empty-state guidance after a zero-result scan", async () => {
    window.history.replaceState({}, "", "/settings");
    scanLocalLibraryMock.mockResolvedValue({
      libraryRootId: "root-1",
      libraryRootName: "Empty Root",
      rootPath: "/Users/rujulw/Empty Root",
      discoveredTracks: 0,
      insertedTracks: 0,
      updatedTracks: 0,
      removedTracks: 0,
    });
    queryLibraryMock.mockResolvedValue({
      items: [],
      nextCursor: null,
      total: 0,
      pageSize: 200,
    });

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "choose folder" }));
    fireEvent.click(await screen.findByRole("button", { name: "scan library" }));

    await waitFor(() => {
      expect(screen.getByText("Empty Root")).toBeTruthy();
      expect(screen.getByText("/Users/rujulw/Empty Root")).toBeTruthy();
      expect(screen.getByText("Scan finished for Empty Root, but no MP3 files were found.")).toBeTruthy();
      expect(screen.getByText("found")).toBeTruthy();
      expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("link", { name: /tracks/i }));

    await waitFor(() => {
      expect(screen.getByText("No MP3 files found in Empty Root.")).toBeTruthy();
      expect(
        screen.getByText(
          "The recursive scan completed, but that root did not contain any MP3 files in the selected folder tree.",
        ),
      ).toBeTruthy();
    });
  });
});
