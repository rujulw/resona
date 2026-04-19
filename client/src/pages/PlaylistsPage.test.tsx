// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { setupAppDesktopHarness, desktopMocks } from "../test/appDesktopHarness";

describe("playlists page", () => {
  setupAppDesktopHarness();

  it("renders playlist detail flows for select delete reorder playback and add-track", async () => {
    window.history.replaceState({}, "", "/playlists/playlist-1");
    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);

    const { default: App } = await import("../App");
    render(<App />);

    await screen.findByRole("heading", { name: "Desk Set" });
    expect(desktopMocks.getPlaylistMock).toHaveBeenCalledWith("playlist-1");

    fireEvent.click(screen.getAllByRole("button", { name: /add/i })[1]);
    await waitFor(() => {
      expect(desktopMocks.addTrackToPlaylistMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByLabelText(/play bravo/i));
    await waitFor(() => {
      expect(desktopMocks.handoffPlaylistToQueueMock).toHaveBeenCalledWith(
        "playlist-1",
        "playlist-entry-2",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /delete playlist/i }));
    await waitFor(() => {
      expect(desktopMocks.deletePlaylistMock).toHaveBeenCalledWith("playlist-1");
    });

    confirmMock.mockRestore();
  });

  it("routes playlist entry album links into the albums page", async () => {
    window.history.replaceState({}, "", "/playlists/playlist-1");

    const { default: App } = await import("../App");
    render(<App />);

    await screen.findByRole("heading", { name: "Desk Set" });

    fireEvent.click(screen.getByRole("link", { name: "Signals" }));

    await waitFor(() => {
      expect(desktopMocks.getAlbumMock).toHaveBeenCalledWith("album:signals:north");
      expect(screen.getByRole("heading", { name: "Signals" })).toBeTruthy();
    });
  });

  it("smoke-covers the playlist route shell with saved order handoff controls and dialog creation", async () => {
    window.history.replaceState({}, "", "/playlists/playlist-1");

    const { default: App } = await import("../App");
    render(<App />);

    await screen.findByRole("heading", { name: "Desk Set" });

    expect(screen.getByText("saved order")).toBeTruthy();
    expect(screen.getByText("library handoff")).toBeTruthy();
    expect(screen.getByRole("button", { name: /create playlist/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /play playlist/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /create playlist/i }));
    expect(screen.getByRole("dialog", { name: /create playlist/i })).toBeTruthy();
  });

  it("creates a playlist from the empty playlists state without using a native prompt", async () => {
    window.history.replaceState({}, "", "/playlists");
    desktopMocks.listPlaylistsMock.mockReset();
    desktopMocks.getPlaylistMock.mockReset();
    desktopMocks.createPlaylistMock.mockReset();

    desktopMocks.listPlaylistsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "playlist-2",
          name: "Late Night Mix",
          description: null,
          entryCount: 0,
          createdAt: "1700000200",
          updatedAt: "1700000200",
        },
      ]);
    desktopMocks.getPlaylistMock.mockResolvedValue({
      playlist: {
        id: "playlist-2",
        name: "Late Night Mix",
        description: null,
        entryCount: 0,
        createdAt: "1700000200",
        updatedAt: "1700000200",
      },
      entries: [],
    });
    desktopMocks.createPlaylistMock.mockResolvedValue({
      id: "playlist-2",
      name: "Late Night Mix",
      description: null,
      entryCount: 0,
      createdAt: "1700000200",
      updatedAt: "1700000200",
    });

    const { default: App } = await import("../App");
    render(<App />);

    await screen.findByText("no playlists yet");

    fireEvent.click(screen.getByRole("button", { name: /create playlist/i }));
    const createDialog = screen.getByRole("dialog", { name: /create playlist/i });
    fireEvent.change(within(createDialog).getByLabelText("playlist name"), {
      target: { value: "Late Night Mix" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: /^create playlist$/i }));

    await waitFor(() => {
      expect(desktopMocks.createPlaylistMock).toHaveBeenCalledWith(
        "Late Night Mix",
        null,
        null,
      );
      expect(desktopMocks.getPlaylistMock).toHaveBeenCalledWith("playlist-2");
    });
  });

  it("edits playlist metadata from the playlist detail header", async () => {
    window.history.replaceState({}, "", "/playlists/playlist-1");

    const { default: App } = await import("../App");
    render(<App />);

    await screen.findByRole("heading", { name: "Desk Set" });

    fireEvent.click(screen.getByRole("button", { name: /edit playlist/i }));
    const editDialog = screen.getByRole("dialog", { name: /edit playlist/i });
    fireEvent.change(within(editDialog).getByLabelText("playlist name"), {
      target: { value: "Night Drive" },
    });
    fireEvent.change(within(editDialog).getByLabelText("description"), {
      target: { value: "after midnight" },
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(desktopMocks.updatePlaylistMock).toHaveBeenCalledWith(
        "playlist-1",
        "Night Drive",
        "after midnight",
        null,
      );
    });
  });

  it("reorders saved-order rows only from the drag handle", async () => {
    const { PlaylistsPage } = await import("./PlaylistsPage");
    const onPlaylistEntriesReplace = vi.fn();

    render(
      <MemoryRouter initialEntries={["/playlists/playlist-1"]}>
        <Routes>
          <Route
            path="/playlists/:playlistId"
            element={
              <PlaylistsPage
                playlistsState={{
                  status: "ready",
                  items: [
                    {
                      id: "playlist-1",
                      name: "Desk Set",
                      description: "focused hours",
                      artworkKey: null,
                      entryCount: 2,
                      createdAt: "1700000100",
                      updatedAt: "1700000200",
                    },
                  ],
                  activePlaylistId: "playlist-1",
                  activePlaylist: {
                    playlist: {
                      id: "playlist-1",
                      name: "Desk Set",
                      description: "focused hours",
                      artworkKey: null,
                      entryCount: 2,
                      createdAt: "1700000100",
                      updatedAt: "1700000200",
                    },
                    entries: [
                      {
                        entryId: "playlist-entry-1",
                        playlistId: "playlist-1",
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
                      },
                      {
                        entryId: "playlist-entry-2",
                        playlistId: "playlist-1",
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
                      },
                    ],
                  },
                  playbackQueue: null,
                }}
                tracksState={{
                  status: "ready",
                  items: [],
                  total: 0,
                  selectedTrackId: null,
                }}
                albumsState={{
                  status: "ready",
                  items: [
                    {
                      id: "album:signals:north",
                      title: "Signals",
                      artist: "North",
                      trackCount: 1,
                      totalDurationSeconds: 182,
                      artworkKey: "alpha-cover.png",
                    },
                    {
                      id: "album:horizons:south",
                      title: "Horizons",
                      artist: "South",
                      trackCount: 1,
                      totalDurationSeconds: 205,
                      artworkKey: "bravo-cover.png",
                    },
                  ],
                  activeAlbumId: null,
                  activeAlbum: null,
                }}
                onCreatePlaylist={vi.fn(async () => null)}
                onPlaylistArtworkChange={vi.fn()}
                onPlaylistDelete={vi.fn()}
                onPlaylistEntryMove={vi.fn()}
                onPlaylistEntriesReplace={onPlaylistEntriesReplace}
                onPlaylistEntryRemove={vi.fn()}
                onPlaylistPlaybackHandoff={vi.fn()}
                onPlaylistRename={vi.fn()}
                onPlaylistSelect={vi.fn()}
                onTrackAdd={vi.fn()}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Desk Set" });

    const alphaRow = screen.getByRole("button", { name: /select alpha/i });
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
      expect(onPlaylistEntriesReplace).toHaveBeenCalledWith("playlist-1", [
        { entryId: "playlist-entry-2", trackId: "track-2", position: 0 },
        { entryId: "playlist-entry-1", trackId: "track-1", position: 1 },
      ]);
    });
  });
});
