import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe("desktop playlist bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    delete (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    delete (globalThis as typeof globalThis & { __TAURI__?: unknown }).__TAURI__;
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

    const { listPlaylists } = await import("./playlists");
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

    const { createPlaylist, updatePlaylist } = await import("./playlists");
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

    const { updatePlaylist } = await import("./playlists");
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

    const { createPlaylist } = await import("./playlists");

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

    const { movePlaylistEntry } = await import("./playlists");
    await movePlaylistEntry("playlist-1", "entry-2", 0);

    expect(invokeMock).toHaveBeenCalledWith("move_playlist_entry", {
      playlistId: "playlist-1",
      entryId: "entry-2",
      targetPosition: 0,
    });
  });

  it("replaces playlist entries through the command bridge", async () => {
    invokeMock.mockResolvedValueOnce({
      playlist: {
        id: "playlist-1",
        name: "Desk Set",
        description: null,
        artworkKey: null,
        entryCount: 2,
        createdAt: "1700000100",
        updatedAt: "1700000200",
      },
      entries: [],
    });

    const { replacePlaylistEntries } = await import("./playlists");
    await replacePlaylistEntries("playlist-1", [
      { entryId: "entry-2", trackId: "track-2", position: 0 },
      { entryId: "entry-1", trackId: "track-1", position: 1 },
    ]);

    expect(invokeMock).toHaveBeenCalledWith("replace_playlist_entries", {
      playlistId: "playlist-1",
      entries: [
        { entryId: "entry-2", trackId: "track-2", position: 0 },
        { entryId: "entry-1", trackId: "track-1", position: 1 },
      ],
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

    const { handoffPlaylistToQueue } = await import("./playlists");
    const payload = await handoffPlaylistToQueue("playlist-1", "entry-2");

    expect(invokeMock).toHaveBeenCalledWith("handoff_playlist_to_queue", {
      playlistId: "playlist-1",
      startEntryId: "entry-2",
    });
    expect(payload.queue.activeTrackId).toBe("track-2");
  });

  it("sets playlist sidebar hidden flag through the command bridge", async () => {
    invokeMock.mockResolvedValueOnce(undefined);
    (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    const { setPlaylistSidebarHidden } = await import("./playlists");
    await setPlaylistSidebarHidden("playlist-1", true);
    expect(invokeMock).toHaveBeenCalledWith("set_playlist_sidebar_hidden", { playlistId: "playlist-1", hidden: true });
  });

  it("unhides a playlist through the command bridge", async () => {
    invokeMock.mockResolvedValueOnce(undefined);
    (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    const { setPlaylistSidebarHidden } = await import("./playlists");
    await setPlaylistSidebarHidden("playlist-1", false);
    expect(invokeMock).toHaveBeenCalledWith("set_playlist_sidebar_hidden", { playlistId: "playlist-1", hidden: false });
  });

  it("keeps playlist fallbacks inside the browser preview runtime", async () => {
    invokeMock
      .mockRejectedValueOnce(new Error("bridge unavailable"))
      .mockRejectedValueOnce(new Error("bridge unavailable"))
      .mockRejectedValueOnce(new Error("bridge unavailable"))
      .mockRejectedValueOnce(new Error("bridge unavailable"))
      .mockRejectedValueOnce(new Error("bridge unavailable"))
      .mockRejectedValueOnce(new Error("bridge unavailable"));

    const {
      createPlaylist,
      addTrackToPlaylist,
      getPlaylist,
      removePlaylistEntry,
      deletePlaylist,
      listPlaylists,
    } = await import("./playlists");

    const created = await createPlaylist("Desk Set", "focused hours", " /tmp/desk-set.png ");
    const detail = await addTrackToPlaylist(created.id, {
      id: "track-1",
      title: "Alpha",
      artist: "North",
      album: "Signals",
      advisory: null,
      durationSeconds: 182,
      artworkKey: "cover-1",
      relativePath: "Alpha.mp3",
      extension: "mp3",
      sourceStatus: "local",
      cacheState: "ready",
      analysisStatus: "complete",
      indexedAt: "1700000100",
    });
    const playlist = await getPlaylist(created.id);
    const updated = await removePlaylistEntry(created.id, detail.entries[0].entryId);
    await deletePlaylist(created.id);
    const playlists = await listPlaylists();

    expect(created.artworkKey).toContain("browser-playlist-artwork-");
    expect(playlist?.entries).toHaveLength(1);
    expect(detail.entries[0].position).toBe(0);
    expect(updated.entries).toHaveLength(0);
    expect(playlists).toEqual([]);
  });
});
