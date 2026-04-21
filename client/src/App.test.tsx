// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bootstrapAppMock = vi.fn();
const getAlbumMock = vi.fn();
const createConceptAlbumMock = vi.fn();
const createPlaylistMock = vi.fn();
const deleteConceptAlbumMock = vi.fn();
const deletePlaylistMock = vi.fn();
const getConceptAlbumMock = vi.fn();
const getPlaylistMock = vi.fn();
const getShellStateMock = vi.fn();
const handoffPlaylistToQueueMock = vi.fn();
const listConceptAlbumsMock = vi.fn();
const listPlaylistsMock = vi.fn();
const listAlbumsMock = vi.fn();
const loadPlaybackTrackMock = vi.fn();
const moveConceptAlbumEntryMock = vi.fn();
const movePlaylistEntryMock = vi.fn();
const replaceConceptAlbumEntriesMock = vi.fn();
const replacePlaylistEntriesMock = vi.fn();
const removeConceptAlbumEntryMock = vi.fn();
const removePlaylistEntryMock = vi.fn();
const queryLibraryMock = vi.fn();
const pickLibraryDirectoryMock = vi.fn();
const playbackActionMock = vi.fn();
const seekPlaybackMock = vi.fn();
const subscribePlaybackStateMock = vi.fn();
const resolveArtworkSourceMock = vi.fn();
const resolveTrackPlaybackSourceMock = vi.fn();
const scanLocalLibraryMock = vi.fn();
const updateConceptAlbumMock = vi.fn();
const updatePlaylistMock = vi.fn();
const addTrackToConceptAlbumMock = vi.fn();
const addTrackToPlaylistMock = vi.fn();
const mockAudioInstances: MockAudio[] = [];

vi.mock("./desktop", () => ({
  addTrackToConceptAlbum: (...args: unknown[]) => addTrackToConceptAlbumMock(...args),
  addTrackToPlaylist: (...args: unknown[]) => addTrackToPlaylistMock(...args),
  getAlbum: (...args: unknown[]) => getAlbumMock(...args),
  bootstrapApp: () => bootstrapAppMock(),
  createConceptAlbum: (...args: unknown[]) => createConceptAlbumMock(...args),
  createPlaylist: (...args: unknown[]) => createPlaylistMock(...args),
  deleteConceptAlbum: (...args: unknown[]) => deleteConceptAlbumMock(...args),
  deletePlaylist: (...args: unknown[]) => deletePlaylistMock(...args),
  getConceptAlbum: (...args: unknown[]) => getConceptAlbumMock(...args),
  getPlaylist: (...args: unknown[]) => getPlaylistMock(...args),
  getShellState: () => getShellStateMock(),
  handoffPlaylistToQueue: (...args: unknown[]) => handoffPlaylistToQueueMock(...args),
  listConceptAlbums: () => listConceptAlbumsMock(),
  listPlaylists: () => listPlaylistsMock(),
  listAlbums: (...args: unknown[]) => listAlbumsMock(...args),
  loadPlaybackTrack: (...args: unknown[]) => loadPlaybackTrackMock(...args),
  moveConceptAlbumEntry: (...args: unknown[]) => moveConceptAlbumEntryMock(...args),
  movePlaylistEntry: (...args: unknown[]) => movePlaylistEntryMock(...args),
  replaceConceptAlbumEntries: (...args: unknown[]) =>
    replaceConceptAlbumEntriesMock(...args),
  replacePlaylistEntries: (...args: unknown[]) => replacePlaylistEntriesMock(...args),
  removeConceptAlbumEntry: (...args: unknown[]) =>
    removeConceptAlbumEntryMock(...args),
  removePlaylistEntry: (...args: unknown[]) => removePlaylistEntryMock(...args),
  pickLibraryDirectory: (...args: unknown[]) => pickLibraryDirectoryMock(...args),
  queryLibrary: (...args: unknown[]) => queryLibraryMock(...args),
  playbackAction: (...args: unknown[]) => playbackActionMock(...args),
  seekPlayback: (...args: unknown[]) => seekPlaybackMock(...args),
  subscribePlaybackState: (...args: unknown[]) => subscribePlaybackStateMock(...args),
  resolveArtworkSource: (...args: unknown[]) => resolveArtworkSourceMock(...args),
  resolveTrackPlaybackSource: (...args: unknown[]) => resolveTrackPlaybackSourceMock(...args),
  scanLocalLibrary: (...args: unknown[]) => scanLocalLibraryMock(...args),
  updateConceptAlbum: (...args: unknown[]) => updateConceptAlbumMock(...args),
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
    getAlbumMock.mockReset();
    createConceptAlbumMock.mockReset();
    createPlaylistMock.mockReset();
    deleteConceptAlbumMock.mockReset();
    deletePlaylistMock.mockReset();
    getConceptAlbumMock.mockReset();
    getPlaylistMock.mockReset();
    getShellStateMock.mockReset();
    handoffPlaylistToQueueMock.mockReset();
    listConceptAlbumsMock.mockReset();
    listPlaylistsMock.mockReset();
    listAlbumsMock.mockReset();
    loadPlaybackTrackMock.mockReset();
    moveConceptAlbumEntryMock.mockReset();
    movePlaylistEntryMock.mockReset();
    replaceConceptAlbumEntriesMock.mockReset();
    replacePlaylistEntriesMock.mockReset();
    removeConceptAlbumEntryMock.mockReset();
    removePlaylistEntryMock.mockReset();
    queryLibraryMock.mockReset();
    pickLibraryDirectoryMock.mockReset();
    playbackActionMock.mockReset();
    seekPlaybackMock.mockReset();
    subscribePlaybackStateMock.mockReset();
    resolveArtworkSourceMock.mockReset();
    resolveTrackPlaybackSourceMock.mockReset();
    scanLocalLibraryMock.mockReset();
    updateConceptAlbumMock.mockReset();
    updatePlaylistMock.mockReset();
    addTrackToConceptAlbumMock.mockReset();
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
      appVersion: "1.5.1",
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
    listConceptAlbumsMock.mockResolvedValue([
      {
        id: "concept-album-1",
        title: "Night Archive",
        artist: "North",
        description: "city sequence",
        artworkKey: "night-cover.png",
        entryCount: 2,
        createdAt: "1700000100",
        updatedAt: "1700000200",
      },
    ]);
    listAlbumsMock.mockResolvedValue([
      {
        id: "album:signals:north",
        title: "Signals",
        artist: "North",
        trackCount: 1,
        totalDurationSeconds: 182,
        artworkKey: "alpha-cover.png",
      },
      {
        id: "album:horizons:south",
        title: "Horizons",
        artist: "South",
        trackCount: 1,
        totalDurationSeconds: 205,
        artworkKey: "bravo-cover.png",
      },
    ]);
    getAlbumMock.mockImplementation(async (albumId: string) => {
      if (albumId === "album:signals:north") {
        return {
          album: {
            id: "album:signals:north",
            title: "Signals",
            artist: "North",
            trackCount: 1,
            totalDurationSeconds: 182,
            artworkKey: "alpha-cover.png",
          },
          tracks: [
            {
              id: "track-1",
              title: "Alpha",
              artist: "North",
              advisory: null,
              durationSeconds: 182,
              artworkKey: "alpha-cover.png",
              extension: "mp3",
              trackNumber: 1,
              discNumber: 1,
            },
          ],
        };
      }

      return null;
    });
    getConceptAlbumMock.mockImplementation(async (conceptAlbumId: string) => {
      if (conceptAlbumId !== "concept-album-1") {
        return null;
      }

      return {
        conceptAlbum: {
          id: "concept-album-1",
          title: "Night Archive",
          artist: "North",
          description: "city sequence",
          artworkKey: "night-cover.png",
          entryCount: 2,
          createdAt: "1700000100",
          updatedAt: "1700000200",
        },
        entries: [
          {
            entryId: "concept-entry-1",
            conceptAlbumId: "concept-album-1",
            trackId: "track-1",
            position: 0,
            addedAt: "1700000100",
            updatedAt: "1700000100",
            title: "Alpha",
            artist: "North",
            album: "Signals",
            advisory: null,
            artworkKey: "alpha-cover.png",
            extension: "mp3",
            durationSeconds: 182,
            trackNumber: 1,
            discNumber: 1,
          },
          {
            entryId: "concept-entry-2",
            conceptAlbumId: "concept-album-1",
            trackId: "track-2",
            position: 1,
            addedAt: "1700000200",
            updatedAt: "1700000200",
            title: "Bravo",
            artist: "South",
            album: "Horizons",
            advisory: null,
            artworkKey: "bravo-cover.png",
            extension: "mp3",
            durationSeconds: 205,
            trackNumber: 2,
            discNumber: 1,
          },
        ],
      };
    });
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
    const primaryRoutes = within(screen.getByRole("navigation", { name: "primary routes" }));

    expect(screen.getByText("resona")).toBeTruthy();
    expect(primaryRoutes.getByRole("link", { name: /tracks/i })).toBeTruthy();
    expect(screen.getByText("Nothing playing")).toBeTruthy();
    expect(bootstrapAppMock).toHaveBeenCalledTimes(1);
    expect(getShellStateMock).toHaveBeenCalledTimes(1);
    expect(queryLibraryMock).toHaveBeenCalledTimes(1);
    expect(listPlaylistsMock).toHaveBeenCalledTimes(1);
  });

  it("opens playlist and concept album creation from the sidebar create menu", async () => {
    const { default: App } = await import("./App");
    render(<App />);

    await screen.findByText("desktop music utility");

    fireEvent.click(await screen.findByRole("button", { name: "Create collection" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /playlists/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Create playlist" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Create playlist" })).toBeNull();
    });

    fireEvent.click(await screen.findByRole("button", { name: "Create collection" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /concept albums/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Create concept album" })).toBeTruthy();
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

    fireEvent.click(
      within(screen.getByRole("navigation", { name: "primary routes" })).getByRole("link", {
        name: /tracks/i,
      }),
    );

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

    fireEvent.click(
      within(screen.getByRole("navigation", { name: "primary routes" })).getByRole("link", {
        name: /tracks/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Fresh Start")).toBeTruthy();
      expect(screen.getByText("Arrivals")).toBeTruthy();
    });
  });

  it("opens album detail routes from the tracks library search surface", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("./App");
    render(<App />);

    const searchBox = await screen.findByPlaceholderText("Search title, artist, album");
    fireEvent.change(searchBox, { target: { value: "signals" } });
    fireEvent.keyDown(searchBox, { key: "Enter", code: "Enter" });
    fireEvent.click(await screen.findByRole("link", { name: /signals/i }));

    await waitFor(() => {
      expect(getAlbumMock).toHaveBeenCalledWith("album:signals:north");
      expect(screen.getByRole("heading", { name: "Signals" })).toBeTruthy();
      expect(screen.getByText("Alpha")).toBeTruthy();
    });
  });

});
