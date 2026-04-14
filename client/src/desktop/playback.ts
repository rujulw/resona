import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { resolveTrackPlaybackSource } from "./library";
import {
  invokeWithPreviewFallback,
  isBrowserPreviewRuntime,
  normalizeOptionalText,
  normalizePlaybackErrorPayload,
  normalizeTimingPayload,
  rethrowInDesktopRuntime,
} from "./runtime";
import { browserShellStatePayload } from "./shell";
import type {
  LoadedPlaybackTrackPayload,
  PlaybackContractPayload,
  PlaybackShellState,
  UnlistenPlaybackState,
} from "./types";

const browserPlaybackContractPayload: PlaybackContractPayload = {
  currentOwner: "frontend-audio-element during v1 baseline",
  migrationTarget: "rust playback runtime owns transport queue progress and source state",
  runtimeBoundary:
    "tauri commands mutate playback runtime and tauri events broadcast playback snapshots",
  sourceResolutionOrder: ["local", "cache", "remote"],
  commands: [
    {
      name: "load_playback_track",
      summary: "Resolve a track and replace the active playback item without forcing autoplay.",
      requestShape: "{ trackId, queueTrackIds?, startPositionSeconds? }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "playback_action",
      summary: "Apply a transport action such as play pause previous next stop or toggle.",
      requestShape: "{ action }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "seek_playback",
      summary: "Move the active playback position to an explicit second offset.",
      requestShape: "{ positionSeconds }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "sync_playback_timing",
      summary: "Report renderer-observed playback timing back into the backend snapshot.",
      requestShape: "{ progressSeconds?, durationSeconds? }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "complete_playback",
      summary: "Mark the active playback item as ended when the renderer reaches the end.",
      requestShape: "{}",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
    {
      name: "report_playback_error",
      summary: "Record a renderer playback failure without letting the shell invent its own error state.",
      requestShape: "{ transportLabel? }",
      responseShape: "PlaybackSnapshot",
      authority: "rust playback runtime",
    },
  ],
  events: [
    {
      name: "playback://state-changed",
      summary:
        "Broadcasts the latest backend playback snapshot after transport or source changes.",
      payloadShape: "PlaybackSnapshot",
      delivery: "emit to all frontend listeners after each committed playback state change",
    },
    {
      name: "playback://queue-changed",
      summary:
        "Broadcasts queue ownership changes when the backend replaces or advances the queue.",
      payloadShape: "PlaybackQueueSnapshot",
      delivery: "emit to all frontend listeners when queue order or active index changes",
    },
  ],
  guarantees: [
    "queue order remains stable even when the visible tracks table is filtered or resorted",
    "playback state snapshots include track identity transport status timing and source authority",
    "frontend shell renders playback state and dispatches commands but does not own transport truth after migration",
  ],
};

export async function loadPlaybackTrack(
  trackId: string,
): Promise<LoadedPlaybackTrackPayload | null> {
  type DesktopLoadedPlaybackTrackPayload = {
    playback: PlaybackShellState;
    source: { trackId: string; localPath: string; extension?: string };
  };

  const payload = await invokeWithPreviewFallback<
    DesktopLoadedPlaybackTrackPayload | LoadedPlaybackTrackPayload | null,
    { trackId: string }
  >(
    "load_playback_track",
    { trackId },
    async () => {
      const source = await resolveTrackPlaybackSource(trackId);
      if (!source) {
        return null;
      }

      return {
        playback: {
          ...browserShellStatePayload.playback,
          statusLabel: "Ready",
          transportLabel: "Ready",
          outputOwner: "frontend",
          trackId,
        },
        source,
      };
    },
  );

  if (!payload) {
    return null;
  }
    return {
      playback: payload.playback,
      source: {
        trackId: payload.source.trackId,
        localPath: payload.source.localPath,
        extension: payload.source.extension,
        assetUrl: convertFileSrc(payload.source.localPath),
      },
    };
}

export async function describePlaybackContract(): Promise<PlaybackContractPayload> {
  return invokeWithPreviewFallback(
    "describe_playback_contract",
    undefined,
    () => browserPlaybackContractPayload,
  );
}

export async function subscribePlaybackState(
  onPlayback: (playback: PlaybackShellState) => void,
): Promise<UnlistenPlaybackState> {
  try {
    return await listen<PlaybackShellState>("playback://state-changed", (event) => {
      onPlayback(event.payload);
    });
  } catch (error) {
    if (!isBrowserPreviewRuntime()) {
      rethrowInDesktopRuntime(error);
    }

    return () => undefined;
  }
}

export async function playbackAction(
  action: "previous" | "toggle" | "next",
): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback("playback_action", { action }, () => {
    if (action === "toggle") {
      return {
        ...browserShellStatePayload.playback,
        transportLabel: "Preview only",
        outputOwner: "frontend",
      };
    }

    return browserShellStatePayload.playback;
  });
}

export async function syncPlaybackTiming(
  progressSeconds?: number,
  durationSeconds?: number,
): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback(
    "sync_playback_timing",
    normalizeTimingPayload(progressSeconds, durationSeconds),
    () => browserShellStatePayload.playback,
  );
}

export async function seekPlayback(positionSeconds: number): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback("seek_playback", { positionSeconds }, () => ({
    ...browserShellStatePayload.playback,
    outputOwner: "frontend",
    progressSeconds: positionSeconds,
  }));
}

export async function completePlayback(): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback("complete_playback", undefined, () => ({
    ...browserShellStatePayload.playback,
    statusLabel: "Ended",
    transportLabel: "Ended",
    outputOwner: "frontend",
  }));
}

export async function reportPlaybackError(
  transportLabel?: string,
): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback(
    "report_playback_error",
    normalizePlaybackErrorPayload(transportLabel),
    () => ({
      ...browserShellStatePayload.playback,
      statusLabel: "Error",
      transportLabel: normalizeOptionalText(transportLabel) ?? "Playback error",
      outputOwner: "frontend",
    }),
  );
}
