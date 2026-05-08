// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  appDesktopState,
  desktopMocks,
  setupAppDesktopHarness,
} from "../test/appDesktopHarness";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const northDetail = {
  name: "North",
  trackCount: 2,
  imageConfig: null,
  albums: [
    {
      id: "album:signals:north",
      title: "Signals",
      year: 2022,
      artworkKey: "alpha-cover.png",
      trackCount: 2,
      kind: "album",
    },
  ],
  features: [],
  playlists: [],
};

const northDetailWithImage = {
  ...northDetail,
  imageConfig: { localImagePath: "/Users/rujulw/ArtistImages/North.png" },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("artist page", () => {
  setupAppDesktopHarness();

  it("hydrates artist detail from the routed artist name", async () => {
    window.history.replaceState({}, "", "/artist/North");
    desktopMocks.getArtistDetailMock.mockResolvedValue(northDetail);

    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      expect(desktopMocks.getArtistDetailMock).toHaveBeenCalledWith("North");
      expect(screen.getByRole("heading", { name: "North" })).toBeTruthy();
      expect(screen.getByText("Signals")).toBeTruthy();
    });
  });

  it("shows artist image header when imageConfig is set", async () => {
    window.history.replaceState({}, "", "/artist/North");
    desktopMocks.getArtistDetailMock.mockResolvedValue(northDetailWithImage);

    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "North" })).toBeTruthy();
    });
  });

  it("shows not-found state for an unknown artist", async () => {
    window.history.replaceState({}, "", "/artist/Unknown");
    desktopMocks.getArtistDetailMock.mockResolvedValue(null);

    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Artist not found.")).toBeTruthy();
    });
  });

  it("plays an album from the artist page via handoff through getAlbum", async () => {
    window.history.replaceState({}, "", "/artist/North");
    desktopMocks.getArtistDetailMock.mockResolvedValue(northDetail);

    const { default: App } = await import("../App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Play North" }));

    await waitFor(() => {
      expect(desktopMocks.getAlbumMock).toHaveBeenCalledWith("album:signals:north");
      expect(desktopMocks.loadPlaybackTrackMock).toHaveBeenCalledWith("track-1");
    });
  });
});

describe("artist deeplinks from collection views", () => {
  setupAppDesktopHarness();

  it("navigates to the artist page when an artist name link is clicked in album detail", async () => {
    window.history.replaceState({}, "", "/albums/album:signals:north");
    desktopMocks.getArtistDetailMock.mockResolvedValue(northDetail);

    const { default: App } = await import("../App");
    render(<App />);

    // Multiple "North" links exist (album header + track rows) — click the first
    const artistLinks = await screen.findAllByRole("link", { name: "North" });
    fireEvent.click(artistLinks[0]);

    await waitFor(() => {
      expect(desktopMocks.getArtistDetailMock).toHaveBeenCalledWith("North");
      expect(screen.getByRole("heading", { name: "North" })).toBeTruthy();
    });
  });

  it("navigates to the artist page from a playlist entry artist link", async () => {
    window.history.replaceState({}, "", "/playlists/playlist-1");
    desktopMocks.getArtistDetailMock.mockResolvedValue(northDetail);

    const { default: App } = await import("../App");
    render(<App />);

    const artistLink = await screen.findByRole("link", { name: "North" });
    fireEvent.click(artistLink);

    await waitFor(() => {
      expect(desktopMocks.getArtistDetailMock).toHaveBeenCalledWith("North");
      expect(screen.getByRole("heading", { name: "North" })).toBeTruthy();
    });
  });
});

describe("artist images dir setting", () => {
  setupAppDesktopHarness();

  it("loads and displays the current artist images dir on mount", async () => {
    window.history.replaceState({}, "", "/settings");
    desktopMocks.getArtistsImagesDirMock.mockResolvedValue("/Users/rujulw/ArtistImages");

    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      expect(desktopMocks.getArtistsImagesDirMock).toHaveBeenCalled();
      const input = screen.getByPlaceholderText("No folder selected") as HTMLInputElement;
      expect(input.value).toBe("/Users/rujulw/ArtistImages");
    });
  });

  it("shows empty input when no dir is set", async () => {
    window.history.replaceState({}, "", "/settings");
    desktopMocks.getArtistsImagesDirMock.mockResolvedValue(null);

    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      const input = screen.getByPlaceholderText("No folder selected") as HTMLInputElement;
      expect(input.value).toBe("");
    });
  });

  it("saves the picked dir and updates the displayed path", async () => {
    window.history.replaceState({}, "", "/settings");
    desktopMocks.getArtistsImagesDirMock.mockResolvedValue(null);
    desktopMocks.pickArtistsImagesDirMock.mockResolvedValue("/Users/rujulw/NewArtistImages");
    desktopMocks.setArtistsImagesDirMock.mockResolvedValue(undefined);

    const { default: App } = await import("../App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "browse" }));

    await waitFor(() => {
      expect(desktopMocks.setArtistsImagesDirMock).toHaveBeenCalledWith(
        "/Users/rujulw/NewArtistImages",
      );
      const input = screen.getByPlaceholderText("No folder selected") as HTMLInputElement;
      expect(input.value).toBe("/Users/rujulw/NewArtistImages");
    });
  });

  it("does not save when the picker is cancelled", async () => {
    window.history.replaceState({}, "", "/settings");
    desktopMocks.getArtistsImagesDirMock.mockResolvedValue("/Users/rujulw/ArtistImages");
    desktopMocks.pickArtistsImagesDirMock.mockResolvedValue(null);

    const { default: App } = await import("../App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "browse" }));

    await waitFor(() => {
      expect(desktopMocks.setArtistsImagesDirMock).not.toHaveBeenCalled();
      // dir stays unchanged
      const input = screen.getByPlaceholderText("No folder selected") as HTMLInputElement;
      expect(input.value).toBe("/Users/rujulw/ArtistImages");
    });
  });
});

describe("artist discography album hydration", () => {
  setupAppDesktopHarness();

  it("renders discography albums on the artist page with year and title", async () => {
    window.history.replaceState({}, "", "/artist/North");
    desktopMocks.getArtistDetailMock.mockResolvedValue({
      ...northDetail,
      albums: [
        {
          id: "album:signals:north",
          title: "Signals",
          year: 2022,
          artworkKey: "alpha-cover.png",
          trackCount: 2,
          kind: "album",
        },
        {
          id: "album:echoes:north",
          title: "Echoes",
          year: 2019,
          artworkKey: null,
          trackCount: 3,
          kind: "album",
        },
      ],
    });

    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Signals")).toBeTruthy();
      expect(screen.getByText("Echoes")).toBeTruthy();
      expect(screen.getByText("2022")).toBeTruthy();
      expect(screen.getByText("2019")).toBeTruthy();
    });
  });

  it("links discography albums to the album detail route", async () => {
    window.history.replaceState({}, "", "/artist/North");
    desktopMocks.getArtistDetailMock.mockResolvedValue(northDetail);

    const { default: App } = await import("../App");
    render(<App />);

    const albumLink = await screen.findByRole("link", { name: /Signals/i });
    fireEvent.click(albumLink);

    await waitFor(() => {
      expect(desktopMocks.getAlbumMock).toHaveBeenCalledWith("album:signals:north");
    });
  });

  it("renders featured-on section when features are present", async () => {
    window.history.replaceState({}, "", "/artist/North");
    desktopMocks.getArtistDetailMock.mockResolvedValue({
      ...northDetail,
      features: [
        {
          id: "album:horizons:south",
          title: "Horizons",
          year: null,
          artworkKey: "bravo-cover.png",
          trackCount: 1,
          kind: "album",
        },
      ],
    });

    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("featured on")).toBeTruthy();
      expect(screen.getByText("Horizons")).toBeTruthy();
    });
  });

  it("renders appears-on section when playlists are present", async () => {
    window.history.replaceState({}, "", "/artist/North");
    // No albums avoids artwork resolution async cycles that can delay the playlist section
    desktopMocks.getArtistDetailMock.mockResolvedValue({
      ...northDetail,
      albums: [],
      playlists: [{ id: "playlist-1", title: "Late Night Drive", artworkKey: null }],
    });

    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("appears on")).toBeTruthy();
      expect(screen.getByText("Late Night Drive")).toBeTruthy();
    });
  });

  it("links a playlist in appears-on to the playlist detail route", async () => {
    window.history.replaceState({}, "", "/artist/North");
    desktopMocks.getArtistDetailMock.mockResolvedValue({
      ...northDetail,
      albums: [],
      playlists: [{ id: "playlist-1", title: "Desk Set", artworkKey: null }],
    });

    const { default: App } = await import("../App");
    render(<App />);

    const plLink = await screen.findByRole("link", { name: "Desk Set" });
    fireEvent.click(plLink);

    await waitFor(() => {
      expect(desktopMocks.getPlaylistMock).toHaveBeenCalledWith("playlist-1");
    });
  });

  it("does not show play button when there are no albums", async () => {
    window.history.replaceState({}, "", "/artist/North");
    desktopMocks.getArtistDetailMock.mockResolvedValue({
      ...northDetail,
      albums: [],
    });

    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "North" })).toBeTruthy();
    });

    expect(screen.queryByRole("button", { name: "Play North" })).toBeNull();
  });
});

// Regression: playback bar still shows correct artist during artist page browse
describe("artist page playback integration", () => {
  setupAppDesktopHarness();

  it("shows playback bar with correct track info while browsing artist page", async () => {
    window.history.replaceState({}, "", "/artist/North");
    desktopMocks.getArtistDetailMock.mockResolvedValue(northDetail);

    const { default: App } = await import("../App");
    render(<App />);

    await screen.findByRole("heading", { name: "North" });

    appDesktopState.playbackStateListener?.({
      statusLabel: "Playing",
      transportLabel: "Playing",
      progressSeconds: 30,
      durationSeconds: 182,
      isPlaying: true,
      outputOwner: "rust",
      trackId: "track-1",
      trackTitle: "Alpha",
      trackArtist: "North",
      trackAlbum: "Signals",
      trackAdvisory: null,
    });

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Pause playback" })).toBeTruthy();
    });
  });
});
