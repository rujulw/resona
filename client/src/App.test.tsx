// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bootstrapAppMock = vi.fn();
const getShellStateMock = vi.fn();
const loadPlaybackTrackMock = vi.fn();
const queryLibraryMock = vi.fn();
const pickLibraryDirectoryMock = vi.fn();
const playbackActionMock = vi.fn();
const syncPlaybackTimingMock = vi.fn();
const seekPlaybackMock = vi.fn();
const completePlaybackMock = vi.fn();
const reportPlaybackErrorMock = vi.fn();
const subscribePlaybackStateMock = vi.fn();
const resolveArtworkSourceMock = vi.fn();
const resolveTrackPlaybackSourceMock = vi.fn();
const scanLocalLibraryMock = vi.fn();
const mockAudioInstances: MockAudio[] = [];

vi.mock("./desktop", () => ({
  bootstrapApp: () => bootstrapAppMock(),
  getShellState: () => getShellStateMock(),
  loadPlaybackTrack: (...args: unknown[]) => loadPlaybackTrackMock(...args),
  pickLibraryDirectory: (...args: unknown[]) => pickLibraryDirectoryMock(...args),
  queryLibrary: (...args: unknown[]) => queryLibraryMock(...args),
  playbackAction: (...args: unknown[]) => playbackActionMock(...args),
  syncPlaybackTiming: (...args: unknown[]) => syncPlaybackTimingMock(...args),
  seekPlayback: (...args: unknown[]) => seekPlaybackMock(...args),
  completePlayback: (...args: unknown[]) => completePlaybackMock(...args),
  reportPlaybackError: (...args: unknown[]) => reportPlaybackErrorMock(...args),
  subscribePlaybackState: (...args: unknown[]) => subscribePlaybackStateMock(...args),
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

type DeferredPlaybackSource = {
  trackId: string;
  localPath: string;
  assetUrl: string;
};

type DeferredLibraryPage = {
  items: Array<{
    id: string;
    title: string;
    artist: string | null;
    album: string | null;
    durationSeconds: number | null;
    artworkKey: string | null;
    relativePath: string;
    sourceStatus: string;
    cacheState: string;
    analysisStatus: string;
    indexedAt: string;
  }>;
  nextCursor: null;
  total: number;
  pageSize: number;
};

describe("app shell smoke checks", () => {
  let mockBackendPlayback: {
    statusLabel: string;
    transportLabel: string;
    progressSeconds: number;
    durationSeconds: number;
    isPlaying: boolean;
    trackId: string | null;
    trackTitle: string | null;
    trackArtist: string | null;
    trackAlbum: string | null;
  };
  let playbackStateListener:
    | ((playback: {
        statusLabel: string;
        transportLabel: string;
        progressSeconds: number;
        durationSeconds: number;
        isPlaying: boolean;
        trackId: string | null;
        trackTitle: string | null;
        trackArtist: string | null;
        trackAlbum: string | null;
      }) => void)
    | undefined;

  beforeEach(() => {
    bootstrapAppMock.mockReset();
    getShellStateMock.mockReset();
    loadPlaybackTrackMock.mockReset();
    queryLibraryMock.mockReset();
    pickLibraryDirectoryMock.mockReset();
    playbackActionMock.mockReset();
    syncPlaybackTimingMock.mockReset();
    seekPlaybackMock.mockReset();
    completePlaybackMock.mockReset();
    reportPlaybackErrorMock.mockReset();
    subscribePlaybackStateMock.mockReset();
    resolveArtworkSourceMock.mockReset();
    resolveTrackPlaybackSourceMock.mockReset();
    scanLocalLibraryMock.mockReset();
    mockAudioInstances.length = 0;
    mockBackendPlayback = {
      statusLabel: "Nothing playing",
      transportLabel: "Idle",
      progressSeconds: 0,
      durationSeconds: 0,
      isPlaying: false,
      trackId: null,
      trackTitle: null,
      trackArtist: null,
      trackAlbum: null,
    };
    playbackStateListener = undefined;
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
      appVersion: "1.0.1",
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
    subscribePlaybackStateMock.mockImplementation(async (callback) => {
      playbackStateListener = callback;
      return () => {
        playbackStateListener = undefined;
      };
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
    loadPlaybackTrackMock.mockImplementation(async (trackId: string) => ({
      playback: (() => {
        mockBackendPlayback = {
          statusLabel: "Ready",
          transportLabel: "Ready",
          progressSeconds: 0,
          durationSeconds: trackId === "track-1" ? 182 : 205,
          isPlaying: false,
          trackId,
          trackTitle: trackId === "track-1" ? "Alpha" : "Bravo",
          trackArtist: trackId === "track-1" ? "North" : "South",
          trackAlbum: trackId === "track-1" ? "Signals" : "Horizons",
        };
        playbackStateListener?.(mockBackendPlayback);
        return mockBackendPlayback;
      })(),
      source: {
        trackId,
        localPath: `/Users/rujulw/Music/${trackId}.mp3`,
        assetUrl: `asset://localhost/${trackId}.mp3`,
      },
    }));
    playbackActionMock.mockImplementation(async (action: "previous" | "toggle" | "next") => {
      if (action === "toggle") {
        if (!mockBackendPlayback.trackId) {
          mockBackendPlayback = {
            ...mockBackendPlayback,
            transportLabel: "Play requested",
          };
          playbackStateListener?.(mockBackendPlayback);
          return mockBackendPlayback;
        }

        mockBackendPlayback = {
          ...mockBackendPlayback,
          isPlaying: !mockBackendPlayback.isPlaying,
          statusLabel: !mockBackendPlayback.isPlaying ? "Playing" : "Ready",
          transportLabel: !mockBackendPlayback.isPlaying ? "Playing" : "Paused",
        };
        playbackStateListener?.(mockBackendPlayback);
        return mockBackendPlayback;
      }

      mockBackendPlayback = {
        ...mockBackendPlayback,
        transportLabel: action === "previous" ? "Previous unavailable" : "Next unavailable",
      };
      playbackStateListener?.(mockBackendPlayback);
      return mockBackendPlayback;
    });
    syncPlaybackTimingMock.mockImplementation(
      async (progressSeconds?: number, durationSeconds?: number) => {
        mockBackendPlayback = {
          ...mockBackendPlayback,
          progressSeconds: progressSeconds ?? mockBackendPlayback.progressSeconds,
          durationSeconds: durationSeconds ?? mockBackendPlayback.durationSeconds,
        };
        playbackStateListener?.(mockBackendPlayback);
        return mockBackendPlayback;
      },
    );
    seekPlaybackMock.mockImplementation(async (positionSeconds: number) => {
      mockBackendPlayback = {
        ...mockBackendPlayback,
        progressSeconds: positionSeconds,
        transportLabel: mockBackendPlayback.isPlaying ? "Playing" : "Paused",
      };
      playbackStateListener?.(mockBackendPlayback);
      return mockBackendPlayback;
    });
    completePlaybackMock.mockImplementation(async () => {
      mockBackendPlayback = {
        ...mockBackendPlayback,
        statusLabel: "Ended",
        transportLabel: "Ended",
        progressSeconds: mockBackendPlayback.durationSeconds,
        isPlaying: false,
      };
      playbackStateListener?.(mockBackendPlayback);
      return mockBackendPlayback;
    });
    reportPlaybackErrorMock.mockImplementation(async (transportLabel?: string) => {
      mockBackendPlayback = {
        ...mockBackendPlayback,
        statusLabel: "Error",
        transportLabel: transportLabel ?? "Playback error",
        isPlaying: false,
      };
      playbackStateListener?.(mockBackendPlayback);
      return mockBackendPlayback;
    });
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

  it("drives search and header sort controls through the tracks query contract", async () => {
    window.history.replaceState({}, "", "/tracks");
    queryLibraryMock.mockReset();
    queryLibraryMock
      .mockResolvedValueOnce({
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
        ],
        nextCursor: null,
        total: 3,
        pageSize: 200,
      })
      .mockResolvedValueOnce({
        items: [
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
        total: 1,
        pageSize: 200,
      })
      .mockResolvedValueOnce({
        items: [
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
        total: 1,
        pageSize: 200,
      })
      .mockResolvedValueOnce({
        items: [
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
        total: 1,
        pageSize: 200,
      })
      .mockResolvedValueOnce({
        items: [
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
        total: 1,
        pageSize: 200,
      });

    const { default: App } = await import("./App");
    render(<App />);

    await screen.findByRole("heading", { name: "library table" });

    fireEvent.change(screen.getByPlaceholderText("Search title, artist, album"), {
      target: { value: "bravo" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Search title, artist, album"), {
      key: "Enter",
      code: "Enter",
    });

    await waitFor(() => {
      expect(queryLibraryMock).toHaveBeenLastCalledWith({
        pageSize: 200,
        cursor: null,
        search: "bravo",
        sortKey: "title",
        sortDirection: "asc",
      });
      expect(screen.getByText("Bravo")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "title ↑" }));
    await screen.findByRole("button", { name: "title ↓" });

    fireEvent.click(screen.getByRole("button", { name: "title ↓" }));
    await screen.findByRole("button", { name: "artist ↑" });

    fireEvent.click(screen.getByRole("button", { name: "artist ↑" }));

    await waitFor(() => {
      expect(queryLibraryMock).toHaveBeenLastCalledWith({
        pageSize: 200,
        cursor: null,
        search: "bravo",
        sortKey: "artist",
        sortDirection: "desc",
      });
    });
  });

  it("cycles album header sort back to the default title order", async () => {
    window.history.replaceState({}, "", "/tracks");
    queryLibraryMock.mockReset();
    queryLibraryMock
      .mockResolvedValueOnce({
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
        ],
        nextCursor: null,
        total: 2,
        pageSize: 200,
      })
      .mockResolvedValueOnce({
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
        ],
        nextCursor: null,
        total: 2,
        pageSize: 200,
      })
      .mockResolvedValueOnce({
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
        ],
        nextCursor: null,
        total: 2,
        pageSize: 200,
      })
      .mockResolvedValueOnce({
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
        ],
        nextCursor: null,
        total: 2,
        pageSize: 200,
      });

    const { default: App } = await import("./App");
    render(<App />);

    await screen.findByRole("heading", { name: "library table" });

    fireEvent.click(screen.getByRole("button", { name: "album" }));
    await screen.findByRole("button", { name: "album ↑" });

    fireEvent.click(screen.getByRole("button", { name: "album ↑" }));
    await screen.findByRole("button", { name: "album ↓" });

    fireEvent.click(screen.getByRole("button", { name: "album ↓" }));

    await waitFor(() => {
      expect(queryLibraryMock).toHaveBeenLastCalledWith({
        pageSize: 200,
        cursor: null,
        search: null,
        sortKey: "title",
        sortDirection: "asc",
      });
      expect(screen.getByRole("button", { name: "title ↑" })).toBeTruthy();
    });
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
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
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
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Next track" }));

    await waitFor(() => {
      expect(screen.getAllByText("Bravo").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Previous track" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Select Alpha" }).getAttribute("aria-pressed"),
      ).toBe("true");
    });
  });

  it("autoplays the next queued track when the active track finishes", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(loadPlaybackTrackMock).toHaveBeenCalledWith("track-1");
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });

    const [firstAudio] = mockAudioInstances;
    firstAudio.emitLoadedMetadata(182);
    firstAudio.emitTimeUpdate(182, 182);
    firstAudio.ended = true;
    firstAudio.dispatchEvent(new Event("ended"));

    await waitFor(() => {
      expect(loadPlaybackTrackMock).toHaveBeenCalledWith("track-2");
      expect(screen.getAllByText("Bravo").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
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

  it("keeps queue navigation stable after the tracks view is filtered by search", async () => {
    window.history.replaceState({}, "", "/tracks");
    queryLibraryMock.mockReset();
    queryLibraryMock
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
        ],
        nextCursor: null,
        total: 1,
        pageSize: 200,
      });

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText("Search title, artist, album"), {
      target: { value: "alpha" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Search title, artist, album"), {
      key: "Enter",
      code: "Enter",
    });

    await waitFor(() => {
      expect(screen.queryByText("Bravo")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Next track" }));

    await waitFor(() => {
      expect(screen.getAllByText("Bravo").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("link", { name: /queue/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Bravo").length).toBeGreaterThan(0);
      expect(
        screen.getByText("No additional indexed tracks are queued after the current selection."),
      ).toBeTruthy();
    });
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
      expect(syncPlaybackTimingMock).toHaveBeenCalled();
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
      expect(seekPlaybackMock).toHaveBeenCalledWith(0);
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

  it("refreshes the indexed tracks after a successful import scan", async () => {
    window.history.replaceState({}, "", "/settings");
    scanLocalLibraryMock.mockResolvedValue({
      libraryRootId: "root-2",
      libraryRootName: "Fresh Root",
      rootPath: "/Users/rujulw/Fresh Root",
      discoveredTracks: 2,
      insertedTracks: 2,
      updatedTracks: 0,
      removedTracks: 0,
    });
    queryLibraryMock.mockReset();
    queryLibraryMock
      .mockResolvedValueOnce({
        items: [],
        nextCursor: null,
        total: 0,
        pageSize: 200,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "track-9",
            title: "Fresh Start",
            artist: "North",
            album: "Arrivals",
            durationSeconds: 201,
            artworkKey: "fresh-cover.png",
            relativePath: "fresh-start.mp3",
            sourceStatus: "local-only",
            cacheState: "none",
            analysisStatus: "pending",
            indexedAt: "1700000900",
          },
        ],
        nextCursor: null,
        total: 1,
        pageSize: 200,
      });

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "choose folder" }));
    fireEvent.click(await screen.findByRole("button", { name: "scan library" }));

    await waitFor(() => {
      expect(scanLocalLibraryMock).toHaveBeenCalledWith("/Users/rujulw/Music");
      expect(queryLibraryMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Indexed 2 track(s) from Fresh Root.")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("link", { name: /tracks/i }));

    await waitFor(() => {
      expect(screen.getByText("Fresh Start")).toBeTruthy();
      expect(screen.getByText("Arrivals")).toBeTruthy();
    });
  });

  it("keeps the newest selected track active when playback source resolution races", async () => {
    window.history.replaceState({}, "", "/tracks");

    let resolveAlpha: ((value: DeferredPlaybackSource) => void) | undefined;
    loadPlaybackTrackMock.mockImplementation(
      (trackId: string) =>
        new Promise<{ playback: Record<string, unknown>; source: DeferredPlaybackSource }>((resolve) => {
          if (trackId === "track-1") {
            resolveAlpha = (value) =>
              {
                mockBackendPlayback = {
                  statusLabel: "Ready",
                  transportLabel: "Ready",
                  progressSeconds: 0,
                  durationSeconds: 182,
                  isPlaying: false,
                  trackId: "track-1",
                  trackTitle: "Alpha",
                  trackArtist: "North",
                  trackAlbum: "Signals",
                };
                playbackStateListener?.(mockBackendPlayback);
                resolve({
                  playback: {
                    ...mockBackendPlayback,
                  },
                  source: value,
                });
              };
            return;
          }

          mockBackendPlayback = {
            statusLabel: "Ready",
            transportLabel: "Ready",
            progressSeconds: 0,
            durationSeconds: 205,
            isPlaying: false,
            trackId,
            trackTitle: "Bravo",
            trackArtist: "South",
            trackAlbum: "Horizons",
          };
          playbackStateListener?.(mockBackendPlayback);
          resolve({
            playback: {
              ...mockBackendPlayback,
            },
            source: {
              trackId,
              localPath: `/Users/rujulw/Music/${trackId}.mp3`,
              assetUrl: `asset://localhost/${trackId}.mp3`,
            },
          });
        }),
    );

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Bravo" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Select Bravo" }).getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });

    const fulfillAlpha = resolveAlpha;
    if (fulfillAlpha) {
      fulfillAlpha({
        trackId: "track-1",
        localPath: "/Users/rujulw/Music/track-1.mp3",
        assetUrl: "asset://localhost/track-1.mp3",
      });
    }

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Select Bravo" }).getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.queryByRole("button", { name: "Select Alpha" })?.getAttribute("aria-pressed")).toBe("false");
    });
  });

  it("keeps the latest tracks query result when search requests overlap", async () => {
    window.history.replaceState({}, "", "/tracks");
    queryLibraryMock.mockReset();

    let resolveAlphaSearch: ((value: DeferredLibraryPage) => void) | undefined;

    queryLibraryMock
      .mockResolvedValueOnce({
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
        ],
        nextCursor: null,
        total: 1,
        pageSize: 200,
      })
      .mockImplementationOnce(
        () =>
          new Promise<DeferredLibraryPage>((resolve) => {
            resolveAlphaSearch = resolve;
          }),
      )
      .mockResolvedValueOnce({
        items: [
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
        total: 1,
        pageSize: 200,
      });

    const { default: App } = await import("./App");
    render(<App />);

    const searchBox = await screen.findByPlaceholderText("Search title, artist, album");

    fireEvent.change(searchBox, { target: { value: "alpha" } });
    fireEvent.keyDown(searchBox, { key: "Enter", code: "Enter" });

    fireEvent.change(searchBox, { target: { value: "bravo" } });
    fireEvent.keyDown(searchBox, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Bravo")).toBeTruthy();
    });

    const fulfillAlphaSearch = resolveAlphaSearch;
    if (fulfillAlphaSearch) {
      fulfillAlphaSearch({
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
        ],
        nextCursor: null,
        total: 1,
        pageSize: 200,
      });
    }

    await waitFor(() => {
      expect(screen.getByText("Bravo")).toBeTruthy();
      expect(screen.queryByText("Alpha")).toBeNull();
    });
  });
});
