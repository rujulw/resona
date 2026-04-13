// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bootstrapAppMock = vi.fn();
const createPlaylistMock = vi.fn();
const deletePlaylistMock = vi.fn();
const getPlaylistMock = vi.fn();
const getShellStateMock = vi.fn();
const handoffPlaylistToQueueMock = vi.fn();
const listPlaylistsMock = vi.fn();
const loadPlaybackTrackMock = vi.fn();
const movePlaylistEntryMock = vi.fn();
const replacePlaylistEntriesMock = vi.fn();
const removePlaylistEntryMock = vi.fn();
const queryLibraryMock = vi.fn();
const pickLibraryDirectoryMock = vi.fn();
const playbackActionMock = vi.fn();
const seekPlaybackMock = vi.fn();
const subscribePlaybackStateMock = vi.fn();
const resolveArtworkSourceMock = vi.fn();
const resolveTrackPlaybackSourceMock = vi.fn();
const scanLocalLibraryMock = vi.fn();
const updatePlaylistMock = vi.fn();
const addTrackToPlaylistMock = vi.fn();
const mockAudioInstances: MockAudio[] = [];

vi.mock("./desktop", () => ({
  addTrackToPlaylist: (...args: unknown[]) => addTrackToPlaylistMock(...args),
  bootstrapApp: () => bootstrapAppMock(),
  createPlaylist: (...args: unknown[]) => createPlaylistMock(...args),
  deletePlaylist: (...args: unknown[]) => deletePlaylistMock(...args),
  getPlaylist: (...args: unknown[]) => getPlaylistMock(...args),
  getShellState: () => getShellStateMock(),
  handoffPlaylistToQueue: (...args: unknown[]) => handoffPlaylistToQueueMock(...args),
  listPlaylists: () => listPlaylistsMock(),
  loadPlaybackTrack: (...args: unknown[]) => loadPlaybackTrackMock(...args),
  movePlaylistEntry: (...args: unknown[]) => movePlaylistEntryMock(...args),
  replacePlaylistEntries: (...args: unknown[]) => replacePlaylistEntriesMock(...args),
  removePlaylistEntry: (...args: unknown[]) => removePlaylistEntryMock(...args),
  pickLibraryDirectory: (...args: unknown[]) => pickLibraryDirectoryMock(...args),
  queryLibrary: (...args: unknown[]) => queryLibraryMock(...args),
  playbackAction: (...args: unknown[]) => playbackActionMock(...args),
  seekPlayback: (...args: unknown[]) => seekPlaybackMock(...args),
  subscribePlaybackState: (...args: unknown[]) => subscribePlaybackStateMock(...args),
  resolveArtworkSource: (...args: unknown[]) => resolveArtworkSourceMock(...args),
  resolveTrackPlaybackSource: (...args: unknown[]) => resolveTrackPlaybackSourceMock(...args),
  scanLocalLibrary: (...args: unknown[]) => scanLocalLibraryMock(...args),
  updatePlaylist: (...args: unknown[]) => updatePlaylistMock(...args),
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
    advisory?: boolean | null;
    durationSeconds: number | null;
    artworkKey: string | null;
    relativePath: string;
    extension?: string;
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
      outputOwner: string;
      trackId: string | null;
      trackTitle: string | null;
      trackArtist: string | null;
      trackAlbum: string | null;
      trackAdvisory?: boolean | null;
  };
  let playbackStateListener:
    | ((playback: {
        statusLabel: string;
        transportLabel: string;
        progressSeconds: number;
        durationSeconds: number;
        isPlaying: boolean;
        outputOwner: string;
        trackId: string | null;
        trackTitle: string | null;
        trackArtist: string | null;
        trackAlbum: string | null;
        trackAdvisory?: boolean | null;
      }) => void)
    | undefined;

  beforeEach(() => {
    bootstrapAppMock.mockReset();
    createPlaylistMock.mockReset();
    deletePlaylistMock.mockReset();
    getPlaylistMock.mockReset();
    getShellStateMock.mockReset();
    handoffPlaylistToQueueMock.mockReset();
    listPlaylistsMock.mockReset();
    loadPlaybackTrackMock.mockReset();
    movePlaylistEntryMock.mockReset();
    replacePlaylistEntriesMock.mockReset();
    removePlaylistEntryMock.mockReset();
    queryLibraryMock.mockReset();
    pickLibraryDirectoryMock.mockReset();
    playbackActionMock.mockReset();
    seekPlaybackMock.mockReset();
    subscribePlaybackStateMock.mockReset();
    resolveArtworkSourceMock.mockReset();
    resolveTrackPlaybackSourceMock.mockReset();
    scanLocalLibraryMock.mockReset();
    updatePlaylistMock.mockReset();
    addTrackToPlaylistMock.mockReset();
    mockAudioInstances.length = 0;
    mockBackendPlayback = {
      statusLabel: "Nothing playing",
      transportLabel: "Idle",
      progressSeconds: 0,
      durationSeconds: 0,
      isPlaying: false,
      outputOwner: "frontend",
      trackId: null,
      trackTitle: null,
      trackArtist: null,
      trackAlbum: null,
      trackAdvisory: null,
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
      appVersion: "1.3.0",
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
        outputOwner: "frontend",
      },
    });
    subscribePlaybackStateMock.mockImplementation(async (callback) => {
      playbackStateListener = callback;
      return () => {
        playbackStateListener = undefined;
      };
    });
    listPlaylistsMock.mockResolvedValue([
      {
        id: "playlist-1",
        name: "Desk Set",
        description: "focused hours",
        entryCount: 1,
        createdAt: "1700000100",
        updatedAt: "1700000100",
      },
    ]);
    getPlaylistMock.mockResolvedValue({
      playlist: {
        id: "playlist-1",
        name: "Desk Set",
        description: "focused hours",
        entryCount: 1,
        createdAt: "1700000100",
        updatedAt: "1700000100",
      },
      entries: [
        {
          entryId: "playlist-entry-1",
          playlistId: "playlist-1",
          trackId: "track-1",
          position: 0,
          addedAt: "1700000100",
          updatedAt: "1700000100",
          title: "Alpha",
          artist: "North",
          album: "Signals",
          artworkKey: "alpha-cover.png",
          extension: "mp3",
          durationSeconds: 182,
        },
      ],
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
          outputOwner: "rust",
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
    seekPlaybackMock.mockImplementation(async (positionSeconds: number) => {
      mockBackendPlayback = {
        ...mockBackendPlayback,
        progressSeconds: positionSeconds,
        transportLabel: mockBackendPlayback.isPlaying ? "Playing" : "Paused",
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
    createPlaylistMock.mockImplementation(async (name: string) => ({
      id: "playlist-2",
      name,
      description: null,
      entryCount: 0,
      createdAt: "1700000200",
      updatedAt: "1700000200",
    }));
    updatePlaylistMock.mockImplementation(
      async (playlistId: string, name: string, description?: string | null) => ({
        id: playlistId,
        name,
        description: description ?? null,
        entryCount: 1,
        createdAt: "1700000100",
        updatedAt: "1700000200",
      }),
    );
    deletePlaylistMock.mockResolvedValue(undefined);
    addTrackToPlaylistMock.mockImplementation(async (playlistId: string, track: { id: string; title: string; artist: string | null; album: string | null; artworkKey: string | null; durationSeconds: number | null; extension?: string }) => ({
      playlist: {
        id: playlistId,
        name: "Desk Set",
        description: "focused hours",
        entryCount: 2,
        createdAt: "1700000100",
        updatedAt: "1700000300",
      },
      entries: [
        {
          entryId: "playlist-entry-1",
          playlistId,
          trackId: "track-1",
          position: 0,
          addedAt: "1700000100",
          updatedAt: "1700000100",
          title: "Alpha",
          artist: "North",
          album: "Signals",
          artworkKey: "alpha-cover.png",
          extension: "mp3",
          durationSeconds: 182,
        },
        {
          entryId: "playlist-entry-2",
          playlistId,
          trackId: track.id,
          position: 1,
          addedAt: "1700000300",
          updatedAt: "1700000300",
          title: track.title,
          artist: track.artist,
          album: track.album,
          artworkKey: track.artworkKey,
          extension: track.extension,
          durationSeconds: track.durationSeconds,
        },
      ],
    }));
    movePlaylistEntryMock.mockImplementation(async (playlistId: string, entryId: string, targetPosition: number) => ({
      playlist: {
        id: playlistId,
        name: "Desk Set",
        description: "focused hours",
        entryCount: 1,
        createdAt: "1700000100",
        updatedAt: "1700000400",
      },
      entries: [
        {
          entryId,
          playlistId,
          trackId: "track-1",
          position: targetPosition,
          addedAt: "1700000100",
          updatedAt: "1700000400",
          title: "Alpha",
          artist: "North",
          album: "Signals",
          artworkKey: "alpha-cover.png",
          extension: "mp3",
          durationSeconds: 182,
        },
      ],
    }));
    replacePlaylistEntriesMock.mockImplementation(
      async (
        playlistId: string,
        entries: Array<{ entryId?: string; trackId: string; position: number }>,
      ) => ({
        playlist: {
          id: playlistId,
          name: "Desk Set",
          description: "focused hours",
          entryCount: entries.length,
          createdAt: "1700000100",
          updatedAt: "1700000400",
        },
        entries: entries.map((entry, index) => ({
          entryId: entry.entryId ?? `playlist-entry-${index + 1}`,
          playlistId,
          trackId: entry.trackId,
          position: index,
          addedAt: "1700000100",
          updatedAt: "1700000400",
          title: entry.trackId === "track-2" ? "Bravo" : "Alpha",
          artist: entry.trackId === "track-2" ? "South" : "North",
          album: entry.trackId === "track-2" ? "Horizons" : "Signals",
          artworkKey: entry.trackId === "track-2" ? "bravo-cover.png" : "alpha-cover.png",
          extension: "mp3",
          durationSeconds: entry.trackId === "track-2" ? 205 : 182,
        })),
      }),
    );
    removePlaylistEntryMock.mockImplementation(async (playlistId: string, entryId: string) => ({
      playlist: {
        id: playlistId,
        name: "Desk Set",
        description: "focused hours",
        artworkKey: null,
        entryCount: 1,
        createdAt: "1700000100",
        updatedAt: "1700000400",
      },
      entries: [
        {
          entryId: "playlist-entry-2",
          playlistId,
          trackId: "track-2",
          position: 0,
          addedAt: "1700000100",
          updatedAt: "1700000400",
          title: entryId === "playlist-entry-1" ? "Bravo" : "Alpha",
          artist: entryId === "playlist-entry-1" ? "South" : "North",
          album: entryId === "playlist-entry-1" ? "Horizons" : "Signals",
          artworkKey: entryId === "playlist-entry-1" ? "bravo-cover.png" : "alpha-cover.png",
          extension: "mp3",
          durationSeconds: 205,
        },
      ],
    }));
    handoffPlaylistToQueueMock.mockImplementation(async (playlistId: string, startEntryId?: string | null) => ({
      playback: {
        statusLabel: "Ready",
        transportLabel: "Ready",
        progressSeconds: 0,
        durationSeconds: 205,
        isPlaying: false,
        outputOwner: "rust",
        trackId: "track-2",
        trackTitle: "Bravo",
        trackArtist: "South",
        trackAlbum: "Horizons",
      },
      queue: {
        trackIds: ["track-1", "track-2"],
        activeTrackId: "track-2",
        sourceLabel: "playlist-handoff",
      },
      playlistId,
      activeEntryId: startEntryId ?? "playlist-entry-1",
    }));

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
    expect(listPlaylistsMock).toHaveBeenCalledTimes(1);
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

  it("renders playlist detail flows for select delete reorder playback and add-track", async () => {
    window.history.replaceState({}, "", "/playlists/playlist-1");
    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { default: App } = await import("./App");

    render(<App />);

    await screen.findByRole("heading", { name: "Desk Set" });
    expect(getPlaylistMock).toHaveBeenCalledWith("playlist-1");

    fireEvent.click(screen.getAllByRole("button", { name: /add/i })[1]);
    await waitFor(() => {
      expect(addTrackToPlaylistMock).toHaveBeenCalled();
    });
    await screen.findByLabelText(/play bravo/i);

    fireEvent.click(screen.getByLabelText(/play bravo/i));
    await waitFor(() => {
      expect(handoffPlaylistToQueueMock).toHaveBeenCalledWith(
        "playlist-1",
        "playlist-entry-2",
      );
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: /select alpha/i }));
    await waitFor(() => {
      expect(handoffPlaylistToQueueMock).toHaveBeenCalledWith(
        "playlist-1",
        "playlist-entry-1",
      );
    });

    fireEvent.click(screen.getByLabelText(/move alpha down/i));
    await waitFor(() => {
      expect(movePlaylistEntryMock).toHaveBeenCalledWith(
        "playlist-1",
        "playlist-entry-1",
        1,
      );
    });

    const alphaRow = screen.getByRole("button", { name: /select alpha/i });
    fireEvent.click(alphaRow);
    expect(alphaRow.getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(alphaRow, {
      key: "Backspace",
    });
    await waitFor(() => {
      expect(removePlaylistEntryMock).toHaveBeenCalledWith(
        "playlist-1",
        "playlist-entry-1",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /delete playlist/i }));
    await waitFor(() => {
      expect(deletePlaylistMock).toHaveBeenCalledWith("playlist-1");
    });

    confirmMock.mockRestore();
  });

  it("smoke-covers the playlist route shell with saved order handoff controls and dialog creation", async () => {
    window.history.replaceState({}, "", "/playlists/playlist-1");
    const { default: App } = await import("./App");

    render(<App />);

    await screen.findByRole("heading", { name: "Desk Set" });

    expect(screen.getByText("saved order")).toBeTruthy();
    expect(screen.getByText("library handoff")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search title, artist, album")).toBeTruthy();
    expect(screen.getByRole("button", { name: /create playlist/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /play playlist/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete playlist/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /select alpha/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /create playlist/i }));
    expect(screen.getByRole("dialog", { name: /create playlist/i })).toBeTruthy();
  });

  it("edits playlist metadata from the playlist detail header", async () => {
    window.history.replaceState({}, "", "/playlists/playlist-1");
    const { default: App } = await import("./App");

    render(<App />);

    await screen.findByRole("heading", { name: "Desk Set" });

    fireEvent.click(screen.getByRole("button", { name: /edit playlist/i }));
    const editDialog = screen.getByRole("dialog", { name: /edit playlist/i });
    fireEvent.change(within(editDialog).getByLabelText("playlist name"), {
      target: { value: "Night Drive" },
    });
    fireEvent.change(within(editDialog).getByLabelText("description"), {
      target: { value: "after midnight" },
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updatePlaylistMock).toHaveBeenCalledWith(
        "playlist-1",
        "Night Drive",
        "after midnight",
        null,
      );
    });
  });

  it("persists edited playlist metadata after the dialog saves", async () => {
    window.history.replaceState({}, "", "/playlists/playlist-1");
    listPlaylistsMock.mockReset();
    getPlaylistMock.mockReset();
    updatePlaylistMock.mockReset();

    let currentPlaylist: {
      id: string;
      name: string;
      description: string | null;
      artworkKey: string | null;
      entryCount: number;
      createdAt: string;
      updatedAt: string;
    } = {
      id: "playlist-1",
      name: "Desk Set",
      description: "focused hours",
      artworkKey: "desk-set.png",
      entryCount: 1,
      createdAt: "1700000100",
      updatedAt: "1700000100",
    };

    listPlaylistsMock.mockImplementation(async () => [
      {
        id: currentPlaylist.id,
        name: currentPlaylist.name,
        description: currentPlaylist.description,
        artworkKey: currentPlaylist.artworkKey,
        entryCount: currentPlaylist.entryCount,
        createdAt: currentPlaylist.createdAt,
        updatedAt: currentPlaylist.updatedAt,
      },
    ]);
    getPlaylistMock.mockImplementation(async () => ({
      playlist: {
        id: currentPlaylist.id,
        name: currentPlaylist.name,
        description: currentPlaylist.description,
        artworkKey: currentPlaylist.artworkKey,
        entryCount: currentPlaylist.entryCount,
        createdAt: currentPlaylist.createdAt,
        updatedAt: currentPlaylist.updatedAt,
      },
      entries: [
        {
          entryId: "playlist-entry-1",
          playlistId: currentPlaylist.id,
          trackId: "track-1",
          position: 0,
          addedAt: "1700000100",
          updatedAt: currentPlaylist.updatedAt,
          title: "Alpha",
          artist: "North",
          album: "Signals",
          artworkKey: "alpha-cover.png",
          extension: "mp3",
          durationSeconds: 182,
        },
      ],
    }));
    updatePlaylistMock.mockImplementation(
      async (
        playlistId: string,
        name: string,
        description?: string | null,
        artworkPath?: string | null,
      ) => {
        currentPlaylist = {
          ...currentPlaylist,
          id: playlistId,
          name,
          description: description ?? null,
          artworkKey: artworkPath ? "night-drive.png" : currentPlaylist.artworkKey,
          updatedAt: "1700000200",
        };

        return {
          id: currentPlaylist.id,
          name: currentPlaylist.name,
          description: currentPlaylist.description,
          artworkKey: currentPlaylist.artworkKey,
          entryCount: currentPlaylist.entryCount,
          createdAt: currentPlaylist.createdAt,
          updatedAt: currentPlaylist.updatedAt,
        };
      },
    );

    const { default: App } = await import("./App");
    render(<App />);

    await screen.findByRole("heading", { name: "Desk Set" });

    fireEvent.click(screen.getByRole("button", { name: /edit playlist/i }));
    const editDialog = screen.getByRole("dialog", { name: /edit playlist/i });
    expect(
      (within(editDialog).getByLabelText("playlist name") as HTMLInputElement).value,
    ).toBe("Desk Set");
    expect(
      (within(editDialog).getByLabelText("description") as HTMLTextAreaElement).value,
    ).toBe("focused hours");

    fireEvent.change(within(editDialog).getByLabelText("playlist name"), {
      target: { value: "Night Drive" },
    });
    fireEvent.change(within(editDialog).getByLabelText("description"), {
      target: { value: "after midnight" },
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: /save changes/i }));

    await screen.findByRole("heading", { name: "Night Drive" });
    expect(screen.getByText("after midnight")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /edit playlist/i }));
    const reopenedDialog = screen.getByRole("dialog", { name: /edit playlist/i });
    expect(
      (within(reopenedDialog).getByLabelText("playlist name") as HTMLInputElement).value,
    ).toBe("Night Drive");
    expect(
      (within(reopenedDialog).getByLabelText("description") as HTMLTextAreaElement).value,
    ).toBe("after midnight");
  });

  it("creates a playlist from the empty playlists state without using a native prompt", async () => {
    window.history.replaceState({}, "", "/playlists");
    listPlaylistsMock.mockReset();
    getPlaylistMock.mockReset();
    createPlaylistMock.mockReset();

    listPlaylistsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "playlist-2",
          name: "Late Night Mix",
          description: null,
          entryCount: 0,
          createdAt: "1700000200",
          updatedAt: "1700000200",
        },
      ]);
    getPlaylistMock.mockResolvedValue({
      playlist: {
        id: "playlist-2",
        name: "Late Night Mix",
        description: null,
        entryCount: 0,
        createdAt: "1700000200",
        updatedAt: "1700000200",
      },
      entries: [],
    });
    createPlaylistMock.mockResolvedValue({
      id: "playlist-2",
      name: "Late Night Mix",
      description: null,
      entryCount: 0,
      createdAt: "1700000200",
      updatedAt: "1700000200",
    });

    const { default: App } = await import("./App");
    render(<App />);

    await screen.findByText("no playlists yet");

    fireEvent.click(screen.getByRole("button", { name: /create playlist/i }));
    const createDialog = screen.getByRole("dialog", { name: /create playlist/i });
    fireEvent.change(within(createDialog).getByLabelText("playlist name"), {
      target: { value: "Late Night Mix" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: /^create playlist$/i }));

    await waitFor(() => {
      expect(createPlaylistMock).toHaveBeenCalledWith("Late Night Mix", null, null);
      expect(getPlaylistMock).toHaveBeenCalledWith("playlist-2");
    });
  });

  it("creates a playlist from the playlist detail view", async () => {
    window.history.replaceState({}, "", "/playlists/playlist-1");
    createPlaylistMock.mockReset();
    listPlaylistsMock.mockReset();
    getPlaylistMock.mockReset();

    listPlaylistsMock
      .mockResolvedValueOnce([
        {
          id: "playlist-1",
          name: "Road Trip",
          description: null,
          entryCount: 1,
          createdAt: "1700000000",
          updatedAt: "1700000000",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "playlist-1",
          name: "Road Trip",
          description: null,
          entryCount: 1,
          createdAt: "1700000000",
          updatedAt: "1700000000",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "playlist-1",
          name: "Road Trip",
          description: null,
          entryCount: 1,
          createdAt: "1700000000",
          updatedAt: "1700000000",
        },
        {
          id: "playlist-2",
          name: "Late Night Mix",
          description: null,
          entryCount: 0,
          createdAt: "1700000200",
          updatedAt: "1700000200",
        },
      ])
      .mockResolvedValue([
        {
          id: "playlist-1",
          name: "Road Trip",
          description: null,
          entryCount: 1,
          createdAt: "1700000000",
          updatedAt: "1700000000",
        },
        {
          id: "playlist-2",
          name: "Late Night Mix",
          description: null,
          entryCount: 0,
          createdAt: "1700000200",
          updatedAt: "1700000200",
        },
      ]);
    getPlaylistMock
      .mockResolvedValueOnce({
        playlist: {
          id: "playlist-1",
          name: "Road Trip",
          description: null,
          entryCount: 1,
          createdAt: "1700000000",
          updatedAt: "1700000000",
        },
        entries: [
          {
            entryId: "playlist-entry-1",
            playlistId: "playlist-1",
            trackId: "track-1",
            position: 0,
            title: "Northbound",
            artist: "Sample Artist",
            album: "Signals",
            artworkKey: null,
            durationSeconds: 215,
          },
        ],
      })
      .mockResolvedValueOnce({
        playlist: {
          id: "playlist-2",
          name: "Late Night Mix",
          description: null,
          entryCount: 0,
          createdAt: "1700000200",
          updatedAt: "1700000200",
        },
        entries: [],
      });
    createPlaylistMock.mockResolvedValue({
      id: "playlist-2",
      name: "Late Night Mix",
      description: null,
      entryCount: 0,
      createdAt: "1700000200",
      updatedAt: "1700000200",
    });

    const { default: App } = await import("./App");
    render(<App />);

    await screen.findByRole("heading", { name: "Road Trip" });

    fireEvent.click(screen.getByRole("button", { name: /create playlist/i }));
    const createDialog = screen.getByRole("dialog", { name: /create playlist/i });
    fireEvent.change(within(createDialog).getByLabelText("playlist name"), {
      target: { value: "Late Night Mix" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: /^create playlist$/i }));

    await waitFor(() => {
      expect(createPlaylistMock).toHaveBeenCalledWith("Late Night Mix", null, null);
      expect(getPlaylistMock).toHaveBeenCalledWith("playlist-2");
    });
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

  it("renders advisory E badges in the library and playback bar", async () => {
    window.history.replaceState({}, "", "/tracks");

    queryLibraryMock.mockResolvedValueOnce({
      items: [
        {
          id: "track-1",
          title: "Alpha",
          artist: "North",
          album: "Signals",
          advisory: true,
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
    loadPlaybackTrackMock.mockImplementationOnce(async (trackId: string) => ({
      playback: (() => {
        mockBackendPlayback = {
          statusLabel: "Ready",
          transportLabel: "Ready",
          progressSeconds: 0,
          durationSeconds: 182,
          isPlaying: false,
          outputOwner: "rust",
          trackId,
          trackTitle: "Alpha",
          trackArtist: "North",
          trackAlbum: "Signals",
          trackAdvisory: true,
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

    const { default: App } = await import("./App");
    render(<App />);

    await screen.findByRole("button", { name: "Select Alpha" });
    expect(screen.getAllByText("E").length).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(screen.getAllByText("E").length).toBeGreaterThanOrEqual(2);
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });
  });

  it("smoke-covers explicit metadata shell rendering without badging clean or unknown tracks", async () => {
    window.history.replaceState({}, "", "/tracks");

    queryLibraryMock.mockResolvedValueOnce({
      items: [
        {
          id: "track-1",
          title: "Alpha",
          artist: "North",
          album: "Signals",
          advisory: true,
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
          advisory: false,
          durationSeconds: 205,
          artworkKey: "bravo-cover.png",
          relativePath: "bravo.mp3",
          sourceStatus: "local-only",
          cacheState: "none",
          analysisStatus: "pending",
          indexedAt: "1700000100",
        },
        {
          id: "track-3",
          title: "Charlie",
          artist: "East",
          album: "Quiet",
          advisory: null,
          durationSeconds: 199,
          artworkKey: null,
          relativePath: "charlie.mp3",
          sourceStatus: "local-only",
          cacheState: "none",
          analysisStatus: "pending",
          indexedAt: "1700000200",
        },
      ],
      nextCursor: null,
      total: 3,
      pageSize: 200,
    });
    loadPlaybackTrackMock.mockImplementationOnce(async (trackId: string) => ({
      playback: (() => {
        mockBackendPlayback = {
          statusLabel: "Ready",
          transportLabel: "Ready",
          progressSeconds: 0,
          durationSeconds: 182,
          isPlaying: false,
          outputOwner: "rust",
          trackId,
          trackTitle: "Alpha",
          trackArtist: "North",
          trackAlbum: "Signals",
          trackAdvisory: true,
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

    const { default: App } = await import("./App");
    render(<App />);

    await screen.findByRole("button", { name: "Select Alpha" });
    expect(screen.getAllByText("E")).toHaveLength(1);
    expect(screen.getByText("Bravo")).toBeTruthy();
    expect(screen.getByText("Charlie")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(screen.getAllByText("E")).toHaveLength(2);
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

    mockBackendPlayback = {
      ...mockBackendPlayback,
      statusLabel: "Ended",
      transportLabel: "Ended",
      progressSeconds: 182,
      durationSeconds: 182,
      isPlaying: false,
    };
    playbackStateListener?.(mockBackendPlayback);

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

  it("covers flac import metadata playback and queue behavior", async () => {
    window.history.replaceState({}, "", "/tracks");
    queryLibraryMock.mockReset();
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
          extension: "mp3",
          sourceStatus: "local-only",
          cacheState: "none",
          analysisStatus: "pending",
          indexedAt: "1700000000",
        },
        {
          id: "track-2",
          title: "Signal",
          artist: "North",
          album: "Frames",
          durationSeconds: 192,
          artworkKey: "signal-cover.png",
          relativePath: "signal.flac",
          extension: "flac",
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
    loadPlaybackTrackMock.mockImplementation(async (trackId: string) => ({
      playback: (() => {
        mockBackendPlayback = {
          statusLabel: "Ready",
          transportLabel: "Ready",
          progressSeconds: 0,
          durationSeconds: trackId === "track-2" ? 192 : 182,
          isPlaying: false,
          outputOwner: "rust",
          trackId,
          trackTitle: trackId === "track-2" ? "Signal" : "Alpha",
          trackArtist: "North",
          trackAlbum: trackId === "track-2" ? "Frames" : "Signals",
        };
        playbackStateListener?.(mockBackendPlayback);
        return mockBackendPlayback;
      })(),
      source: {
        trackId,
        localPath:
          trackId === "track-2"
            ? "/Users/rujulw/Music/track-2.flac"
            : "/Users/rujulw/Music/track-1.mp3",
        extension: trackId === "track-2" ? "flac" : "mp3",
        assetUrl:
          trackId === "track-2"
            ? "asset://localhost/track-2.flac"
            : "asset://localhost/track-1.mp3",
      },
    }));

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Signal" }));

    await waitFor(() => {
      expect(loadPlaybackTrackMock).toHaveBeenCalledWith("track-2");
      expect(
        screen.getByRole("button", { name: "Select Signal" }).getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
      expect(screen.getAllByText("Signal").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Frames").length).toBeGreaterThan(0);
      expect(screen.getAllByText("3:12").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("link", { name: /queue/i }));

    await waitFor(() => {
      expect(screen.getByText("now playing")).toBeTruthy();
      expect(screen.getAllByText("Signal").length).toBeGreaterThan(0);
      expect(screen.getAllByText("North").length).toBeGreaterThan(0);
      expect(screen.getByText("0 waiting")).toBeTruthy();
      expect(
        screen.getByText("No additional indexed tracks are queued after the current selection."),
      ).toBeTruthy();
    });
  });

  it("renders progress labels from backend playback snapshots", async () => {
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

    mockBackendPlayback = {
      ...mockBackendPlayback,
      progressSeconds: 41,
      durationSeconds: 182,
      isPlaying: true,
      statusLabel: "Playing",
      transportLabel: "Playing",
    };
    playbackStateListener?.(mockBackendPlayback);

    await waitFor(() => {
      expect(screen.getByText("0:41")).toBeTruthy();
      expect(screen.getAllByText("3:02").length).toBeGreaterThan(0);
    });
  });

  it("renders backend-owned pause snapshots without a local shell playback mutation", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });

    mockBackendPlayback = {
      ...mockBackendPlayback,
      isPlaying: false,
      statusLabel: "Paused",
      transportLabel: "Paused",
      progressSeconds: 17,
    };
    playbackStateListener?.(mockBackendPlayback);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Play playback" })).toBeTruthy();
      expect(screen.getByText("0:17")).toBeTruthy();
    });
  });

  it("covers native playback launch play seek pause and completion through backend snapshots", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
      expect(
        screen.getByRole("button", { name: "Select Alpha" }).getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
      expect(screen.getByText("0:00")).toBeTruthy();
      expect(mockBackendPlayback.outputOwner).toBe("rust");
    });

    mockBackendPlayback = {
      ...mockBackendPlayback,
      statusLabel: "Playing",
      transportLabel: "Playing",
      progressSeconds: 73,
      durationSeconds: 182,
      isPlaying: true,
      outputOwner: "rust",
    };
    playbackStateListener?.(mockBackendPlayback);

    await waitFor(() => {
      expect(screen.getByText("1:13")).toBeTruthy();
      expect(screen.getAllByText("3:02").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Pause playback" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Play playback" })).toBeTruthy();
      expect(mockBackendPlayback.transportLabel).toBe("Paused");
    });

    mockBackendPlayback = {
      ...mockBackendPlayback,
      statusLabel: "Ended",
      transportLabel: "Ended",
      progressSeconds: 182,
      durationSeconds: 182,
      isPlaying: false,
      outputOwner: "rust",
    };
    playbackStateListener?.(mockBackendPlayback);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Play playback" })).toBeTruthy();
      expect(screen.getAllByText("3:02").length).toBeGreaterThan(0);
    });
  });

  it("seeks playback from the progress control", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));

    const progressControl = () => screen.getByRole("button", { name: "Seek playback" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
      expect(progressControl()).toBeTruthy();
    });

    Object.defineProperty(progressControl(), "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          left: 0,
          width: 182,
        }) as DOMRect,
    });

    fireEvent.click(progressControl(), { clientX: 91 });

    await waitFor(() => {
      expect(seekPlaybackMock).toHaveBeenCalledWith(91);
      expect(screen.getByText("1:31")).toBeTruthy();
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

    mockBackendPlayback = {
      ...mockBackendPlayback,
      progressSeconds: 12,
      isPlaying: true,
      statusLabel: "Playing",
      transportLabel: "Playing",
    };
    playbackStateListener?.(mockBackendPlayback);

    await waitFor(() => {
      expect(screen.getByText("0:12")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Previous track" }));

    await waitFor(() => {
      expect(seekPlaybackMock).toHaveBeenCalledWith(0);
      expect(mockBackendPlayback.progressSeconds).toBe(0);
      expect(
        screen.getByRole("button", { name: "Select Alpha" }).getAttribute("aria-pressed"),
      ).toBe("true");
    });
  });

  it("renders backend-owned ended and error snapshots from backend playback events", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(mockAudioInstances.length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });

    mockBackendPlayback = {
      ...mockBackendPlayback,
      statusLabel: "Ended",
      transportLabel: "Ended",
      progressSeconds: 182,
      durationSeconds: 182,
      isPlaying: false,
    };
    playbackStateListener?.(mockBackendPlayback);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Play playback" })).toBeTruthy();
      expect(screen.getAllByText("3:02").length).toBeGreaterThan(0);
    });

    mockBackendPlayback = {
      ...mockBackendPlayback,
      statusLabel: "Error",
      transportLabel: "Playback error",
      isPlaying: false,
    };
    playbackStateListener?.(mockBackendPlayback);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Play playback" })).toBeTruthy();
      expect(screen.getAllByText("3:02").length).toBeGreaterThan(0);
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
      expect(screen.getByText("Scan finished for Empty Root, but no supported audio files were found.")).toBeTruthy();
      expect(screen.getByText("found")).toBeTruthy();
      expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("link", { name: /tracks/i }));

    await waitFor(() => {
      expect(screen.getByText("No audio files found in Empty Root.")).toBeTruthy();
      expect(
        screen.getByText(
          "The recursive scan completed, but that root did not contain any supported audio files in the selected folder tree.",
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
                  outputOwner: "rust",
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
            outputOwner: "rust",
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
