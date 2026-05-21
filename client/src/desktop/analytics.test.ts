import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const openMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (p: string) => `asset://localhost/${encodeURIComponent(p)}`,
}));

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
}));

describe("desktop analytics bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    openMock.mockReset();
    delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
    delete (globalThis as Record<string, unknown>).__TAURI__;
  });

  it("queries top tracks with a time range", async () => {
    const tracks = [{ trackId: "t1", title: "Alpha", artist: "North", playCount: 10, artworkKey: null, advisory: null }];
    invokeMock.mockResolvedValueOnce(tracks);
    const { queryTopTracks } = await import("./analytics");
    const result = await queryTopTracks(28, 10);
    expect(invokeMock).toHaveBeenCalledWith("query_top_tracks", { windowDays: 28, limit: 10 });
    expect(result[0].trackId).toBe("t1");
  });

  it("queries top tracks without day limit (all time)", async () => {
    invokeMock.mockResolvedValueOnce([]);
    const { queryTopTracks } = await import("./analytics");
    await queryTopTracks(undefined, 5);
    expect(invokeMock).toHaveBeenCalledWith("query_top_tracks", { windowDays: null, limit: 5 });
  });

  it("queries top artists", async () => {
    const artists = [{ artist: "North", playCount: 42, trackCount: 2, totalMsPlayed: 50000, firstPlayedAt: 0 }];
    invokeMock.mockResolvedValueOnce(artists);
    const { queryTopArtists } = await import("./analytics");
    const result = await queryTopArtists(180, 10);
    expect(invokeMock).toHaveBeenCalledWith("query_top_artists", { windowDays: 180, limit: 10 });
    expect(result[0].artist).toBe("North");
  });

  it("imports spotify history from a folder path", async () => {
    const summary = { filesProcessed: 3, matched: 120, ghostStored: 0, skippedShort: 5, skippedPodcast: 0, skippedNoTrackMetadata: 0, skippedDuplicate: 0 };
    invokeMock.mockResolvedValueOnce(summary);
    const { importSpotifyHistoryFolder } = await import("./analytics");
    const result = await importSpotifyHistoryFolder("/path/to/spotify");
    expect(invokeMock).toHaveBeenCalledWith("import_spotify_history_folder", { folderPath: "/path/to/spotify", minMsPlayed: null });
    expect(result.filesProcessed).toBe(3);
  });

  it("returns null from pickSpotifyExportFolder when dialog is cancelled", async () => {
    openMock.mockResolvedValueOnce(null);
    const { pickSpotifyExportFolder } = await import("./analytics");
    const result = await pickSpotifyExportFolder();
    expect(result).toBeNull();
  });

  it("queries track play stats by track id", async () => {
    const stats = { trackId: "t1", totalPlays: 5, lastPlayedAt: "2024-01-01" };
    invokeMock.mockResolvedValueOnce(stats);
    const { queryTrackPlayStats } = await import("./analytics");
    const result = await queryTrackPlayStats("t1");
    expect(invokeMock).toHaveBeenCalledWith("query_track_play_stats", { trackId: "t1" });
    expect(result?.trackId).toBe("t1");
  });

  it("returns null from pickSpotifyExportFile when dialog is cancelled", async () => {
    openMock.mockResolvedValueOnce(null);
    const { pickSpotifyExportFile } = await import("./analytics");
    const result = await pickSpotifyExportFile();
    expect(result).toBeNull();
  });

  it("returns path from pickSpotifyExportFile when file is selected", async () => {
    openMock.mockResolvedValueOnce("/Users/me/history.json");
    const { pickSpotifyExportFile } = await import("./analytics");
    const result = await pickSpotifyExportFile();
    expect(result).toBe("/Users/me/history.json");
  });

  it("imports spotify history from a file path", async () => {
    const summary = { filesProcessed: 1, matched: 40, ghostStored: 0, skippedShort: 2, skippedPodcast: 0, skippedNoTrackMetadata: 0, skippedDuplicate: 0 };
    invokeMock.mockResolvedValueOnce(summary);
    const { importSpotifyHistoryFile } = await import("./analytics");
    const result = await importSpotifyHistoryFile("/Users/me/history.json");
    expect(invokeMock).toHaveBeenCalledWith("import_spotify_history_file", { jsonPath: "/Users/me/history.json", minMsPlayed: null });
    expect(result.matched).toBe(40);
  });

  it("falls back to empty array for queryTopTracks when bridge unavailable", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));
    const { queryTopTracks } = await import("./analytics");
    expect(await queryTopTracks(28, 10)).toEqual([]);
  });
});
