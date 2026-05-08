// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  appDesktopState,
  desktopMocks,
  setupAppDesktopHarness,
} from "../test/appDesktopHarness";

describe("albums page", () => {
  setupAppDesktopHarness();

  it("hydrates album browse detail from the routed album selection", async () => {
    window.history.replaceState({}, "", "/albums/album:signals:north");
    desktopMocks.listAlbumsMock.mockResolvedValue([
      {
        id: "album:signals:north",
        title: "Signals",
        artist: "North",
        trackCount: 2,
        totalDurationSeconds: 387,
        artworkKey: "alpha-cover.png",
      },
    ]);
    desktopMocks.getAlbumMock.mockImplementation(async (albumId: string) => {
      if (albumId !== "album:signals:north") {
        return null;
      }

      return {
        album: {
          id: "album:signals:north",
          title: "Signals",
          artist: "North",
          trackCount: 2,
          totalDurationSeconds: 387,
          artworkKey: "alpha-cover.png",
        },
        tracks: [
          {
            id: "track-1",
            title: "Alpha",
            artist: "North",
            advisory: true,
            durationSeconds: 182,
            artworkKey: "alpha-cover.png",
            extension: "mp3",
            trackNumber: 1,
            discNumber: 1,
          },
          {
            id: "track-3",
            title: "Gamma",
            artist: "North",
            advisory: null,
            durationSeconds: 205,
            artworkKey: "gamma-cover.png",
            extension: "mp3",
            trackNumber: 2,
            discNumber: 1,
          },
        ],
      };
    });

    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      expect(desktopMocks.getAlbumMock).toHaveBeenCalledWith("album:signals:north");
      expect(screen.getByRole("heading", { name: "Signals" })).toBeTruthy();
      expect(screen.getByText("Alpha")).toBeTruthy();
      expect(screen.getByText("Gamma")).toBeTruthy();
      expect(screen.getAllByText("North").length).toBeGreaterThan(0);
      expect(screen.getByText(/2 tracks/i)).toBeTruthy();
    });
  });

  it("smoke-covers album playback handoff behavior through the queue flow", async () => {
    window.history.replaceState({}, "", "/albums/album:signals:north");
    desktopMocks.listAlbumsMock.mockResolvedValue([
      {
        id: "album:signals:north",
        title: "Signals",
        artist: "North",
        trackCount: 2,
        totalDurationSeconds: 387,
        artworkKey: "alpha-cover.png",
      },
    ]);
    desktopMocks.getAlbumMock.mockImplementation(async (albumId: string) => {
      if (albumId !== "album:signals:north") {
        return null;
      }

      return {
        album: {
          id: "album:signals:north",
          title: "Signals",
          artist: "North",
          trackCount: 2,
          totalDurationSeconds: 387,
          artworkKey: "alpha-cover.png",
        },
        tracks: [
          {
            id: "track-1",
            title: "Alpha",
            artist: "North",
            advisory: null,
            durationSeconds: 182,
            artworkKey: "alpha-cover.png",
            extension: "mp3",
            trackNumber: 1,
            discNumber: 1,
          },
          {
            id: "track-3",
            title: "Gamma",
            artist: "North",
            advisory: null,
            durationSeconds: 205,
            artworkKey: "gamma-cover.png",
            extension: "mp3",
            trackNumber: 2,
            discNumber: 1,
          },
        ],
      };
    });
    desktopMocks.loadPlaybackTrackMock.mockImplementation(async (trackId: string) => ({
      playback: (() => {
        appDesktopState.mockBackendPlayback = {
          statusLabel: "Ready",
          transportLabel: "Ready",
          progressSeconds: 0,
          durationSeconds: trackId === "track-1" ? 182 : 205,
          isPlaying: false,
          outputOwner: "rust",
          trackId,
          trackTitle: trackId === "track-1" ? "Alpha" : "Gamma",
          trackArtist: "North",
          trackAlbum: "Signals",
          trackAdvisory: null,
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

    fireEvent.click(await screen.findByRole("button", { name: "Play album" }));

    await waitFor(() => {
      expect(desktopMocks.loadPlaybackTrackMock).toHaveBeenCalledWith("track-1");
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("link", { name: /player/i }));

    await waitFor(() => {
      expect(screen.getByText("queued from the current album order")).toBeTruthy();
      expect(screen.getByText("1 waiting")).toBeTruthy();
      expect(screen.getByText("Gamma")).toBeTruthy();
      expect(screen.getAllByText("North").length).toBeGreaterThan(0);
    });
  });
});
