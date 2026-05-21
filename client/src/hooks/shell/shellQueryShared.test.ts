import { describe, expect, it } from "vitest";

import {
  getNextTracksAlbumHeaderSort,
  getNextTracksTitleHeaderSort,
  toAsyncErrorMessage,
  withActiveConceptAlbumDetail,
  withActivePlaylistDetail,
} from "./shellQueryShared";
import type { ConceptAlbumsState, PlaylistsState, TracksQueryState } from "../../types/app";

// ── toAsyncErrorMessage ───────────────────────────────────────────────────────

describe("toAsyncErrorMessage", () => {
  it("extracts message from an Error instance", () => {
    const err = new Error("something went wrong");
    expect(toAsyncErrorMessage(err, "fallback")).toBe("something went wrong");
  });

  it("returns a non-empty string error directly", () => {
    expect(toAsyncErrorMessage("network timeout", "fallback")).toBe("network timeout");
  });

  it("returns fallback for an empty string", () => {
    expect(toAsyncErrorMessage("   ", "fallback")).toBe("fallback");
  });

  it("extracts message from a plain object with a message property", () => {
    const obj = { message: "tauri command failed" };
    expect(toAsyncErrorMessage(obj, "fallback")).toBe("tauri command failed");
  });

  it("serializes a plain object without a message property", () => {
    const obj = { code: 404, detail: "not found" };
    expect(toAsyncErrorMessage(obj, "fallback")).toBe(JSON.stringify(obj));
  });

  it("returns fallback for an empty object", () => {
    expect(toAsyncErrorMessage({}, "fallback")).toBe("fallback");
  });

  it("returns fallback for null", () => {
    expect(toAsyncErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("returns fallback for undefined", () => {
    expect(toAsyncErrorMessage(undefined, "fallback")).toBe("fallback");
  });

  it("returns fallback for a number", () => {
    expect(toAsyncErrorMessage(42, "fallback")).toBe("fallback");
  });

  it("serializes object when message property is whitespace-only (falls through to JSON)", () => {
    // message.trim() is falsy, so code falls through to JSON.stringify — the object
    // still has a key so serialized output is returned rather than the fallback.
    expect(toAsyncErrorMessage({ message: "  " }, "fallback")).toBe('{"message":"  "}');
  });
});

// ── getNextTracksTitleHeaderSort ──────────────────────────────────────────────

describe("getNextTracksTitleHeaderSort", () => {
  const base: TracksQueryState = {
    searchDraft: "",
    search: "",
    sortKey: "title",
    sortDirection: "asc",
  };

  it("title asc → title desc (toggle)", () => {
    const next = getNextTracksTitleHeaderSort({ ...base, sortKey: "title", sortDirection: "asc" });
    expect(next).toEqual({ sortKey: "title", sortDirection: "desc" });
  });

  it("title desc → artist asc (advance to next column)", () => {
    const next = getNextTracksTitleHeaderSort({ ...base, sortKey: "title", sortDirection: "desc" });
    expect(next).toEqual({ sortKey: "artist", sortDirection: "asc" });
  });

  it("artist asc → artist desc (toggle)", () => {
    const next = getNextTracksTitleHeaderSort({ ...base, sortKey: "artist", sortDirection: "asc" });
    expect(next).toEqual({ sortKey: "artist", sortDirection: "desc" });
  });

  it("artist desc → title asc (reset)", () => {
    const next = getNextTracksTitleHeaderSort({ ...base, sortKey: "artist", sortDirection: "desc" });
    expect(next).toEqual({ sortKey: "title", sortDirection: "asc" });
  });

  it("unrelated sort key → title asc (reset)", () => {
    const next = getNextTracksTitleHeaderSort({ ...base, sortKey: "album", sortDirection: "asc" });
    expect(next).toEqual({ sortKey: "title", sortDirection: "asc" });
  });
});

// ── getNextTracksAlbumHeaderSort ──────────────────────────────────────────────

describe("getNextTracksAlbumHeaderSort", () => {
  const base: TracksQueryState = {
    searchDraft: "",
    search: "",
    sortKey: "title",
    sortDirection: "asc",
  };

  it("album asc → album desc (toggle)", () => {
    const next = getNextTracksAlbumHeaderSort({ ...base, sortKey: "album", sortDirection: "asc" });
    expect(next).toEqual({ sortKey: "album", sortDirection: "desc" });
  });

  it("album desc → title asc (reset)", () => {
    const next = getNextTracksAlbumHeaderSort({ ...base, sortKey: "album", sortDirection: "desc" });
    expect(next).toEqual({ sortKey: "title", sortDirection: "asc" });
  });

  it("unrelated sort key → album asc (enter album sort)", () => {
    const next = getNextTracksAlbumHeaderSort({ ...base, sortKey: "title", sortDirection: "asc" });
    expect(next).toEqual({ sortKey: "album", sortDirection: "asc" });
  });

  it("indexed_at sort key → album asc (enter album sort)", () => {
    const next = getNextTracksAlbumHeaderSort({ ...base, sortKey: "indexed_at", sortDirection: "desc" });
    expect(next).toEqual({ sortKey: "album", sortDirection: "asc" });
  });
});

// ── withActivePlaylistDetail ──────────────────────────────────────────────────

describe("withActivePlaylistDetail", () => {
  const existingItems = [
    {
      id: "pl-1",
      name: "Desk Set",
      description: null,
      artworkKey: null,
      artworkPath: null,
      entryCount: 1,
      isMixtape: false,
      hiddenFromSidebar: false,
      createdAt: "1700000100",
      updatedAt: "1700000100",
    },
    {
      id: "pl-2",
      name: "Night Drive",
      description: null,
      artworkKey: null,
      artworkPath: null,
      entryCount: 2,
      isMixtape: false,
      hiddenFromSidebar: false,
      createdAt: "1700000200",
      updatedAt: "1700000200",
    },
  ];

  const existing: PlaylistsState = {
    status: "ready",
    items: existingItems,
    activePlaylistId: null,
    activePlaylist: null,
    playbackQueue: null,
  };

  const detail = {
    playlist: {
      id: "pl-1",
      name: "Desk Set Updated",
      description: "focused hours",
      artworkKey: null,
      artworkPath: null,
      entryCount: 3,
      isMixtape: false,
      hiddenFromSidebar: false,
      createdAt: "1700000100",
      updatedAt: "1700000500",
    },
    entries: [],
  };

  it("sets status to ready", () => {
    const next = withActivePlaylistDetail({ ...existing, status: "loading" }, detail);
    expect(next.status).toBe("ready");
  });

  it("sets activePlaylistId to the detail playlist id", () => {
    const next = withActivePlaylistDetail(existing, detail);
    expect(next.activePlaylistId).toBe("pl-1");
  });

  it("sets activePlaylist to the provided detail", () => {
    const next = withActivePlaylistDetail(existing, detail);
    expect(next.activePlaylist).toBe(detail);
  });

  it("replaces the matching item in the items array with updated summary", () => {
    const next = withActivePlaylistDetail(existing, detail);
    const updated = next.items.find((i) => i.id === "pl-1");
    expect(updated?.name).toBe("Desk Set Updated");
    expect(updated?.entryCount).toBe(3);
  });

  it("does not mutate the other item in the list", () => {
    const next = withActivePlaylistDetail(existing, detail);
    const unchanged = next.items.find((i) => i.id === "pl-2");
    expect(unchanged?.name).toBe("Night Drive");
  });

  it("preserves playbackQueue from existing state", () => {
    const withQueue: PlaylistsState = {
      ...existing,
      playbackQueue: { trackIds: ["t1"], activeTrackId: "t1", sourceLabel: "playlist-handoff" },
    };
    const next = withActivePlaylistDetail(withQueue, detail);
    expect(next.playbackQueue?.activeTrackId).toBe("t1");
  });
});

// ── withActiveConceptAlbumDetail ─────────────────────────────────────────────

describe("withActiveConceptAlbumDetail", () => {
  const existingItems = [
    {
      id: "ca-1",
      title: "Night Archive",
      artist: "North",
      description: null,
      artworkKey: "na-cover.png",
      artworkPath: null,
      entryCount: 2,
      hiddenFromSidebar: false,
      createdAt: "1700000100",
      updatedAt: "1700000100",
    },
    {
      id: "ca-2",
      title: "Day Sequence",
      artist: "South",
      description: null,
      artworkKey: null,
      artworkPath: null,
      entryCount: 1,
      hiddenFromSidebar: false,
      createdAt: "1700000200",
      updatedAt: "1700000200",
    },
  ];

  const existing: ConceptAlbumsState = {
    status: "ready",
    items: existingItems,
    activeConceptAlbumId: null,
    activeConceptAlbum: null,
  };

  const detail = {
    conceptAlbum: {
      id: "ca-1",
      title: "Night Archive Extended",
      artist: "North",
      description: "updated description",
      artworkKey: "na-cover.png",
      artworkPath: null,
      entryCount: 5,
      hiddenFromSidebar: false,
      createdAt: "1700000100",
      updatedAt: "1700000600",
    },
    entries: [],
  };

  it("sets status to ready", () => {
    const next = withActiveConceptAlbumDetail({ ...existing, status: "loading" }, detail);
    expect(next.status).toBe("ready");
  });

  it("sets activeConceptAlbumId to the detail concept album id", () => {
    const next = withActiveConceptAlbumDetail(existing, detail);
    expect(next.activeConceptAlbumId).toBe("ca-1");
  });

  it("sets activeConceptAlbum to the provided detail", () => {
    const next = withActiveConceptAlbumDetail(existing, detail);
    expect(next.activeConceptAlbum).toBe(detail);
  });

  it("replaces the matching item in the items array with updated summary", () => {
    const next = withActiveConceptAlbumDetail(existing, detail);
    const updated = next.items.find((i) => i.id === "ca-1");
    expect(updated?.title).toBe("Night Archive Extended");
    expect(updated?.entryCount).toBe(5);
  });

  it("does not mutate the other item in the list", () => {
    const next = withActiveConceptAlbumDetail(existing, detail);
    const unchanged = next.items.find((i) => i.id === "ca-2");
    expect(unchanged?.title).toBe("Day Sequence");
  });
});
