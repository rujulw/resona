import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const listenMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (filePath: string) => `asset://localhost/${encodeURIComponent(filePath)}`,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

describe("desktop playback bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    listenMock.mockReset();
    delete (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    delete (globalThis as typeof globalThis & { __TAURI__?: unknown }).__TAURI__;
  });

  it("falls back to preview playback state when shell actions are unavailable", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));

    const { playbackAction } = await import("./playback");
    const payload = await playbackAction("toggle");

    expect(payload.statusLabel).toBe("Nothing playing");
    expect(payload.transportLabel).toBe("Preview only");
  });

  it("loads a playback track through the backend runtime contract", async () => {
    invokeMock.mockResolvedValueOnce({
      playback: {
        statusLabel: "Ready",
        transportLabel: "Ready",
        progressSeconds: 0,
        durationSeconds: 182,
        isPlaying: false,
        trackId: "track-1",
        trackTitle: "Alpha",
        trackArtist: "North",
        trackAlbum: "Signals",
      },
      source: {
        trackId: "track-1",
        localPath: "/Users/rujulw/Music/alpha.mp3",
        extension: "mp3",
      },
    });

    const { loadPlaybackTrack } = await import("./playback");
    const payload = await loadPlaybackTrack("track-1");

    expect(invokeMock).toHaveBeenCalledWith("load_playback_track", { trackId: "track-1" });
    expect(payload?.source.assetUrl).toContain("asset://localhost/");
    expect(payload?.source.extension).toBe("mp3");
    expect(payload?.playback.trackTitle).toBe("Alpha");
  });

  it("reports timing updates through the playback runtime contract", async () => {
    invokeMock.mockResolvedValueOnce({
      statusLabel: "Playing",
      transportLabel: "Playing",
      progressSeconds: 41,
      durationSeconds: 182,
      isPlaying: true,
    });

    const { syncPlaybackTiming } = await import("./playback");
    const payload = await syncPlaybackTiming(41, 182);

    expect(invokeMock).toHaveBeenCalledWith("sync_playback_timing", {
      progressSeconds: 41,
      durationSeconds: 182,
    });
    expect(payload.progressSeconds).toBe(41);
  });

  it("normalizes empty timing values before invoking the playback runtime", async () => {
    invokeMock.mockResolvedValueOnce({
      statusLabel: "Idle",
      transportLabel: "Idle",
      progressSeconds: 0,
      durationSeconds: 0,
      isPlaying: false,
    });

    const { syncPlaybackTiming } = await import("./playback");
    await syncPlaybackTiming();

    expect(invokeMock).toHaveBeenCalledWith("sync_playback_timing", {
      progressSeconds: null,
      durationSeconds: null,
    });
  });

  it("reports explicit seek updates through the playback runtime contract", async () => {
    invokeMock.mockResolvedValueOnce({
      statusLabel: "Paused",
      transportLabel: "Paused",
      progressSeconds: 0,
      durationSeconds: 182,
      isPlaying: false,
    });

    const { seekPlayback } = await import("./playback");
    const payload = await seekPlayback(0);

    expect(invokeMock).toHaveBeenCalledWith("seek_playback", {
      positionSeconds: 0,
    });
    expect(payload.progressSeconds).toBe(0);
  });

  it("reports playback completion through the backend runtime contract", async () => {
    invokeMock.mockResolvedValueOnce({
      statusLabel: "Ended",
      transportLabel: "Ended",
      progressSeconds: 182,
      durationSeconds: 182,
      isPlaying: false,
    });

    const { completePlayback } = await import("./playback");
    const payload = await completePlayback();

    expect(invokeMock).toHaveBeenCalledWith("complete_playback");
    expect(payload.transportLabel).toBe("Ended");
  });

  it("reports playback errors through the backend runtime contract", async () => {
    invokeMock.mockResolvedValueOnce({
      statusLabel: "Error",
      transportLabel: "Playback blocked",
      progressSeconds: 0,
      durationSeconds: 182,
      isPlaying: false,
    });

    const { reportPlaybackError } = await import("./playback");
    const payload = await reportPlaybackError("Playback blocked");

    expect(invokeMock).toHaveBeenCalledWith("report_playback_error", {
      transportLabel: "Playback blocked",
    });
    expect(payload.statusLabel).toBe("Error");
  });

  it("normalizes empty playback errors before invoking the backend runtime contract", async () => {
    invokeMock.mockResolvedValueOnce({
      statusLabel: "Error",
      transportLabel: "Playback error",
      progressSeconds: 0,
      durationSeconds: 0,
      isPlaying: false,
    });

    const { reportPlaybackError } = await import("./playback");
    await reportPlaybackError();

    expect(invokeMock).toHaveBeenCalledWith("report_playback_error", {
      transportLabel: null,
    });
  });

  it("describes the rust playback migration contract through the command bridge", async () => {
    invokeMock.mockResolvedValueOnce({
      currentOwner: "frontend-audio-element during v1 baseline",
      migrationTarget: "rust playback runtime owns transport queue progress and source state",
      runtimeBoundary:
        "tauri commands mutate playback runtime and tauri events broadcast playback snapshots",
      sourceResolutionOrder: ["local", "cache", "remote"],
      commands: [
        {
          name: "load_playback_track",
          summary: "load active playback item",
          requestShape: "{ trackId }",
          responseShape: "PlaybackSnapshot",
          authority: "rust playback runtime",
        },
      ],
      events: [
        {
          name: "playback://state-changed",
          summary: "state sync",
          payloadShape: "PlaybackSnapshot",
          delivery: "emit to listeners",
        },
      ],
      guarantees: ["queue order remains stable"],
    });

    const { describePlaybackContract } = await import("./playback");
    const payload = await describePlaybackContract();

    expect(invokeMock).toHaveBeenCalledWith("describe_playback_contract");
    expect(payload.commands[0].name).toBe("load_playback_track");
    expect(payload.events[0].name).toBe("playback://state-changed");
  });

  it("subscribes to backend playback state events", async () => {
    const unlisten = vi.fn();
    let handler:
      | ((event: { payload: {
          statusLabel: string;
          transportLabel: string;
          progressSeconds: number;
          durationSeconds: number;
        } }) => void)
      | undefined;

    listenMock.mockImplementationOnce(
      async (
        eventName: string,
        callback: (event: {
          payload: {
            statusLabel: string;
            transportLabel: string;
            progressSeconds: number;
            durationSeconds: number;
          };
        }) => void,
      ) => {
        expect(eventName).toBe("playback://state-changed");
        handler = callback;
        return unlisten;
      },
    );

    const onPlayback = vi.fn();
    const { subscribePlaybackState } = await import("./playback");
    const detach = await subscribePlaybackState(onPlayback);

    handler?.({
      payload: {
        statusLabel: "Playing",
        transportLabel: "Playing",
        progressSeconds: 0,
        durationSeconds: 182,
      },
    });

    expect(onPlayback).toHaveBeenCalledWith({
      statusLabel: "Playing",
      transportLabel: "Playing",
      progressSeconds: 0,
      durationSeconds: 182,
    });
    expect(detach).toBe(unlisten);
  });

  it("returns a no-op playback subscription when preview runtime events are unavailable", async () => {
    listenMock.mockRejectedValueOnce(new Error("bridge unavailable"));

    const onPlayback = vi.fn();
    const { subscribePlaybackState } = await import("./playback");
    const detach = await subscribePlaybackState(onPlayback);

    expect(onPlayback).not.toHaveBeenCalled();
    expect(detach).toEqual(expect.any(Function));
    expect(detach()).toBeUndefined();
  });

  it("pushes a track to the front of the queue via mutate_queue with mode next", async () => {
    invokeMock.mockResolvedValueOnce({ trackIds: ["track-2", "track-1"], activeTrackId: "track-1", sourceLabel: "search" });

    const { mutateQueue } = await import("./playback");
    const snapshot = await mutateQueue("track-2", "next");

    expect(invokeMock).toHaveBeenCalledWith("mutate_queue", { trackId: "track-2", mode: "next" });
    expect(snapshot.trackIds[0]).toBe("track-2");
  });

  it("appends a track to the end of the queue via mutate_queue with mode last", async () => {
    invokeMock.mockResolvedValueOnce({ trackIds: ["track-1", "track-2"], activeTrackId: "track-1", sourceLabel: "search" });

    const { mutateQueue } = await import("./playback");
    const snapshot = await mutateQueue("track-2", "last");

    expect(invokeMock).toHaveBeenCalledWith("mutate_queue", { trackId: "track-2", mode: "last" });
    expect(snapshot.trackIds[snapshot.trackIds.length - 1]).toBe("track-2");
  });

  it("replaces queue order via reorder_queue", async () => {
    const newOrder = ["track-3", "track-1", "track-2"];
    invokeMock.mockResolvedValueOnce({ trackIds: newOrder, activeTrackId: "track-3", sourceLabel: "manual" });

    const { reorderQueue } = await import("./playback");
    const snapshot = await reorderQueue(newOrder);

    expect(invokeMock).toHaveBeenCalledWith("reorder_queue", { trackIds: newOrder });
    expect(snapshot.trackIds).toEqual(newOrder);
  });

  it("falls back to empty snapshot for mutateQueue when bridge is unavailable", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));

    const { mutateQueue } = await import("./playback");
    const snapshot = await mutateQueue("track-x", "next");

    expect(snapshot.trackIds).toEqual([]);
    expect(snapshot.activeTrackId).toBeNull();
  });

  it("falls back to provided trackIds for reorderQueue when bridge is unavailable", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));

    const { reorderQueue } = await import("./playback");
    const ids = ["track-a", "track-b"];
    const snapshot = await reorderQueue(ids);

    expect(snapshot.trackIds).toEqual(ids);
  });

});
