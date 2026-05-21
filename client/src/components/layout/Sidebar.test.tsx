// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { setupAppDesktopHarness, desktopMocks } from "../../test/appDesktopHarness";

async function getSidebar(): Promise<HTMLElement> {
  await screen.findByRole("heading", { name: "resona", level: 1 });
  const aside = document.querySelector("aside");
  if (!aside) throw new Error("sidebar <aside> not found");
  return aside as HTMLElement;
}

describe("Sidebar context menu", () => {
  setupAppDesktopHarness();
  afterEach(() => cleanup());

  it("shows hide-from-sidebar menu on playlist right-click and removes item on confirm", async () => {
    desktopMocks.listPlaylistsMock.mockResolvedValue([
      {
        id: "playlist-1",
        name: "Desk Set",
        description: null,
        entryCount: 1,
        isMixtape: false,
        hiddenFromSidebar: false,
        artworkKey: null,
        artworkPath: null,
        createdAt: "1700000100",
        updatedAt: "1700000100",
      },
    ]);
    desktopMocks.listConceptAlbumsMock.mockResolvedValue([]);

    const { default: App } = await import("../../App");
    render(<App />);

    const sidebar = await getSidebar();
    const playlistLink = await within(sidebar).findByText("Desk Set");

    fireEvent.contextMenu(playlistLink);

    expect(screen.getByText("Hide")).toBeTruthy();

    fireEvent.click(screen.getByText("Hide"));

    await waitFor(() => {
      expect(within(sidebar).queryByText("Desk Set")).toBeNull();
    });
  });

  it("shows hide-from-sidebar menu on concept album right-click and removes item on confirm", async () => {
    desktopMocks.listPlaylistsMock.mockResolvedValue([]);
    desktopMocks.listConceptAlbumsMock.mockResolvedValue([
      {
        id: "ca-1",
        title: "Night Archive",
        artist: "North",
        description: null,
        entryCount: 2,
        hiddenFromSidebar: false,
        artworkKey: null,
        createdAt: "1700000100",
        updatedAt: "1700000200",
      },
    ]);

    const { default: App } = await import("../../App");
    render(<App />);

    const sidebar = await getSidebar();
    const caLink = await within(sidebar).findByText("Night Archive");

    fireEvent.contextMenu(caLink);

    expect(screen.getByText("Hide")).toBeTruthy();

    fireEvent.click(screen.getByText("Hide"));

    await waitFor(() => {
      expect(within(sidebar).queryByText("Night Archive")).toBeNull();
    });
  });

  it("dismisses context menu on Escape key", async () => {
    desktopMocks.listPlaylistsMock.mockResolvedValue([
      {
        id: "playlist-1",
        name: "Desk Set",
        description: null,
        entryCount: 1,
        isMixtape: false,
        hiddenFromSidebar: false,
        artworkKey: null,
        artworkPath: null,
        createdAt: "1700000100",
        updatedAt: "1700000100",
      },
    ]);
    desktopMocks.listConceptAlbumsMock.mockResolvedValue([]);

    const { default: App } = await import("../../App");
    render(<App />);

    const sidebar = await getSidebar();
    const playlistLink = await within(sidebar).findByText("Desk Set");

    fireEvent.contextMenu(playlistLink);
    expect(screen.getByText("Hide")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("Hide")).toBeNull();
    });
  });

  it("shows empty state when no collections exist", async () => {
    desktopMocks.listPlaylistsMock.mockResolvedValue([]);
    desktopMocks.listConceptAlbumsMock.mockResolvedValue([]);

    const { default: App } = await import("../../App");
    render(<App />);

    const sidebar = await getSidebar();

    await within(sidebar).findByText("No collections yet.");
  });
});
