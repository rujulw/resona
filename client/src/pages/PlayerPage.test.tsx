// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerPage } from "./PlayerPage";
import type { QueueState } from "../types/app";

vi.mock("../desktop", () => ({
  resolveArtworkSource: vi.fn().mockResolvedValue(null),
}));

afterEach(cleanup);

const AUDIO_REF = { current: null } as React.RefObject<HTMLAudioElement | null>;

function makeTrack(id: string, title: string) {
  return {
    id,
    title,
    artist: "Test Artist",
    album: "Test Album",
    advisory: null,
    durationSeconds: 180,
    artworkKey: null,
    relativePath: "",
    extension: "mp3",
    sourceStatus: "local-only" as const,
    cacheState: "none" as const,
    analysisStatus: "pending" as const,
    indexedAt: "",
  };
}

function makeQueueState(overrides: Partial<QueueState> = {}): QueueState {
  return {
    activeTrack: null,
    upcomingTracks: [],
    totalTracks: 0,
    ...overrides,
  };
}

describe("PlayerPage", () => {
  it("renders empty state when no active track", () => {
    render(
      <PlayerPage
        queueState={makeQueueState()}
        isPlaying={false}
        audioRef={AUDIO_REF}
        onQueueReorder={vi.fn()}
      />,
    );
    expect(screen.getByText("queue is waiting")).toBeTruthy();
  });

  it("renders active track with no upcoming tracks", () => {
    render(
      <PlayerPage
        queueState={makeQueueState({ activeTrack: makeTrack("t1", "Alpha"), totalTracks: 1 })}
        isPlaying={false}
        audioRef={AUDIO_REF}
        onQueueReorder={vi.fn()}
      />,
    );
    expect(screen.queryByText("up next")).toBeNull();
  });

  it("renders setlist with upcoming tracks", () => {
    render(
      <PlayerPage
        queueState={makeQueueState({
          activeTrack: makeTrack("t1", "Alpha"),
          upcomingTracks: [makeTrack("t2", "Bravo"), makeTrack("t3", "Charlie")],
          totalTracks: 3,
        })}
        isPlaying={false}
        audioRef={AUDIO_REF}
        onQueueReorder={vi.fn()}
      />,
    );
    expect(screen.getByText("up next")).toBeTruthy();
    expect(screen.getByText("Bravo")).toBeTruthy();
    expect(screen.getByText("Charlie")).toBeTruthy();
  });

  it("shows numbered positions in setlist", () => {
    render(
      <PlayerPage
        queueState={makeQueueState({
          activeTrack: makeTrack("t1", "Alpha"),
          upcomingTracks: [makeTrack("t2", "Bravo"), makeTrack("t3", "Charlie")],
          totalTracks: 3,
        })}
        isPlaying={false}
        audioRef={AUDIO_REF}
        onQueueReorder={vi.fn()}
      />,
    );
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.getByText("02")).toBeTruthy();
  });

  it("calls onQueueReorder with reordered ids when drop occurs", () => {
    const onQueueReorder = vi.fn();
    const activeTrack = makeTrack("t1", "Alpha");
    const upcoming = [makeTrack("t2", "Bravo"), makeTrack("t3", "Charlie"), makeTrack("t4", "Delta")];

    render(
      <PlayerPage
        queueState={makeQueueState({ activeTrack, upcomingTracks: upcoming, totalTracks: 4 })}
        isPlaying={false}
        audioRef={AUDIO_REF}
        onQueueReorder={onQueueReorder}
      />,
    );

    const rows = screen.getAllByText(/Bravo|Charlie|Delta/).map(
      (el) => el.closest("[draggable]") as HTMLElement,
    );

    // drag Bravo (index 0) and drop at Charlie (index 1)
    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[1], { clientY: 9999 }); // bottom half → insert after
    fireEvent.drop(rows[1]);

    expect(onQueueReorder).toHaveBeenCalledOnce();
    const [ids] = onQueueReorder.mock.calls[0] as [string[]];
    expect(ids[0]).toBe("t1"); // active track always first
    expect(ids).toContain("t2");
    expect(ids).toContain("t3");
    expect(ids).toContain("t4");
  });

  it("cancels drag when dragEnd fires without drop", () => {
    const onQueueReorder = vi.fn();
    const activeTrack = makeTrack("t1", "Alpha");
    const upcoming = [makeTrack("t2", "Bravo"), makeTrack("t3", "Charlie")];

    render(
      <PlayerPage
        queueState={makeQueueState({ activeTrack, upcomingTracks: upcoming, totalTracks: 3 })}
        isPlaying={false}
        audioRef={AUDIO_REF}
        onQueueReorder={onQueueReorder}
      />,
    );

    const rows = screen.getAllByText(/Bravo|Charlie/).map(
      (el) => el.closest("[draggable]") as HTMLElement,
    );

    fireEvent.dragStart(rows[0]);
    fireEvent.dragEnd(rows[0]);

    expect(onQueueReorder).not.toHaveBeenCalled();
  });
});
