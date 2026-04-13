import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const openMock = vi.fn();
const listenMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (filePath: string) => `asset://localhost/${encodeURIComponent(filePath)}`,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
}));

describe("desktop bootstrap bridge", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    openMock.mockReset();
    listenMock.mockReset();
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

  it("loads a playback track through the backend runtime contract", async () => {
    invokeMock.mockResolvedValueOnce({
      playback: {
        statusLabel: "Ready",
        transportLabel: "Ready",
        progressSeconds: 0,
        durationSeconds: 182,
        isPlaying: false,
        trackId: "track-1",
        trackTitle: "Alpha",
        trackArtist: "North",
        trackAlbum: "Signals",
      },
      source: {
        trackId: "track-1",
        localPath: "/Users/rujulw/Music/alpha.mp3",
        extension: "mp3",
      },
    });

    const { loadPlaybackTrack } = await import("./desktop");
    const payload = await loadPlaybackTrack("track-1");

    expect(invokeMock).toHaveBeenCalledWith("load_playback_track", { trackId: "track-1" });
    expect(payload?.source.assetUrl).toContain("asset://localhost/");
    expect(payload?.source.extension).toBe("mp3");
    expect(payload?.playback.trackTitle).toBe("Alpha");
  });

  it("reports timing updates through the playback runtime contract", async () => {
    invokeMock.mockResolvedValueOnce({
      statusLabel: "Playing",
      transportLabel: "Playing",
      progressSeconds: 41,
      durationSeconds: 182,
      isPlaying: true,
    });

    const { syncPlaybackTiming } = await import("./desktop");
    const payload = await syncPlaybackTiming(41, 182);

    expect(invokeMock).toHaveBeenCalledWith("sync_playback_timing", {
      progressSeconds: 41,
      durationSeconds: 182,
    });
    expect(payload.progressSeconds).toBe(41);
  });

  it("reports explicit seek updates through the playback runtime contract", async () => {
    invokeMock.mockResolvedValueOnce({
      statusLabel: "Paused",
      transportLabel: "Paused",
      progressSeconds: 0,
      durationSeconds: 182,
      isPlaying: false,
    });

    const { seekPlayback } = await import("./desktop");
    const payload = await seekPlayback(0);

    expect(invokeMock).toHaveBeenCalledWith("seek_playback", {
      positionSeconds: 0,
    });
    expect(payload.progressSeconds).toBe(0);
  });

  it("reports playback completion through the backend runtime contract", async () => {
    invokeMock.mockResolvedValueOnce({
      statusLabel: "Ended",
      transportLabel: "Ended",
      progressSeconds: 182,
      durationSeconds: 182,
      isPlaying: false,
    });

    const { completePlayback } = await import("./desktop");
    const payload = await completePlayback();

    expect(invokeMock).toHaveBeenCalledWith("complete_playback");
    expect(payload.transportLabel).toBe("Ended");
  });

  it("reports playback errors through the backend runtime contract", async () => {
    invokeMock.mockResolvedValueOnce({
      statusLabel: "Error",
      transportLabel: "Playback blocked",
      progressSeconds: 0,
      durationSeconds: 182,
      isPlaying: false,
    });

    const { reportPlaybackError } = await import("./desktop");
    const payload = await reportPlaybackError("Playback blocked");

    expect(invokeMock).toHaveBeenCalledWith("report_playback_error", {
      transportLabel: "Playback blocked",
    });
    expect(payload.statusLabel).toBe("Error");
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

  it("loads playlists through the command bridge", async () => {
    invokeMock.mockResolvedValueOnce([
      {
        id: "playlist-1",
        name: "Desk Set",
        description: "focused hours",
        artworkKey: null,
        entryCount: 1,
        createdAt: "1700000100",
        updatedAt: "1700000100",
      },
    ]);

    const { listPlaylists } = await import("./desktop");
    const payload = await listPlaylists();

    expect(invokeMock).toHaveBeenCalledWith("list_playlists");
    expect(payload[0].name).toBe("Desk Set");
  });

  it("creates and updates playlists through the command bridge", async () => {
    invokeMock
      .mockResolvedValueOnce({
        id: "playlist-1",
        name: "Desk Set",
        description: null,
        artworkKey: null,
        entryCount: 0,
        createdAt: "1700000100",
        updatedAt: "1700000100",
      })
      .mockResolvedValueOnce({
        id: "playlist-1",
        name: "Night Drive",
        description: "after midnight",
        artworkKey: "playlist-cover.png",
        entryCount: 0,
        createdAt: "1700000100",
        updatedAt: "1700000200",
      });

    const { createPlaylist, updatePlaylist } = await import("./desktop");
    const created = await createPlaylist("Desk Set");
    const updated = await updatePlaylist(
      "playlist-1",
      "Night Drive",
      "after midnight",
      "/Users/rujulw/Pictures/night-drive.png",
    );

    expect(invokeMock).toHaveBeenNthCalledWith(1, "create_playlist", {
      name: "Desk Set",
      description: null,
      artworkPath: null,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "update_playlist", {
      playlistId: "playlist-1",
      name: "Night Drive",
      description: "after midnight",
      artworkPath: "/Users/rujulw/Pictures/night-drive.png",
    });
    expect(created.id).toBe("playlist-1");
    expect(updated.name).toBe("Night Drive");
    expect(updated.artworkKey).toBe("playlist-cover.png");
  });

  it("normalizes empty playlist edit metadata in the command bridge payload", async () => {
    invokeMock.mockResolvedValueOnce({
      id: "playlist-1",
      name: "Night Drive",
      description: null,
      artworkKey: null,
      entryCount: 0,
      createdAt: "1700000100",
      updatedAt: "1700000200",
    });

    const { updatePlaylist } = await import("./desktop");
    await updatePlaylist("playlist-1", "Night Drive", "   ", "   ");

    expect(invokeMock).toHaveBeenCalledWith("update_playlist", {
      playlistId: "playlist-1",
      name: "Night Drive",
      description: null,
      artworkPath: null,
    });
  });

  it("does not hide playlist creation failures in the desktop runtime", async () => {
    invokeMock.mockRejectedValueOnce(new Error("no such table: playlists"));
    (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ =
      {};

    const { createPlaylist } = await import("./desktop");

    await expect(createPlaylist("Desk Set")).rejects.toThrow("no such table: playlists");
  });

  it("moves playlist entries through the command bridge", async () => {
    invokeMock.mockResolvedValueOnce({
      playlist: {
        id: "playlist-1",
        name: "Desk Set",
        description: null,
        entryCount: 2,
        createdAt: "1700000100",
        updatedAt: "1700000200",
      },
      entries: [],
    });

    const { movePlaylistEntry } = await import("./desktop");
    await movePlaylistEntry("playlist-1", "entry-2", 0);

    expect(invokeMock).toHaveBeenCalledWith("move_playlist_entry", {
      playlistId: "playlist-1",
      entryId: "entry-2",
      targetPosition: 0,
    });
  });

  it("hands off playlist playback through the command bridge", async () => {
    invokeMock.mockResolvedValueOnce({
      playback: {
        statusLabel: "Ready",
        transportLabel: "Ready",
        progressSeconds: 0,
        durationSeconds: 182,
        isPlaying: false,
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
      playlistId: "playlist-1",
      activeEntryId: "entry-2",
    });

    const { handoffPlaylistToQueue } = await import("./desktop");
    const payload = await handoffPlaylistToQueue("playlist-1", "entry-2");

    expect(invokeMock).toHaveBeenCalledWith("handoff_playlist_to_queue", {
      playlistId: "playlist-1",
      startEntryId: "entry-2",
    });
    expect(payload.queue.activeTrackId).toBe("track-2");
  });

  it("subscribes to backend playback state events", async () => {
    const unlisten = vi.fn();
    let handler:
      | ((event: { payload: {
          statusLabel: string;
          transportLabel: string;
          progressSeconds: number;
          durationSeconds: number;
        } }) => void)
      | undefined;

    listenMock.mockImplementationOnce(
      async (
        eventName: string,
        callback: (event: {
          payload: {
            statusLabel: string;
            transportLabel: string;
            progressSeconds: number;
            durationSeconds: number;
          };
        }) => void,
      ) => {
        expect(eventName).toBe("playback://state-changed");
        handler = callback;
        return unlisten;
      },
    );

    const onPlayback = vi.fn();
    const { subscribePlaybackState } = await import("./desktop");
    const detach = await subscribePlaybackState(onPlayback);

    handler?.({
      payload: {
        statusLabel: "Playing",
        transportLabel: "Playing",
        progressSeconds: 0,
        durationSeconds: 182,
      },
    });

    expect(onPlayback).toHaveBeenCalledWith({
      statusLabel: "Playing",
      transportLabel: "Playing",
      progressSeconds: 0,
      durationSeconds: 182,
    });
    expect(detach).toBe(unlisten);
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

  it("opens a native image picker for playlist covers", async () => {
    openMock.mockResolvedValueOnce("/Users/rujulw/Pictures/cover.png");

    const { pickPlaylistArtwork } = await import("./desktop");
    const payload = await pickPlaylistArtwork("/Users/rujulw/Pictures");

    expect(openMock).toHaveBeenCalledWith({
      title: "Choose playlist cover",
      directory: false,
      multiple: false,
      recursive: false,
      defaultPath: "/Users/rujulw/Pictures",
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp"],
        },
      ],
    });
    expect(payload).toBe("/Users/rujulw/Pictures/cover.png");
  });
});
