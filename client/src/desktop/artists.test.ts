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

describe("desktop artists bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    openMock.mockReset();
    delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
    delete (globalThis as Record<string, unknown>).__TAURI__;
  });

  it("lists artists from the backend", async () => {
    const artists = [{ name: "North", trackCount: 5 }];
    invokeMock.mockResolvedValueOnce(artists);
    const { listArtists } = await import("./artists");
    const result = await listArtists();
    expect(invokeMock).toHaveBeenCalledWith("list_artists", { search: null });
    expect(result).toEqual(artists);
  });

  it("passes search when listing artists", async () => {
    invokeMock.mockResolvedValueOnce([]);
    const { listArtists } = await import("./artists");
    await listArtists("north");
    expect(invokeMock).toHaveBeenCalledWith("list_artists", { search: "north" });
  });

  it("fetches artist detail by name", async () => {
    const detail = { name: "North", albums: [], features: [], playlists: [] };
    invokeMock.mockResolvedValueOnce(detail);
    const { getArtistDetail } = await import("./artists");
    const result = await getArtistDetail("North");
    expect(invokeMock).toHaveBeenCalledWith("get_artist_detail", { artistName: "North" });
    expect(result?.name).toBe("North");
  });

  it("returns null for getArtistDetail when backend returns null", async () => {
    invokeMock.mockResolvedValueOnce(null);
    const { getArtistDetail } = await import("./artists");
    expect(await getArtistDetail("Ghost")).toBeNull();
  });

  it("fetches artists images directory", async () => {
    invokeMock.mockResolvedValueOnce("/Users/me/images");
    const { getArtistsImagesDir } = await import("./artists");
    const result = await getArtistsImagesDir();
    expect(invokeMock).toHaveBeenCalledWith("get_artists_images_dir", {});
    expect(result).toBe("/Users/me/images");
  });

  it("sets artists images directory", async () => {
    invokeMock.mockResolvedValueOnce(undefined);
    const { setArtistsImagesDir } = await import("./artists");
    await setArtistsImagesDir("/new/path");
    expect(invokeMock).toHaveBeenCalledWith("set_artists_images_dir", { dirPath: "/new/path" });
  });

  it("fetches artists profile images directory", async () => {
    invokeMock.mockResolvedValueOnce("/profile/images");
    const { getArtistsProfileImagesDir } = await import("./artists");
    const result = await getArtistsProfileImagesDir();
    expect(invokeMock).toHaveBeenCalledWith("get_artists_profile_images_dir", {});
    expect(result).toBe("/profile/images");
  });

  it("sets artists profile images directory", async () => {
    invokeMock.mockResolvedValueOnce(undefined);
    const { setArtistsProfileImagesDir } = await import("./artists");
    await setArtistsProfileImagesDir("/profile/new");
    expect(invokeMock).toHaveBeenCalledWith("set_artists_profile_images_dir", { dirPath: "/profile/new" });
  });

  it("falls back to empty array for listArtists when bridge is unavailable", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));
    const { listArtists } = await import("./artists");
    expect(await listArtists()).toEqual([]);
  });
});
