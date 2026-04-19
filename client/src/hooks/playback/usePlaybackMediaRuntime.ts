import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import {
  loadPlaybackTrack,
  playbackAction,
  reportPlaybackError,
  type TrackListItem,
} from "../../desktop";
import type { ShellState, TracksState } from "../../types/app";

export function usePlaybackMediaRuntime({
  shellState,
  tracksState,
  trackCatalogRef,
  setTracksState,
  setPlaybackQueueTrackIds,
}: {
  shellState: ShellState | null;
  tracksState: TracksState;
  trackCatalogRef: MutableRefObject<Map<string, TrackListItem>>;
  setTracksState: Dispatch<SetStateAction<TracksState>>;
  setPlaybackQueueTrackIds: Dispatch<SetStateAction<string[]>>;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackRequestIdRef = useRef(0);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    return () => {
      try {
        audio.pause();
      } catch {
        // jsdom does not implement media teardown fully, but the browser/webview does.
      }
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !shellState?.playback.trackId) {
      return;
    }

    if (shellState.playback.outputOwner === "rust") {
      if (!audio.paused) {
        audio.pause();
      }
      return;
    }

    if (!audio.src) {
      return;
    }

    if (shellState.playback.isPlaying) {
      if (!audio.paused) {
        return;
      }

      void audio.play().catch(() => {
        void playbackAction("toggle");
      });
      return;
    }

    if (!audio.paused) {
      audio.pause();
    }
  }, [
    shellState?.playback.isPlaying,
    shellState?.playback.outputOwner,
    shellState?.playback.trackId,
  ]);

  const startTrackPlayback = useCallback(
    async (
      track: TrackListItem,
      autoplay: boolean,
      options?: {
        queueTrackIds?: string[];
        queueItems?: TrackListItem[];
      },
    ) => {
      const requestId = playbackRequestIdRef.current + 1;
      playbackRequestIdRef.current = requestId;
      if (options?.queueItems) {
        for (const queueItem of options.queueItems) {
          trackCatalogRef.current.set(queueItem.id, queueItem);
        }
      }
      setPlaybackQueueTrackIds((existing) => {
        if (options?.queueTrackIds) {
          return options.queueTrackIds;
        }

        const visibleTrackIds = tracksState.items.map((item) => item.id);
        if (visibleTrackIds.includes(track.id)) {
          return visibleTrackIds;
        }

        if (existing.includes(track.id)) {
          return existing;
        }

        return [track.id];
      });
      trackCatalogRef.current.set(track.id, track);

      setTracksState((existing) => ({
        ...existing,
        selectedTrackId: track.id,
      }));
      const payload = await loadPlaybackTrack(track.id);
      if (playbackRequestIdRef.current !== requestId) {
        return;
      }

      if (!payload) {
        void reportPlaybackError("Local source unavailable");
        return;
      }

      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      audio.pause();
      if (payload.playback.outputOwner === "rust") {
        audio.src = "";
      } else {
        audio.src = payload.source.assetUrl;
      }
      audio.currentTime = 0;

      if (!autoplay) {
        return;
      }

      void playbackAction("toggle");
    },
    [setPlaybackQueueTrackIds, setTracksState, trackCatalogRef, tracksState.items],
  );

  return {
    audioRef,
    startTrackPlayback,
  };
}
