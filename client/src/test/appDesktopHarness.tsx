// @vitest-environment jsdom

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

export const desktopMocks = {
  addTrackToConceptAlbumMock: vi.fn(),
  getAlbumMock: vi.fn(),
  bootstrapAppMock: vi.fn(),
  createConceptAlbumMock: vi.fn(),
  createPlaylistMock: vi.fn(),
  deleteConceptAlbumMock: vi.fn(),
  deletePlaylistMock: vi.fn(),
  getConceptAlbumMock: vi.fn(),
  getPlaylistMock: vi.fn(),
  getShellStateMock: vi.fn(),
  listConceptAlbumsMock: vi.fn(),
  handoffPlaylistToQueueMock: vi.fn(),
  listPlaylistsMock: vi.fn(),
  listAlbumsMock: vi.fn(),
  loadPlaybackTrackMock: vi.fn(),
  moveConceptAlbumEntryMock: vi.fn(),
  movePlaylistEntryMock: vi.fn(),
  removeConceptAlbumEntryMock: vi.fn(),
  replacePlaylistEntriesMock: vi.fn(),
  replaceConceptAlbumEntriesMock: vi.fn(),
  removePlaylistEntryMock: vi.fn(),
  queryLibraryMock: vi.fn(),
  pickLibraryDirectoryMock: vi.fn(),
  playbackActionMock: vi.fn(),
  seekPlaybackMock: vi.fn(),
  subscribePlaybackStateMock: vi.fn(),
  resolveArtworkSourceMock: vi.fn(),
  resolveTrackPlaybackSourceMock: vi.fn(),
  scanLocalLibraryMock: vi.fn(),
  updateConceptAlbumMock: vi.fn(),
  updatePlaylistMock: vi.fn(),
  addTrackToPlaylistMock: vi.fn(),
  turnPlaylistToMixtapeMock: vi.fn(),
  listArtistsMock: vi.fn(),
  getArtistDetailMock: vi.fn(),
  getArtistsImagesDirMock: vi.fn(),
  setArtistsImagesDirMock: vi.fn(),
  pickArtistsImagesDirMock: vi.fn(),
  getArtistsProfileImagesDirMock: vi.fn(),
  setArtistsProfileImagesDirMock: vi.fn(),
  pickArtistsProfileImagesDirMock: vi.fn(),
  importSpotifyHistoryFolderMock: vi.fn(),
  pickSpotifyExportFolderMock: vi.fn(),
  mutateQueueMock: vi.fn(),
  reorderQueueMock: vi.fn(),
};

type PlaybackSnapshot = {
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

export class MockAudio extends EventTarget {
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

export const appDesktopState: {
  mockAudioInstances: MockAudio[];
  mockBackendPlayback: PlaybackSnapshot;
  playbackStateListener:
    | ((playback: PlaybackSnapshot) => void)
    | undefined;
} = {
  mockAudioInstances: [],
  mockBackendPlayback: {
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
  },
  playbackStateListener: undefined,
};

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (filePath: string) => `asset://localhost/${encodeURIComponent(filePath)}`,
  invoke: vi.fn(),
}));

vi.mock("../desktop", () => ({
  addTrackToConceptAlbum: (...args: unknown[]) => desktopMocks.addTrackToConceptAlbumMock(...args),
  addTrackToPlaylist: (...args: unknown[]) => desktopMocks.addTrackToPlaylistMock(...args),
  getAlbum: (...args: unknown[]) => desktopMocks.getAlbumMock(...args),
  bootstrapApp: () => desktopMocks.bootstrapAppMock(),
  createConceptAlbum: (...args: unknown[]) => desktopMocks.createConceptAlbumMock(...args),
  createPlaylist: (...args: unknown[]) => desktopMocks.createPlaylistMock(...args),
  deleteConceptAlbum: (...args: unknown[]) => desktopMocks.deleteConceptAlbumMock(...args),
  deletePlaylist: (...args: unknown[]) => desktopMocks.deletePlaylistMock(...args),
  getConceptAlbum: (...args: unknown[]) => desktopMocks.getConceptAlbumMock(...args),
  getPlaylist: (...args: unknown[]) => desktopMocks.getPlaylistMock(...args),
  getShellState: () => desktopMocks.getShellStateMock(),
  handoffPlaylistToQueue: (...args: unknown[]) => desktopMocks.handoffPlaylistToQueueMock(...args),
  listConceptAlbums: () => desktopMocks.listConceptAlbumsMock(),
  listPlaylists: () => desktopMocks.listPlaylistsMock(),
  listAlbums: (...args: unknown[]) => desktopMocks.listAlbumsMock(...args),
  loadPlaybackTrack: (...args: unknown[]) => desktopMocks.loadPlaybackTrackMock(...args),
  moveConceptAlbumEntry: (...args: unknown[]) => desktopMocks.moveConceptAlbumEntryMock(...args),
  movePlaylistEntry: (...args: unknown[]) => desktopMocks.movePlaylistEntryMock(...args),
  removeConceptAlbumEntry: (...args: unknown[]) =>
    desktopMocks.removeConceptAlbumEntryMock(...args),
  replaceConceptAlbumEntries: (...args: unknown[]) =>
    desktopMocks.replaceConceptAlbumEntriesMock(...args),
  replacePlaylistEntries: (...args: unknown[]) =>
    desktopMocks.replacePlaylistEntriesMock(...args),
  removePlaylistEntry: (...args: unknown[]) => desktopMocks.removePlaylistEntryMock(...args),
  pickLibraryDirectory: (...args: unknown[]) => desktopMocks.pickLibraryDirectoryMock(...args),
  queryLibrary: (...args: unknown[]) => desktopMocks.queryLibraryMock(...args),
  playbackAction: (...args: unknown[]) => desktopMocks.playbackActionMock(...args),
  seekPlayback: (...args: unknown[]) => desktopMocks.seekPlaybackMock(...args),
  subscribePlaybackState: (...args: unknown[]) => desktopMocks.subscribePlaybackStateMock(...args),
  resolveArtworkSource: (...args: unknown[]) => desktopMocks.resolveArtworkSourceMock(...args),
  resolveTrackPlaybackSource: (...args: unknown[]) =>
    desktopMocks.resolveTrackPlaybackSourceMock(...args),
  scanLocalLibrary: (...args: unknown[]) => desktopMocks.scanLocalLibraryMock(...args),
  updateConceptAlbum: (...args: unknown[]) => desktopMocks.updateConceptAlbumMock(...args),
  updatePlaylist: (...args: unknown[]) => desktopMocks.updatePlaylistMock(...args),
  turnPlaylistToMixtape: (...args: unknown[]) => desktopMocks.turnPlaylistToMixtapeMock(...args),
  listArtists: (...args: unknown[]) => desktopMocks.listArtistsMock(...args),
  getArtistDetail: (...args: unknown[]) => desktopMocks.getArtistDetailMock(...args),
  getArtistsImagesDir: () => desktopMocks.getArtistsImagesDirMock(),
  setArtistsImagesDir: (...args: unknown[]) => desktopMocks.setArtistsImagesDirMock(...args),
  pickArtistsImagesDir: (...args: unknown[]) => desktopMocks.pickArtistsImagesDirMock(...args),
  getArtistsProfileImagesDir: () => desktopMocks.getArtistsProfileImagesDirMock(),
  setArtistsProfileImagesDir: (...args: unknown[]) => desktopMocks.setArtistsProfileImagesDirMock(...args),
  pickArtistsProfileImagesDir: (...args: unknown[]) => desktopMocks.pickArtistsProfileImagesDirMock(...args),
  importSpotifyHistoryFolder: (...args: unknown[]) => desktopMocks.importSpotifyHistoryFolderMock(...args),
  pickSpotifyExportFolder: () => desktopMocks.pickSpotifyExportFolderMock(),
  mutateQueue: (...args: unknown[]) => desktopMocks.mutateQueueMock(...args),
  reorderQueue: (...args: unknown[]) => desktopMocks.reorderQueueMock(...args),
  listExcludedArtists: () => Promise.resolve([]),
  setPlaylistSidebarHidden: () => Promise.resolve(),
  setConceptAlbumSidebarHidden: () => Promise.resolve(),
  setArtistAnalyticsExcluded: () => Promise.resolve(),
}));

export function setupAppDesktopHarness() {
  beforeEach(() => {
    Object.values(desktopMocks).forEach((mock) => mock.mockReset());
    appDesktopState.mockAudioInstances.length = 0;
    appDesktopState.mockBackendPlayback = {
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
    appDesktopState.playbackStateListener = undefined;

    vi.stubGlobal(
      "Audio",
      vi.fn(() => {
        const instance = new MockAudio();
        appDesktopState.mockAudioInstances.push(instance);
        return instance;
      }),
    );

    desktopMocks.bootstrapAppMock.mockResolvedValue({
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
    desktopMocks.getShellStateMock.mockResolvedValue({
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
    desktopMocks.subscribePlaybackStateMock.mockImplementation(async (callback) => {
      appDesktopState.playbackStateListener = callback;
      return () => {
        appDesktopState.playbackStateListener = undefined;
      };
    });
    desktopMocks.listPlaylistsMock.mockResolvedValue([
      {
        id: "playlist-1",
        name: "Desk Set",
        description: "focused hours",
        entryCount: 1,
        isMixtape: false,
        createdAt: "1700000100",
        updatedAt: "1700000100",
      },
    ]);
    desktopMocks.listConceptAlbumsMock.mockResolvedValue([
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
    desktopMocks.listAlbumsMock.mockResolvedValue([
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
    desktopMocks.getAlbumMock.mockImplementation(async (albumId: string) => {
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

      if (albumId === "album:horizons:south") {
        return {
          album: {
            id: "album:horizons:south",
            title: "Horizons",
            artist: "South",
            trackCount: 1,
            totalDurationSeconds: 205,
            artworkKey: "bravo-cover.png",
          },
          tracks: [
            {
              id: "track-2",
              title: "Bravo",
              artist: "South",
              advisory: null,
              durationSeconds: 205,
              artworkKey: "bravo-cover.png",
              extension: "mp3",
              trackNumber: 1,
              discNumber: 1,
            },
          ],
        };
      }

      return null;
    });
    desktopMocks.getConceptAlbumMock.mockImplementation(async (conceptAlbumId: string) => {
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
    desktopMocks.getPlaylistMock.mockResolvedValue({
      playlist: {
        id: "playlist-1",
        name: "Desk Set",
        description: "focused hours",
        entryCount: 1,
        isMixtape: false,
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
    desktopMocks.queryLibraryMock.mockResolvedValue({
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
    desktopMocks.resolveTrackPlaybackSourceMock.mockImplementation(async (trackId: string) => ({
      trackId,
      localPath: `/Users/rujulw/Music/${trackId}.mp3`,
      assetUrl: `asset://localhost/${trackId}.mp3`,
    }));
    desktopMocks.loadPlaybackTrackMock.mockImplementation(async (trackId: string) => ({
      playback: (() => {
        appDesktopState.mockBackendPlayback = {
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
        appDesktopState.playbackStateListener?.(appDesktopState.mockBackendPlayback);
        return appDesktopState.mockBackendPlayback;
      })(),
      source: {
        trackId,
        localPath: `/Users/rujulw/Music/${trackId}.mp3`,
        assetUrl: `asset://localhost/${trackId}.mp3`,
      },
    }));
    desktopMocks.playbackActionMock.mockImplementation(
      async (action: "previous" | "toggle" | "next") => {
        if (action === "toggle") {
          if (!appDesktopState.mockBackendPlayback.trackId) {
            appDesktopState.mockBackendPlayback = {
              ...appDesktopState.mockBackendPlayback,
              transportLabel: "Play requested",
            };
            appDesktopState.playbackStateListener?.(appDesktopState.mockBackendPlayback);
            return appDesktopState.mockBackendPlayback;
          }

          appDesktopState.mockBackendPlayback = {
            ...appDesktopState.mockBackendPlayback,
            isPlaying: !appDesktopState.mockBackendPlayback.isPlaying,
            statusLabel: !appDesktopState.mockBackendPlayback.isPlaying ? "Playing" : "Ready",
            transportLabel: !appDesktopState.mockBackendPlayback.isPlaying ? "Playing" : "Paused",
          };
          appDesktopState.playbackStateListener?.(appDesktopState.mockBackendPlayback);
          return appDesktopState.mockBackendPlayback;
        }

        appDesktopState.mockBackendPlayback = {
          ...appDesktopState.mockBackendPlayback,
          transportLabel: action === "previous" ? "Previous unavailable" : "Next unavailable",
        };
        appDesktopState.playbackStateListener?.(appDesktopState.mockBackendPlayback);
        return appDesktopState.mockBackendPlayback;
      },
    );
    desktopMocks.seekPlaybackMock.mockImplementation(async (positionSeconds: number) => {
      appDesktopState.mockBackendPlayback = {
        ...appDesktopState.mockBackendPlayback,
        progressSeconds: positionSeconds,
        transportLabel: appDesktopState.mockBackendPlayback.isPlaying ? "Playing" : "Paused",
      };
      appDesktopState.playbackStateListener?.(appDesktopState.mockBackendPlayback);
      return appDesktopState.mockBackendPlayback;
    });
    desktopMocks.resolveArtworkSourceMock.mockImplementation(async (artworkKey: string) => ({
      artworkKey,
      localPath: `/Users/rujulw/Library/Application Support/resona/artwork/${artworkKey}`,
      assetUrl: `asset://localhost/${artworkKey}`,
    }));
    desktopMocks.pickLibraryDirectoryMock.mockResolvedValue("/Users/rujulw/Music");
    desktopMocks.createPlaylistMock.mockImplementation(async (name: string) => ({
      id: "playlist-2",
      name,
      description: null,
      entryCount: 0,
      createdAt: "1700000200",
      updatedAt: "1700000200",
    }));
    desktopMocks.updatePlaylistMock.mockImplementation(
      async (playlistId: string, name: string, description?: string | null) => ({
        id: playlistId,
        name,
        description: description ?? null,
        entryCount: 1,
        isMixtape: false,
        createdAt: "1700000100",
        updatedAt: "1700000200",
      }),
    );
    desktopMocks.deletePlaylistMock.mockResolvedValue(undefined);
    desktopMocks.addTrackToPlaylistMock.mockImplementation(
      async (
        playlistId: string,
        track: {
          id: string;
          title: string;
          artist: string | null;
          album: string | null;
          artworkKey: string | null;
          durationSeconds: number | null;
          extension?: string;
        },
      ) => ({
        playlist: {
          id: playlistId,
          name: "Desk Set",
          description: "focused hours",
          entryCount: 2,
          isMixtape: false,
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
      }),
    );
    desktopMocks.movePlaylistEntryMock.mockImplementation(
      async (playlistId: string, entryId: string, targetPosition: number) => ({
        playlist: {
          id: playlistId,
          name: "Desk Set",
          description: "focused hours",
          entryCount: 1,
          isMixtape: false,
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
      }),
    );
    desktopMocks.replacePlaylistEntriesMock.mockImplementation(
      async (
        playlistId: string,
        entries: Array<{ entryId?: string; trackId: string; position: number }>,
      ) => ({
        playlist: {
          id: playlistId,
          name: "Desk Set",
          description: "focused hours",
          entryCount: entries.length,
          isMixtape: false,
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
    desktopMocks.removePlaylistEntryMock.mockImplementation(
      async (playlistId: string, entryId: string) => ({
        playlist: {
          id: playlistId,
          name: "Desk Set",
          description: "focused hours",
          artworkKey: null,
          entryCount: 1,
          isMixtape: false,
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
      }),
    );
    desktopMocks.handoffPlaylistToQueueMock.mockImplementation(
      async (playlistId: string, startEntryId?: string | null) => ({
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
      }),
    );
    desktopMocks.listArtistsMock.mockResolvedValue([
      { name: "North", trackCount: 2 },
      { name: "South", trackCount: 1 },
    ]);
    desktopMocks.getArtistDetailMock.mockImplementation(async (artistName: string) => {
      if (artistName !== "North") return null;
      return {
        name: "North",
        trackCount: 2,
        imageConfig: null,
        albums: [
          {
            id: "album:signals:north",
            title: "Signals",
            year: 2022,
            artworkKey: "alpha-cover.png",
            trackCount: 2,
            kind: "album",
          },
        ],
        features: [],
        playlists: [],
      };
    });
    desktopMocks.getArtistsImagesDirMock.mockResolvedValue(null);
    desktopMocks.setArtistsImagesDirMock.mockResolvedValue(undefined);
    desktopMocks.pickArtistsImagesDirMock.mockResolvedValue(null);
    desktopMocks.getArtistsProfileImagesDirMock.mockResolvedValue(null);
    desktopMocks.setArtistsProfileImagesDirMock.mockResolvedValue(undefined);
    desktopMocks.pickArtistsProfileImagesDirMock.mockResolvedValue(null);
    desktopMocks.importSpotifyHistoryFolderMock.mockResolvedValue({
      filesProcessed: 0,
      matched: 0,
      ghostStored: 0,
      skippedShort: 0,
      skippedPodcast: 0,
      skippedNoTrackMetadata: 0,
      skippedDuplicate: 0,
    });
    desktopMocks.pickSpotifyExportFolderMock.mockResolvedValue(null);

    desktopMocks.turnPlaylistToMixtapeMock.mockImplementation(async (playlistId: string) => ({
      id: playlistId,
      name: "Desk Set",
      description: "focused hours",
      entryCount: 1,
      isMixtape: true,
      createdAt: "1700000100",
      updatedAt: "1700000500",
    }));

    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}
