// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAlbumSearch } from "./useAlbumSearch";

const albums = [
  { id: "a1", title: "Signals", artist: "North", trackCount: 3, totalDurationSeconds: 300, artworkKey: null },
  { id: "a2", title: "Phases", artist: "South", trackCount: 2, totalDurationSeconds: 200, artworkKey: null },
  { id: "a3", title: "Echo", artist: "North", trackCount: 4, totalDurationSeconds: 400, artworkKey: null },
];

describe("useAlbumSearch", () => {
  it("returns all albums when search is empty", () => {
    const { result } = renderHook(() => useAlbumSearch(albums));
    expect(result.current.visibleAlbums).toHaveLength(3);
  });

  it("filters albums by title", () => {
    const { result } = renderHook(() => useAlbumSearch(albums));
    act(() => result.current.setSearchDraft("sig"));
    expect(result.current.visibleAlbums).toHaveLength(1);
    expect(result.current.visibleAlbums[0].title).toBe("Signals");
  });

  it("filters albums by artist", () => {
    const { result } = renderHook(() => useAlbumSearch(albums));
    act(() => result.current.setSearchDraft("north"));
    expect(result.current.visibleAlbums).toHaveLength(2);
  });

  it("is case insensitive", () => {
    const { result } = renderHook(() => useAlbumSearch(albums));
    act(() => result.current.setSearchDraft("PHASES"));
    expect(result.current.visibleAlbums).toHaveLength(1);
  });

  it("returns empty array when no albums match", () => {
    const { result } = renderHook(() => useAlbumSearch(albums));
    act(() => result.current.setSearchDraft("zzz"));
    expect(result.current.visibleAlbums).toHaveLength(0);
  });
});
