import { useCallback, useEffect, useRef, useState } from "react";

import {
  getPersistedVolume,
  mutateQueue,
  reorderQueue,
  seekPlayback,
  setPersistedVolume,
  setVolume,
  type TrackListItem,
} from "../desktop";

import {
  selectIsRustOutputPlayback,
  selectPlaybackDurationSeconds,
} from "./playback/playbackSelectors";
import { usePlaybackAutoAdvance } from "./playback/usePlaybackAutoAdvance";
import { usePlaybackMediaRuntime } from "./playback/usePlaybackMediaRuntime";
import type { PlaybackCoordinatorParams } from "./playback/playbackCoordinatorShared";
import { usePlaybackQueueSync } from "./playback/usePlaybackQueueSync";
import { usePlaybackRuntimeBridge } from "./playback/usePlaybackRuntimeBridge";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useMediaSession } from "./useMediaSession";

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
  const [volumeLevel, setVolumeLevel] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const preMuteLevelRef = useRef(1);
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted volume on mount
  useEffect(() => {
    void getPersistedVolume().then((level) => {
      setVolumeLevel(level);
      preMuteLevelRef.current = level;
    });
  }, []);

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

  usePlaybackRuntimeBridge({
    setShellState,
    mediaKeys: {
      onPlayPause: useCallback(() => handlePlaybackAction("toggle"), [handlePlaybackAction]),
      onNextTrack: useCallback(() => handlePlaybackAction("next"), [handlePlaybackAction]),
      onPrevTrack: useCallback(() => handlePlaybackAction("previous"), [handlePlaybackAction]),
    },
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

  const handleQueueMutate = useCallback(
    (trackId: string, mode: "next" | "last") => {
      void mutateQueue(trackId, mode).then((snapshot) => {
        setPlaybackQueueTrackIds(snapshot.trackIds);
      });
    },
    [setPlaybackQueueTrackIds],
  );

  const handleQueueReorder = useCallback(
    (trackIds: string[]) => {
      void reorderQueue(trackIds).then((snapshot) => {
        setPlaybackQueueTrackIds(snapshot.trackIds);
      });
    },
    [setPlaybackQueueTrackIds],
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

  // Apply volume to HTML audio element and rodio when outputOwner changes
  useEffect(() => {
    const effectiveVolume = isMuted ? 0 : volumeLevel;
    if (audioRef.current) {
      audioRef.current.volume = effectiveVolume;
    }
    if (isRustOutputPlayback) {
      void setVolume(effectiveVolume);
    }

    // Debounced persist — only persist the non-muted level
    if (!isMuted) {
      if (persistDebounceRef.current) {
        clearTimeout(persistDebounceRef.current);
      }
      persistDebounceRef.current = setTimeout(() => {
        void setPersistedVolume(volumeLevel);
      }, 300);
    }
  }, [volumeLevel, isMuted, isRustOutputPlayback, audioRef]);

  const handleVolumeChange = useCallback((level: number) => {
    setVolumeLevel(level);
    if (isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted((muted) => {
      if (!muted) {
        preMuteLevelRef.current = volumeLevel;
      } else {
        // Restore pre-mute level
        setVolumeLevel(preMuteLevelRef.current);
      }
      return !muted;
    });
  }, [volumeLevel]);

  useMediaSession({
    track: shellState?.playback.trackId
      ? {
          title: shellState.playback.trackTitle ?? "",
          artist: shellState.playback.trackArtist ?? null,
          album: shellState.playback.trackAlbum ?? null,
          artworkKey: null,
          durationSecs: shellState.playback.durationSeconds ?? null,
          progressSecs: shellState.playback.progressSeconds ?? null,
        }
      : null,
    isPlaying: shellState?.playback.isPlaying ?? false,
    handlers: {
      onPlayPause: useCallback(() => handlePlaybackAction("toggle"), [handlePlaybackAction]),
      onNextTrack: useCallback(() => handlePlaybackAction("next"), [handlePlaybackAction]),
      onPrevTrack: useCallback(() => handlePlaybackAction("previous"), [handlePlaybackAction]),
      onSeekBackward: useCallback(
        (offset?: number) =>
          handlePlaybackSeek((audioRef.current?.currentTime ?? 0) - (offset ?? 10)),
        [audioRef, handlePlaybackSeek],
      ),
      onSeekForward: useCallback(
        (offset?: number) =>
          handlePlaybackSeek((audioRef.current?.currentTime ?? 0) + (offset ?? 10)),
        [audioRef, handlePlaybackSeek],
      ),
    },
  });

  useKeyboardShortcuts({
    onPlayPause: useCallback(
      () => handlePlaybackAction("toggle"),
      [handlePlaybackAction],
    ),
    onPrevTrack: useCallback(() => handlePlaybackAction("previous"), [handlePlaybackAction]),
    onNextTrack: useCallback(() => handlePlaybackAction("next"), [handlePlaybackAction]),
  });

  return {
    audioRef,
    queueState,
    volumeLevel,
    isMuted,
    handleVolumeChange,
    handleMuteToggle,
    handlePlaylistPlaybackHandoff,
    handlePlaybackAction,
    handlePlaybackSeek,
    handleTrackSelection,
    handleQueueMutate,
    handleQueueReorder,
  };
}
