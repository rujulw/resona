import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const openMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (filePath: string) => `asset://localhost/${encodeURIComponent(filePath)}`,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
}));

describe("desktop library bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    openMock.mockReset();
    delete (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    delete (globalThis as typeof globalThis & { __TAURI__?: unknown }).__TAURI__;
  });

  it("resolves a local playback source into an asset url", async () => {
    invokeMock.mockResolvedValueOnce({
      trackId: "track-1",
      localPath: "/Users/rujulw/Music/alpha.mp3",
    });

    const { resolveTrackPlaybackSource } = await import("./library");
    const payload = await resolveTrackPlaybackSource("track-1");

    expect(invokeMock).toHaveBeenCalledWith("resolve_track_playback_source", {
      trackId: "track-1",
    });
    expect(payload?.assetUrl).toContain("asset://localhost/");
    expect(payload?.trackId).toBe("track-1");
  });

  it("queries the library through the command bridge with normalized defaults", async () => {
    invokeMock.mockResolvedValueOnce({
      items: [],
      nextCursor: "cursor-2",
      total: 120,
      pageSize: 100,
    });

    const { queryLibrary } = await import("./library");
    const payload = await queryLibrary();

    expect(invokeMock).toHaveBeenCalledWith("query_library", {
      pageSize: 100,
      cursor: null,
      search: null,
      sortKey: "title",
      sortDirection: "asc",
    });
    expect(payload.nextCursor).toBe("cursor-2");
  });

  it("scans the local library with normalized display names", async () => {
    invokeMock.mockResolvedValueOnce({
      libraryRootId: "root-1",
      libraryRootName: "Music",
      rootPath: "/Users/rujulw/Music",
      discoveredTracks: 10,
      insertedTracks: 10,
      updatedTracks: 0,
      removedTracks: 0,
    });

    const { scanLocalLibrary } = await import("./library");
    const payload = await scanLocalLibrary("/Users/rujulw/Music", "   ");

    expect(invokeMock).toHaveBeenCalledWith("scan_local_library", {
      rootPath: "/Users/rujulw/Music",
      displayName: null,
    });
    expect(payload.libraryRootId).toBe("root-1");
  });

  it("keeps library fallbacks inside the browser preview runtime", async () => {
    invokeMock
      .mockRejectedValueOnce(new Error("bridge unavailable"))
      .mockRejectedValueOnce(new Error("bridge unavailable"))
      .mockRejectedValueOnce(new Error("bridge unavailable"));

    const { queryLibrary, resolveTrackPlaybackSource, resolveArtworkSource } = await import(
      "./library"
    );

    const page = await queryLibrary({ pageSize: 25 });
    const source = await resolveTrackPlaybackSource("track-1");
    const artwork = await resolveArtworkSource("cover-1");

    expect(page).toEqual({
      items: [],
      nextCursor: null,
      total: 0,
      pageSize: 25,
    });
    expect(source).toBeNull();
    expect(artwork).toBeNull();
  });

  it("resolves an artwork source into an asset url", async () => {
    invokeMock.mockResolvedValueOnce({
      artworkKey: "cover.png",
      localPath: "/Users/rujulw/Library/Application Support/resona/artwork/cover.png",
    });

    const { resolveArtworkSource } = await import("./library");
    const payload = await resolveArtworkSource("cover.png");

    expect(invokeMock).toHaveBeenCalledWith("resolve_artwork_source", {
      artworkKey: "cover.png",
    });
    expect(payload?.assetUrl).toContain("asset://localhost/");
    expect(payload?.artworkKey).toBe("cover.png");
  });

  it("opens a native directory picker for library selection", async () => {
    openMock.mockResolvedValueOnce("/Users/rujulw/Music");

    const { pickLibraryDirectory } = await import("./library");
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

    const { pickPlaylistArtwork } = await import("./library");
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
