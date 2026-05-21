import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (p: string) => `asset://localhost/${encodeURIComponent(p)}`,
}));

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const mockTrack = {
  id: "track-1",
  title: "Alpha",
  artist: "North",
  album: "Signals",
  advisory: null,
  durationSeconds: 182,
  artworkKey: null,
  relativePath: "music/alpha.mp3",
  extension: "mp3",
  sourceStatus: "local-only",
  cacheState: "none",
  analysisStatus: "pending",
  indexedAt: "",
};

describe("desktop conceptAlbums bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
    delete (globalThis as Record<string, unknown>).__TAURI__;
  });

  it("lists concept albums from the backend", async () => {
    const cas = [{ id: "ca-1", title: "Night Archive", artist: "North", entryCount: 3, artworkKey: null, description: null, createdAt: "", updatedAt: "" }];
    invokeMock.mockResolvedValueOnce(cas);
    const { listConceptAlbums } = await import("./conceptAlbums");
    const result = await listConceptAlbums();
    expect(invokeMock).toHaveBeenCalledWith("list_concept_albums");
    expect(result[0].title).toBe("Night Archive");
  });

  it("fetches concept album detail by id", async () => {
    const detail = { conceptAlbum: { id: "ca-1", title: "Night Archive", artist: "North", description: null, artworkKey: null, createdAt: "", updatedAt: "" }, entries: [] };
    invokeMock.mockResolvedValueOnce(detail);
    const { getConceptAlbum } = await import("./conceptAlbums");
    const result = await getConceptAlbum("ca-1");
    expect(invokeMock).toHaveBeenCalledWith("get_concept_album", { conceptAlbumId: "ca-1" });
    expect(result?.conceptAlbum.title).toBe("Night Archive");
  });

  it("creates a concept album", async () => {
    const summary = { id: "ca-new", title: "New CA", artist: "North", entryCount: 0, artworkKey: null, description: null, createdAt: "", updatedAt: "" };
    invokeMock.mockResolvedValueOnce(summary);
    const { createConceptAlbum } = await import("./conceptAlbums");
    const result = await createConceptAlbum("New CA", "North", null, null);
    expect(invokeMock).toHaveBeenCalledWith("create_concept_album", expect.objectContaining({ title: "New CA" }));
    expect(result.id).toBe("ca-new");
  });

  it("deletes a concept album", async () => {
    invokeMock.mockResolvedValueOnce(undefined);
    const { deleteConceptAlbum } = await import("./conceptAlbums");
    await deleteConceptAlbum("ca-1");
    expect(invokeMock).toHaveBeenCalledWith("delete_concept_album", { conceptAlbumId: "ca-1" });
  });

  it("adds a track to a concept album", async () => {
    const detail = { conceptAlbum: { id: "ca-1", title: "Night Archive", artist: "North", description: null, artworkKey: null, createdAt: "", updatedAt: "" }, entries: [] };
    invokeMock.mockResolvedValueOnce(detail);
    const { addTrackToConceptAlbum } = await import("./conceptAlbums");
    await addTrackToConceptAlbum("ca-1", mockTrack);
    expect(invokeMock).toHaveBeenCalledWith("add_track_to_concept_album", { conceptAlbumId: "ca-1", trackId: "track-1" });
  });

  it("removes a concept album entry", async () => {
    const detail = { conceptAlbum: { id: "ca-1", title: "Night Archive", artist: "North", description: null, artworkKey: null, createdAt: "", updatedAt: "" }, entries: [] };
    invokeMock.mockResolvedValueOnce(detail);
    const { removeConceptAlbumEntry } = await import("./conceptAlbums");
    await removeConceptAlbumEntry("ca-1", "entry-1");
    expect(invokeMock).toHaveBeenCalledWith("remove_concept_album_entry", { conceptAlbumId: "ca-1", entryId: "entry-1" });
  });

  it("updates a concept album", async () => {
    const summary = { id: "ca-1", title: "Updated", artist: "North", entryCount: 0, artworkKey: null, description: null, createdAt: "", updatedAt: "" };
    invokeMock.mockResolvedValueOnce(summary);
    const { updateConceptAlbum } = await import("./conceptAlbums");
    const result = await updateConceptAlbum("ca-1", "Updated", "North", null, null);
    expect(invokeMock).toHaveBeenCalledWith("update_concept_album", expect.objectContaining({ conceptAlbumId: "ca-1", title: "Updated" }));
    expect(result.id).toBe("ca-1");
  });

  it("moves a concept album entry", async () => {
    const detail = { conceptAlbum: { id: "ca-1", title: "Night Archive", artist: "North", description: null, artworkKey: null, createdAt: "", updatedAt: "" }, entries: [] };
    invokeMock.mockResolvedValueOnce(detail);
    const { moveConceptAlbumEntry } = await import("./conceptAlbums");
    await moveConceptAlbumEntry("ca-1", "entry-1", 2);
    expect(invokeMock).toHaveBeenCalledWith("move_concept_album_entry", { conceptAlbumId: "ca-1", entryId: "entry-1", targetPosition: 2 });
  });

  it("replaces concept album entries", async () => {
    const detail = { conceptAlbum: { id: "ca-1", title: "Night Archive", artist: "North", description: null, artworkKey: null, createdAt: "", updatedAt: "" }, entries: [] };
    invokeMock.mockResolvedValueOnce(detail);
    const { replaceConceptAlbumEntries } = await import("./conceptAlbums");
    await replaceConceptAlbumEntries("ca-1", [{ trackId: "t1", position: 0 }]);
    expect(invokeMock).toHaveBeenCalledWith("replace_concept_album_entries", { conceptAlbumId: "ca-1", entries: [{ trackId: "t1", position: 0 }] });
  });

  it("falls back to empty array for listConceptAlbums when bridge unavailable", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));
    const { listConceptAlbums } = await import("./conceptAlbums");
    expect(await listConceptAlbums()).toEqual([]);
  });
});
