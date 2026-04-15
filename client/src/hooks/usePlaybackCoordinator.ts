import { useCallback, useState } from "react";

import { seekPlayback, type TrackListItem } from "../desktop";
import { usePlaybackAutoAdvance } from "./playback/usePlaybackAutoAdvance";
import { usePlaybackMediaRuntime } from "./playback/usePlaybackMediaRuntime";
import type { PlaybackCoordinatorParams } from "./playback/playbackCoordinatorShared";
import { usePlaybackQueueSync } from "./playback/usePlaybackQueueSync";
import { usePlaybackRuntimeBridge } from "./playback/usePlaybackRuntimeBridge";

export function usePlaybackCoordinator({
  shellState,
  tracksState,
  playlistsState,
  trackCatalogRef,
  setShellState,
  setTracksState,
  setPlaylistsState,
}: PlaybackCoordinatorParams) {
  const [playbackQueueTrackIds, setPlaybackQueueTrackIds] = useState<string[]>([]);

  usePlaybackRuntimeBridge({ setShellState });

  const { audioRef, startTrackPlayback } = usePlaybackMediaRuntime({
    shellState,
    tracksState,
    trackCatalogRef,
    setTracksState,
    setPlaybackQueueTrackIds,
  });

  const { queueState, handlePlaylistPlaybackHandoff, handlePlaybackAction } =
    usePlaybackQueueSync({
      shellState,
      tracksState,
      playlistsState,
      trackCatalogRef,
      audioRef,
      playbackQueueTrackIds,
      setPlaybackQueueTrackIds,
      setShellState,
      setTracksState,
      setPlaylistsState,
      startTrackPlayback,
    });

  usePlaybackAutoAdvance({
    shellState,
    tracksState,
    trackCatalogRef,
    playbackQueueTrackIds,
    startTrackPlayback,
  });

  const isRustOutputPlayback = shellState?.playback.outputOwner === "rust";

  const handleTrackSelection = useCallback(
    (track: TrackListItem) => {
      void startTrackPlayback(track, true);
    },
    [startTrackPlayback],
  );

  const handlePlaybackSeek = useCallback(
    (positionSeconds: number) => {
      const clampedSeconds = Math.max(
        0,
        Math.min(
          Math.round(positionSeconds),
          shellState?.playback.durationSeconds ?? Math.round(positionSeconds),
        ),
      );

      if (audioRef.current && !isRustOutputPlayback) {
        audioRef.current.currentTime = clampedSeconds;
      }

      void seekPlayback(clampedSeconds);
    },
    [audioRef, isRustOutputPlayback, shellState?.playback.durationSeconds],
  );

  return {
    queueState,
    handlePlaylistPlaybackHandoff,
    handlePlaybackAction,
    handlePlaybackSeek,
    handleTrackSelection,
  };
}
