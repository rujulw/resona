// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  appDesktopState,
  desktopMocks,
  setupAppDesktopHarness,
} from "../test/appDesktopHarness";

describe("tracks page", () => {
  setupAppDesktopHarness();

  it("renders the tracks route inside the fixed shell", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("../App");
    render(<App />);

    await screen.findByRole("heading", { name: "library table" });

    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Signals")).toBeTruthy();
    expect(screen.getByText("3:02")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByAltText("Alpha artwork")).toBeTruthy();
    });
  });

  it("drives search and header sort controls through the tracks query contract", async () => {
    window.history.replaceState({}, "", "/tracks");
    desktopMocks.queryLibraryMock.mockReset();
    desktopMocks.queryLibraryMock
      .mockResolvedValueOnce({
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
        ],
        nextCursor: null,
        total: 3,
        pageSize: 200,
      })
      .mockResolvedValue({
        items: [
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
        total: 1,
        pageSize: 200,
      });

    const { default: App } = await import("../App");
    render(<App />);

    await screen.findByRole("heading", { name: "library table" });

    fireEvent.change(screen.getByPlaceholderText("Search title, artist, album"), {
      target: { value: "bravo" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Search title, artist, album"), {
      key: "Enter",
      code: "Enter",
    });

    await waitFor(() => {
      expect(desktopMocks.queryLibraryMock).toHaveBeenLastCalledWith({
        pageSize: 200,
        cursor: null,
        search: "bravo",
        sortKey: "title",
        sortDirection: "asc",
      });
      expect(screen.getByText("Bravo")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "title ↑" }));
    await screen.findByRole("button", { name: "title ↓" });
    fireEvent.click(screen.getByRole("button", { name: "title ↓" }));
    await screen.findByRole("button", { name: "artist ↑" });
    fireEvent.click(screen.getByRole("button", { name: "artist ↑" }));

    await waitFor(() => {
      expect(desktopMocks.queryLibraryMock).toHaveBeenLastCalledWith({
        pageSize: 200,
        cursor: null,
        search: "bravo",
        sortKey: "artist",
        sortDirection: "desc",
      });
    });
  });

  it("keeps the latest tracks query result when search requests overlap", async () => {
    window.history.replaceState({}, "", "/tracks");
    desktopMocks.queryLibraryMock.mockReset();

    let resolveAlphaSearch:
      | ((value: {
          items: Array<{
            id: string;
            title: string;
            artist: string | null;
            album: string | null;
            durationSeconds: number | null;
            artworkKey: string | null;
            relativePath: string;
            sourceStatus: string;
            cacheState: string;
            analysisStatus: string;
            indexedAt: string;
          }>;
          nextCursor: null;
          total: number;
          pageSize: number;
        }) => void)
      | undefined;

    desktopMocks.queryLibraryMock
      .mockResolvedValueOnce({
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
        ],
        nextCursor: null,
        total: 1,
        pageSize: 200,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveAlphaSearch = resolve;
          }),
      )
      .mockResolvedValueOnce({
        items: [
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
        total: 1,
        pageSize: 200,
      });

    const { default: App } = await import("../App");
    render(<App />);

    const searchBox = await screen.findByPlaceholderText("Search title, artist, album");
    fireEvent.change(searchBox, { target: { value: "alpha" } });
    fireEvent.keyDown(searchBox, { key: "Enter", code: "Enter" });
    fireEvent.change(searchBox, { target: { value: "bravo" } });
    fireEvent.keyDown(searchBox, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Bravo")).toBeTruthy();
    });

    resolveAlphaSearch?.({
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
      ],
      nextCursor: null,
      total: 1,
      pageSize: 200,
    });

    await waitFor(() => {
      expect(screen.getByText("Bravo")).toBeTruthy();
      expect(screen.queryByText("Alpha")).toBeNull();
    });
  });

  it("pushes the selected track into the playback shell state", async () => {
    window.history.replaceState({}, "", "/tracks");

    const { default: App } = await import("../App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Select Alpha" }).getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });
  });

  it("keeps queue navigation stable after the tracks view is filtered by search", async () => {
    window.history.replaceState({}, "", "/tracks");
    desktopMocks.queryLibraryMock.mockReset();
    desktopMocks.queryLibraryMock
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
        ],
        nextCursor: null,
        total: 1,
        pageSize: 200,
      });

    const { default: App } = await import("../App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText("Search title, artist, album"), {
      target: { value: "alpha" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Search title, artist, album"), {
      key: "Enter",
      code: "Enter",
    });

    await waitFor(() => {
      expect(screen.queryByText("Bravo")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Next track" }));
    fireEvent.click(screen.getByRole("link", { name: /queue/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Bravo").length).toBeGreaterThan(0);
      expect(
        screen.getByText("No additional indexed tracks are queued after the current selection."),
      ).toBeTruthy();
    });
  });

  it("renders advisory badges in the library and playback bar", async () => {
    window.history.replaceState({}, "", "/tracks");
    desktopMocks.queryLibraryMock.mockResolvedValueOnce({
      items: [
        {
          id: "track-1",
          title: "Alpha",
          artist: "North",
          album: "Signals",
          advisory: true,
          durationSeconds: 182,
          artworkKey: "alpha-cover.png",
          relativePath: "alpha.mp3",
          sourceStatus: "local-only",
          cacheState: "none",
          analysisStatus: "pending",
          indexedAt: "1700000000",
        },
      ],
      nextCursor: null,
      total: 1,
      pageSize: 200,
    });
    desktopMocks.loadPlaybackTrackMock.mockImplementationOnce(async (trackId: string) => ({
      playback: (() => {
        appDesktopState.mockBackendPlayback = {
          statusLabel: "Ready",
          transportLabel: "Ready",
          progressSeconds: 0,
          durationSeconds: 182,
          isPlaying: false,
          outputOwner: "rust",
          trackId,
          trackTitle: "Alpha",
          trackArtist: "North",
          trackAlbum: "Signals",
          trackAdvisory: true,
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

    const { default: App } = await import("../App");
    render(<App />);

    await screen.findByRole("button", { name: "Select Alpha" });
    expect(screen.getAllByText("E").length).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Select Alpha" }));

    await waitFor(() => {
      expect(screen.getAllByText("E").length).toBeGreaterThanOrEqual(2);
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });
  });
});
