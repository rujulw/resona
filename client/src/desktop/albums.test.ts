import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (p: string) => `asset://localhost/${encodeURIComponent(p)}`,
}));

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

describe("desktop albums bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
    delete (globalThis as Record<string, unknown>).__TAURI__;
  });

  it("lists albums from the backend", async () => {
    const albums = [
      { id: "album:signals:north", title: "Signals", artist: "North", trackCount: 2, totalDurationSeconds: 360, artworkKey: null },
    ];
    invokeMock.mockResolvedValueOnce(albums);
    const { listAlbums } = await import("./albums");
    const result = await listAlbums();
    expect(invokeMock).toHaveBeenCalledWith("list_albums", { search: null });
    expect(result).toEqual(albums);
  });

  it("passes search query when listing albums", async () => {
    invokeMock.mockResolvedValueOnce([]);
    const { listAlbums } = await import("./albums");
    await listAlbums("north");
    expect(invokeMock).toHaveBeenCalledWith("list_albums", { search: "north" });
  });

  it("fetches a single album by id", async () => {
    const detail = {
      album: { id: "album:signals:north", title: "Signals", artist: "North", trackCount: 1, totalDurationSeconds: 182, artworkKey: null },
      tracks: [{ id: "t1", title: "Alpha", artist: "North", advisory: null, durationSeconds: 182, artworkKey: null, extension: "mp3", trackNumber: 1 }],
    };
    invokeMock.mockResolvedValueOnce(detail);
    const { getAlbum } = await import("./albums");
    const result = await getAlbum("album:signals:north");
    expect(invokeMock).toHaveBeenCalledWith("get_album", { albumId: "album:signals:north" });
    expect(result?.album.title).toBe("Signals");
  });

  it("returns null for getAlbum when backend returns null", async () => {
    invokeMock.mockResolvedValueOnce(null);
    const { getAlbum } = await import("./albums");
    expect(await getAlbum("missing")).toBeNull();
  });

  it("falls back to empty array for listAlbums when bridge is unavailable", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));
    const { listAlbums } = await import("./albums");
    const result = await listAlbums();
    expect(result).toEqual([]);
  });
});
