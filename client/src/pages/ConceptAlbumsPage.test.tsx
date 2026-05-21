// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { desktopMocks, setupAppDesktopHarness } from "../test/appDesktopHarness";

describe("concept albums page", () => {
  setupAppDesktopHarness();

  it("renders the concept album library surface and hydrates release detail", async () => {
    window.history.replaceState({}, "", "/concept-albums/concept-album-1");

    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      expect(desktopMocks.getConceptAlbumMock).toHaveBeenCalledWith("concept-album-1");
      expect(screen.getByRole("heading", { name: "Night Archive" })).toBeTruthy();
      expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Bravo").length).toBeGreaterThan(0);
      expect(screen.getByText("library handoff")).toBeTruthy();
    });
  });

  it("edits concept album metadata from the release header", async () => {
    window.history.replaceState({}, "", "/concept-albums/concept-album-1");
    desktopMocks.updateConceptAlbumMock.mockResolvedValue({
      id: "concept-album-1",
      title: "Dawn Archive",
      artist: "North",
      description: "sunrise pass",
      artworkKey: "night-cover.png",
      entryCount: 2,
      createdAt: "1700000100",
      updatedAt: "1700000300",
    });

    const { default: App } = await import("../App");
    render(<App />);

    await screen.findByRole("heading", { name: "Night Archive" });

    fireEvent.click(screen.getByRole("button", { name: /edit concept album/i }));
    const editDialog = screen.getByRole("dialog", { name: /edit concept album/i });
    fireEvent.change(within(editDialog).getByLabelText("release title"), {
      target: { value: "Dawn Archive" },
    });
    fireEvent.change(within(editDialog).getByLabelText("release artist"), {
      target: { value: "North" },
    });
    fireEvent.change(within(editDialog).getByLabelText("description"), {
      target: { value: "sunrise pass" },
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(desktopMocks.updateConceptAlbumMock).toHaveBeenCalledWith(
        "concept-album-1",
        "Dawn Archive",
        "North",
        "sunrise pass",
        "night-cover.png",
      );
    });
  });

  it("creates the first concept album from the empty route state", async () => {
    window.history.replaceState({}, "", "/concept-albums");
    desktopMocks.listConceptAlbumsMock.mockReset();
    desktopMocks.getConceptAlbumMock.mockReset();
    desktopMocks.createConceptAlbumMock.mockReset();

    desktopMocks.listConceptAlbumsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "concept-album-2",
          title: "Glass City",
          artist: "South",
          description: "rain run",
          artworkKey: null,
          entryCount: 0,
          createdAt: "1700000400",
          updatedAt: "1700000400",
        },
      ]);
    desktopMocks.getConceptAlbumMock.mockResolvedValue({
      conceptAlbum: {
        id: "concept-album-2",
        title: "Glass City",
        artist: "South",
        description: "rain run",
        artworkKey: null,
        entryCount: 0,
        createdAt: "1700000400",
        updatedAt: "1700000400",
      },
      entries: [],
    });
    desktopMocks.createConceptAlbumMock.mockResolvedValue({
      id: "concept-album-2",
      title: "Glass City",
      artist: "South",
      description: "rain run",
      artworkKey: null,
      entryCount: 0,
      createdAt: "1700000400",
      updatedAt: "1700000400",
    });

    const { default: App } = await import("../App");
    render(<App />);

    await screen.findByText("no concept albums yet");

    fireEvent.click(screen.getByRole("button", { name: /create concept album/i }));
    const createDialog = screen.getByRole("dialog", { name: /create concept album/i });
    fireEvent.change(within(createDialog).getByLabelText("release title"), {
      target: { value: "Glass City" },
    });
    fireEvent.change(within(createDialog).getByLabelText("release artist"), {
      target: { value: "South" },
    });
    fireEvent.change(within(createDialog).getByLabelText("description"), {
      target: { value: "rain run" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: /^create concept album$/i }));

    await waitFor(() => {
      expect(desktopMocks.createConceptAlbumMock).toHaveBeenCalledWith(
        "Glass City",
        "South",
        "rain run",
        null,
      );
      expect(desktopMocks.getConceptAlbumMock).toHaveBeenCalledWith("concept-album-2");
    });
  });

  it("plays a concept album entry through the queue flow", async () => {
    window.history.replaceState({}, "", "/concept-albums/concept-album-1");
    desktopMocks.loadPlaybackTrackMock.mockImplementation(async (trackId: string) => ({
      playback: {
        statusLabel: "Ready",
        transportLabel: "Ready",
        progressSeconds: 0,
        durationSeconds: trackId === "track-1" ? 182 : 205,
        isPlaying: false,
        outputOwner: "rust",
        trackId,
        trackTitle: trackId === "track-1" ? "Alpha" : "Bravo",
        trackArtist: "North",
        trackAlbum: "Night Archive",
        trackAdvisory: null,
      },
      source: {
        trackId,
        localPath: `/Users/rujulw/Music/${trackId}.mp3`,
        assetUrl: `asset://localhost/${trackId}.mp3`,
      },
    }));

    const { default: App } = await import("../App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /play concept album/i }));

    await waitFor(() => {
      expect(desktopMocks.loadPlaybackTrackMock).toHaveBeenCalledWith("track-1");
    });
  });

  it("selects and deletes a concept album entry with backspace", async () => {
    window.history.replaceState({}, "", "/concept-albums/concept-album-1");
    desktopMocks.removeConceptAlbumEntryMock.mockResolvedValue({
      conceptAlbum: {
        id: "concept-album-1",
        title: "Night Archive",
        artist: "North",
        description: "city sequence",
        artworkKey: "night-cover.png",
        entryCount: 1,
        createdAt: "1700000100",
        updatedAt: "1700000300",
      },
      entries: [
        {
          entryId: "concept-entry-2",
          conceptAlbumId: "concept-album-1",
          trackId: "track-2",
          position: 0,
          addedAt: "1700000200",
          updatedAt: "1700000300",
          title: "Bravo",
          artist: "South",
          album: "Horizons",
          artworkKey: "bravo-cover.png",
          extension: "mp3",
          durationSeconds: 205,
          trackNumber: 1,
          discNumber: 1,
        },
      ],
    });

    const { default: App } = await import("../App");
    render(<App />);

    const alphaRow = await screen.findByRole("button", { name: /select alpha/i });
    fireEvent.click(alphaRow);
    fireEvent.keyDown(alphaRow, { key: "Backspace" });

    await waitFor(() => {
      expect(desktopMocks.removeConceptAlbumEntryMock).toHaveBeenCalledWith(
        "concept-album-1",
        "concept-entry-1",
      );
    });
  });

  it("reorders concept album rows from the drag handle", async () => {
    const { ConceptAlbumsPage } = await import("./ConceptAlbumsPage");
    const onConceptAlbumEntriesReplace = vi.fn();

    render(
      <MemoryRouter initialEntries={["/concept-albums/concept-album-1"]}>
        <Routes>
          <Route
            path="/concept-albums/:conceptAlbumId"
            element={
              <ConceptAlbumsPage
                conceptAlbumsState={{
                  status: "ready",
                  items: [
                    {
                      id: "concept-album-1",
                      title: "Night Archive",
                      artist: "North",
                      description: "city sequence",
                      artworkKey: "night-cover.png",
                      artworkPath: null,
                      entryCount: 2,
                      hiddenFromSidebar: false,
                      createdAt: "1700000100",
                      updatedAt: "1700000200",
                    },
                  ],
                  activeConceptAlbumId: "concept-album-1",
                  activeConceptAlbum: {
                    conceptAlbum: {
                      id: "concept-album-1",
                      title: "Night Archive",
                      artist: "North",
                      description: "city sequence",
                      artworkKey: "night-cover.png",
                      artworkPath: null,
                      entryCount: 2,
                      hiddenFromSidebar: false,
                      createdAt: "1700000100",
                      updatedAt: "1700000200",
                    },
                    entries: [
                      {
                        entryId: "concept-entry-1",
                        conceptAlbumId: "concept-album-1",
                        trackId: "track-1",
                        position: 0,
                        addedAt: "1700000100",
                        updatedAt: "1700000100",
                        title: "Alpha",
                        artist: "North",
                        album: "Signals",
                        artworkKey: "alpha-cover.png",
                        extension: "mp3",
                        durationSeconds: 182,
                        trackNumber: 1,
                        discNumber: 1,
                      },
                      {
                        entryId: "concept-entry-2",
                        conceptAlbumId: "concept-album-1",
                        trackId: "track-2",
                        position: 1,
                        addedAt: "1700000200",
                        updatedAt: "1700000200",
                        title: "Bravo",
                        artist: "South",
                        album: "Horizons",
                        artworkKey: "bravo-cover.png",
                        extension: "mp3",
                        durationSeconds: 205,
                        trackNumber: 2,
                        discNumber: 1,
                      },
                    ],
                  },
                }}
                tracksState={{
                  status: "ready",
                  items: [],
                  total: 0,
                  selectedTrackId: null,
                }}
                albumsState={{
                  status: "ready",
                  items: [],
                  activeAlbumId: null,
                  activeAlbum: null,
                }}
                onConceptAlbumCreate={vi.fn(async () => null)}
                onConceptAlbumArtworkChange={vi.fn()}
                onConceptAlbumDelete={vi.fn()}
                onConceptAlbumEntryMove={vi.fn()}
                onConceptAlbumEntriesReplace={onConceptAlbumEntriesReplace}
                onConceptAlbumEntryRemove={vi.fn()}
                onConceptAlbumPlaybackHandoff={vi.fn()}
                onConceptAlbumRename={vi.fn()}
                onConceptAlbumSelect={vi.fn()}
                onConceptAlbumTrackAdd={vi.fn()}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Night Archive" });

    const bravoRow = screen.getByRole("button", { name: /select bravo/i });
    const alphaDragHandle = screen.getByRole("button", { name: /drag alpha/i });

    vi.spyOn(bravoRow, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 640,
      height: 48,
      top: 0,
      right: 640,
      bottom: 48,
      left: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(alphaDragHandle, { buttons: 1, clientY: 8 });
    fireEvent.mouseMove(bravoRow, { buttons: 1, clientY: 40 });
    fireEvent.mouseUp(bravoRow, { clientY: 40 });

    await waitFor(() => {
      expect(onConceptAlbumEntriesReplace).toHaveBeenCalledWith("concept-album-1", [
        { entryId: "concept-entry-2", trackId: "track-2", position: 0 },
        { entryId: "concept-entry-1", trackId: "track-1", position: 1 },
      ]);
    });
  });
});
