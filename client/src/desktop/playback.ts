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

import type {
  LoadedPlaybackTrackPayload,
  PlaybackContractPayload,
  PlaybackShellState,
  UnlistenPlaybackState,
} from "./types";

import {
  getNoopUnlisten,
  getPreviewCompletedPlaybackState,
  getPreviewLoadedPlaybackTrack,
  getPreviewPlaybackActionState,
  getPreviewPlaybackContract,
  getPreviewPlaybackError,
  getPreviewPlaybackSeekState,
  getPreviewPlaybackTimingState,
} from "./previewRuntime";


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
      return getPreviewLoadedPlaybackTrack(trackId, source);
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
    () => getPreviewPlaybackContract(),
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

    return getNoopUnlisten();
  }
}

export async function playbackAction(
  action: "previous" | "toggle" | "next",
): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback("playback_action", { action }, () =>
    getPreviewPlaybackActionState(action),
  );
}

export async function syncPlaybackTiming(
  progressSeconds?: number,
  durationSeconds?: number,
): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback(
    "sync_playback_timing",
    normalizeTimingPayload(progressSeconds, durationSeconds),
    () => getPreviewPlaybackTimingState(progressSeconds, durationSeconds),
  );
}

export async function seekPlayback(positionSeconds: number): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback("seek_playback", { positionSeconds }, () =>
    getPreviewPlaybackSeekState(positionSeconds),
  );
}

export async function completePlayback(): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback("complete_playback", undefined, () =>
    getPreviewCompletedPlaybackState(),
  );
}

export async function reportPlaybackError(
  transportLabel?: string,
): Promise<PlaybackShellState> {
  return invokeWithPreviewFallback(
    "report_playback_error",
    normalizePlaybackErrorPayload(transportLabel),
    () => getPreviewPlaybackError(normalizeOptionalText(transportLabel)),
  );
}

export async function recordPlayEvent(trackId: string): Promise<void> {
  return invokeWithPreviewFallback(
    "record_play_event",
    { trackId },
    () => undefined,
  );
}

export type AutoContinueResult = {
  trackIds: string[];
  sourceLabel: string;
};

export async function resolveAutoContinue(
  artist: string | null,
  excludeTrackIds: string[],
): Promise<AutoContinueResult> {
  return invokeWithPreviewFallback(
    "resolve_auto_continue",
    { artist, excludeTrackIds },
    () => ({ trackIds: [], sourceLabel: "auto-continue:library-shuffle" }),
  );
}
