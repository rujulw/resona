import { describe, expect, it } from "vitest";
import { selectActivePlaybackTrackId } from "./playbackSelectors";
import type { ShellState, TracksState } from "../../types/app";

function makeTracksState(selectedTrackId: string | null): TracksState {
  return { status: "ready", items: [], total: 0, selectedTrackId };
}

function makeShellState(trackId: string | null): ShellState {
  return {
    libraryRows: [],
    playback: {
      statusLabel: "Playing",
      transportLabel: "Playing",
      progressSeconds: 0,
      durationSeconds: 180,
      isPlaying: true,
      outputOwner: "frontend",
      trackId,
      trackTitle: null,
      trackArtist: null,
      trackAlbum: null,
      trackAdvisory: null,
    },
  };
}

describe("selectActivePlaybackTrackId", () => {
  it("returns selectedTrackId when both sources are set (selectedTrackId wins)", () => {
    const result = selectActivePlaybackTrackId(
      makeShellState("old-track"),
      makeTracksState("new-track"),
    );
    expect(result).toBe("new-track");
  });

  it("falls back to shellState.playback.trackId when selectedTrackId is null", () => {
    const result = selectActivePlaybackTrackId(
      makeShellState("shell-track"),
      makeTracksState(null),
    );
    expect(result).toBe("shell-track");
  });

  it("returns null when both sources are null", () => {
    const result = selectActivePlaybackTrackId(null, makeTracksState(null));
    expect(result).toBeNull();
  });

  it("returns selectedTrackId when shellState is null", () => {
    const result = selectActivePlaybackTrackId(null, makeTracksState("selected"));
    expect(result).toBe("selected");
  });

  it("returns null when shellState has null trackId and selectedTrackId is null", () => {
    const result = selectActivePlaybackTrackId(
      makeShellState(null),
      makeTracksState(null),
    );
    expect(result).toBeNull();
  });
});
