import { useCallback, useState } from "react";

import { seekPlayback, type TrackListItem } from "../desktop";

import {
  selectIsRustOutputPlayback,
  selectPlaybackDurationSeconds,
} from "./playback/playbackSelectors";
import { usePlaybackAutoAdvance } from "./playback/usePlaybackAutoAdvance";
import { usePlaybackMediaRuntime } from "./playback/usePlaybackMediaRuntime";
import type { PlaybackCoordinatorParams } from "./playback/playbackCoordinatorShared";
import { usePlaybackQueueSync } from "./playback/usePlaybackQueueSync";
import { usePlaybackRuntimeBridge } from "./playback/usePlaybackRuntimeBridge";

export function usePlaybackCoordinator({
  shellState,
  tracksState,
  playlistsState,
  conceptAlbumsState,
  trackCatalogRef,
  setShellState,
  setTracksState,
  setPlaylistsState,
}: PlaybackCoordinatorParams) {
  void conceptAlbumsState;
  const [playbackQueueTrackIds, setPlaybackQueueTrackIds] = useState<string[]>([]);
  const [playbackQueueSourceLabel, setPlaybackQueueSourceLabel] = useState<string | null>(null);

  usePlaybackRuntimeBridge({ setShellState });

  const { audioRef, startTrackPlayback } = usePlaybackMediaRuntime({
    shellState,
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
      playbackQueueSourceLabel,
      setPlaybackQueueTrackIds,
      setPlaybackQueueSourceLabel,
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

  const isRustOutputPlayback = selectIsRustOutputPlayback(shellState);
  const playbackDurationSeconds = selectPlaybackDurationSeconds(shellState);

  const handleTrackSelection = useCallback(
    (
      track: TrackListItem,
      options?: {
        queueTrackIds?: string[];
        queueItems?: TrackListItem[];
        sourceLabel?: string;
      },
    ) => {
      setPlaybackQueueSourceLabel(options?.sourceLabel ?? "library-selection");
      void startTrackPlayback(track, true, {
        queueTrackIds: options?.queueTrackIds,
        queueItems: options?.queueItems,
      });
    },
    [startTrackPlayback],
  );

  const handlePlaybackSeek = useCallback(
    (positionSeconds: number) => {
      const clampedSeconds = Math.max(
        0,
        Math.min(
          Math.round(positionSeconds),
          playbackDurationSeconds || Math.round(positionSeconds),
        ),
      );

      if (audioRef.current && !isRustOutputPlayback) {
        audioRef.current.currentTime = clampedSeconds;
      }

      void seekPlayback(clampedSeconds);
    },
    [audioRef, isRustOutputPlayback, playbackDurationSeconds],
  );

  return {
    audioRef,
    queueState,
    handlePlaylistPlaybackHandoff,
    handlePlaybackAction,
    handlePlaybackSeek,
    handleTrackSelection,
  };
}
