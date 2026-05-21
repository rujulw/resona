// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "./SettingsPage";

const listPlaylistsMock = vi.fn();
const listConceptAlbumsMock = vi.fn();
const listExcludedArtistsMock = vi.fn();
const setPlaylistSidebarHiddenMock = vi.fn();
const setConceptAlbumSidebarHiddenMock = vi.fn();
const setArtistAnalyticsExcludedMock = vi.fn();
const getArtistsImagesDirMock = vi.fn();
const getArtistsProfileImagesDirMock = vi.fn();

vi.mock("../desktop", () => ({
  listPlaylists: (...args: unknown[]) => listPlaylistsMock(...args),
  listConceptAlbums: (...args: unknown[]) => listConceptAlbumsMock(...args),
  listExcludedArtists: (...args: unknown[]) => listExcludedArtistsMock(...args),
  setPlaylistSidebarHidden: (...args: unknown[]) => setPlaylistSidebarHiddenMock(...args),
  setConceptAlbumSidebarHidden: (...args: unknown[]) => setConceptAlbumSidebarHiddenMock(...args),
  setArtistAnalyticsExcluded: (...args: unknown[]) => setArtistAnalyticsExcludedMock(...args),
  getArtistsImagesDir: (...args: unknown[]) => getArtistsImagesDirMock(...args),
  getArtistsProfileImagesDir: (...args: unknown[]) => getArtistsProfileImagesDirMock(...args),
  importSpotifyHistoryFolder: vi.fn(),
  pickArtistsImagesDir: vi.fn(),
  setArtistsImagesDir: vi.fn(),
  pickArtistsProfileImagesDir: vi.fn(),
  setArtistsProfileImagesDir: vi.fn(),
  pickSpotifyExportFolder: vi.fn(),
}));

const defaultScanState = {
  status: "idle" as const,
  message: "",
  lastScan: null,
};

function renderSettings() {
  return render(
    <SettingsPage
      libraryPath="/music"
      platformLabel="macos"
      appVersion="2.6.0"
      scanState={defaultScanState}
      onPickLibraryDirectory={vi.fn()}
      onScan={vi.fn()}
    />,
  );
}

describe("SettingsPage visibility section", () => {
  beforeEach(() => {
    listPlaylistsMock.mockReset();
    listConceptAlbumsMock.mockReset();
    listExcludedArtistsMock.mockReset();
    setPlaylistSidebarHiddenMock.mockReset();
    setConceptAlbumSidebarHiddenMock.mockReset();
    setArtistAnalyticsExcludedMock.mockReset();
    getArtistsImagesDirMock.mockResolvedValue(null);
    getArtistsProfileImagesDirMock.mockResolvedValue(null);
  });

  afterEach(() => cleanup());

  it("does not render visibility section when nothing is hidden", async () => {
    listPlaylistsMock.mockResolvedValue([]);
    listConceptAlbumsMock.mockResolvedValue([]);
    listExcludedArtistsMock.mockResolvedValue([]);

    renderSettings();

    await waitFor(() => {
      expect(listPlaylistsMock).toHaveBeenCalled();
    });

    expect(screen.queryByText("visibility")).toBeNull();
  });

  it("shows hidden playlists in the visibility section", async () => {
    listPlaylistsMock.mockResolvedValue([
      { id: "pl-1", name: "Desk Set", hiddenFromSidebar: true, description: null, entryCount: 1, isMixtape: false, artworkKey: null, artworkPath: null, createdAt: "", updatedAt: "" },
    ]);
    listConceptAlbumsMock.mockResolvedValue([]);
    listExcludedArtistsMock.mockResolvedValue([]);

    renderSettings();

    await screen.findByText("Desk Set");
    expect(screen.getByText("hidden from sidebar")).toBeTruthy();
    expect(screen.getByRole("button", { name: /show/i })).toBeTruthy();
  });

  it("show button on hidden playlist calls setPlaylistSidebarHidden and removes from list", async () => {
    listPlaylistsMock.mockResolvedValue([
      { id: "pl-1", name: "Desk Set", hiddenFromSidebar: true, description: null, entryCount: 1, isMixtape: false, artworkKey: null, artworkPath: null, createdAt: "", updatedAt: "" },
    ]);
    listConceptAlbumsMock.mockResolvedValue([]);
    listExcludedArtistsMock.mockResolvedValue([]);
    setPlaylistSidebarHiddenMock.mockResolvedValue(undefined);

    renderSettings();

    await screen.findByText("Desk Set");

    fireEvent.click(screen.getByRole("button", { name: /show/i }));

    await waitFor(() => {
      expect(setPlaylistSidebarHiddenMock).toHaveBeenCalledWith("pl-1", false);
      expect(screen.queryByText("Desk Set")).toBeNull();
    });
  });

  it("shows hidden concept albums in the visibility section", async () => {
    listPlaylistsMock.mockResolvedValue([]);
    listConceptAlbumsMock.mockResolvedValue([
      { id: "ca-1", title: "Night Archive", hiddenFromSidebar: true, artist: "North", description: null, entryCount: 2, artworkKey: null, createdAt: "", updatedAt: "" },
    ]);
    listExcludedArtistsMock.mockResolvedValue([]);

    renderSettings();

    await screen.findByText("Night Archive");
    expect(screen.getByText("concept album · hidden from sidebar")).toBeTruthy();
  });

  it("show button on hidden concept album calls setConceptAlbumSidebarHidden and removes from list", async () => {
    listPlaylistsMock.mockResolvedValue([]);
    listConceptAlbumsMock.mockResolvedValue([
      { id: "ca-1", title: "Night Archive", hiddenFromSidebar: true, artist: "North", description: null, entryCount: 2, artworkKey: null, createdAt: "", updatedAt: "" },
    ]);
    listExcludedArtistsMock.mockResolvedValue([]);
    setConceptAlbumSidebarHiddenMock.mockResolvedValue(undefined);

    renderSettings();

    await screen.findByText("Night Archive");

    fireEvent.click(screen.getByRole("button", { name: /show/i }));

    await waitFor(() => {
      expect(setConceptAlbumSidebarHiddenMock).toHaveBeenCalledWith("ca-1", false);
      expect(screen.queryByText("Night Archive")).toBeNull();
    });
  });

  it("shows excluded artists in the visibility section", async () => {
    listPlaylistsMock.mockResolvedValue([]);
    listConceptAlbumsMock.mockResolvedValue([]);
    listExcludedArtistsMock.mockResolvedValue(["North"]);

    renderSettings();

    await screen.findByText("North");
    expect(screen.getByText("excluded from analytics")).toBeTruthy();
  });

  it("show button on excluded artist calls setArtistAnalyticsExcluded and removes from list", async () => {
    listPlaylistsMock.mockResolvedValue([]);
    listConceptAlbumsMock.mockResolvedValue([]);
    listExcludedArtistsMock.mockResolvedValue(["North"]);
    setArtistAnalyticsExcludedMock.mockResolvedValue(undefined);

    renderSettings();

    await screen.findByText("North");

    fireEvent.click(screen.getByRole("button", { name: /show/i }));

    await waitFor(() => {
      expect(setArtistAnalyticsExcludedMock).toHaveBeenCalledWith("North", false);
      expect(screen.queryByText("North")).toBeNull();
    });
  });

  it("renders visibility section with mixed hidden items", async () => {
    listPlaylistsMock.mockResolvedValue([
      { id: "pl-1", name: "Desk Set", hiddenFromSidebar: true, description: null, entryCount: 1, isMixtape: false, artworkKey: null, artworkPath: null, createdAt: "", updatedAt: "" },
    ]);
    listConceptAlbumsMock.mockResolvedValue([
      { id: "ca-1", title: "Night Archive", hiddenFromSidebar: true, artist: "North", description: null, entryCount: 2, artworkKey: null, createdAt: "", updatedAt: "" },
    ]);
    listExcludedArtistsMock.mockResolvedValue(["South"]);

    renderSettings();

    await screen.findByText("Desk Set");
    expect(screen.getByText("Night Archive")).toBeTruthy();
    expect(screen.getByText("South")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /show/i })).toHaveLength(3);
  });
});
