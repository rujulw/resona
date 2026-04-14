import { useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import {
  handoffPlaylistToQueue,
  loadPlaybackTrack,
  playbackAction,
  reportPlaybackError,
  seekPlayback,
  subscribePlaybackState,
  type TrackListItem,
} from "../desktop";
import type { PlaylistsState, ShellState, TracksState } from "../types/app";
import { deriveQueueState } from "./appShellShared";

export function usePlaybackCoordinator({
  shellState,
  tracksState,
  playlistsState,
  trackCatalogRef,
  setShellState,
  setTracksState,
  setPlaylistsState,
}: {
  shellState: ShellState | null;
  tracksState: TracksState;
  playlistsState: PlaylistsState;
  trackCatalogRef: MutableRefObject<Map<string, TrackListItem>>;
  setShellState: Dispatch<SetStateAction<ShellState | null>>;
  setTracksState: Dispatch<SetStateAction<TracksState>>;
  setPlaylistsState: Dispatch<SetStateAction<PlaylistsState>>;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackRequestIdRef = useRef(0);
  const playbackQueueTrackIdsRef = useRef<string[]>([]);
  const completionHandledRef = useRef<string | null>(null);
  const [playbackQueueTrackIds, setPlaybackQueueTrackIds] = useState<string[]>([]);

  const isRustOutputPlayback = shellState?.playback.outputOwner === "rust";

  useEffect(() => {
    playbackQueueTrackIdsRef.current = playbackQueueTrackIds;
  }, [playbackQueueTrackIds]);

  useEffect(() => {
    let detached = false;
    let unlisten: (() => void) | undefined;

    void subscribePlaybackState((playback) => {
      if (detached) {
        return;
      }

      setShellState((existing) => {
        if (!existing) {
          return existing;
        }

        return {
          ...existing,
          playback: {
            ...existing.playback,
            ...playback,
            isPlaying: playback.isPlaying ?? existing.playback.isPlaying ?? false,
            trackId: playback.trackId ?? existing.playback.trackId ?? null,
            trackTitle: playback.trackTitle ?? existing.playback.trackTitle ?? null,
            trackArtist: playback.trackArtist ?? existing.playback.trackArtist ?? null,
            trackAlbum: playback.trackAlbum ?? existing.playback.trackAlbum ?? null,
            trackAdvisory:
              playback.trackAdvisory ?? existing.playback.trackAdvisory ?? null,
          },
        };
      });
    }).then((dispose) => {
      if (detached) {
        dispose();
        return;
      }

      unlisten = dispose;
    });

    return () => {
      detached = true;
      unlisten?.();
    };
  }, [setShellState]);

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

  useEffect(() => {
    const playback = shellState?.playback;
    if (!playback || playback.outputOwner !== "rust" || playback.statusLabel !== "Ended") {
      completionHandledRef.current = null;
      return;
    }

    const completionKey = `${playback.trackId ?? "none"}:${playback.progressSeconds}`;
    if (completionHandledRef.current === completionKey) {
      return;
    }
    completionHandledRef.current = completionKey;

    const activeTrackId = playback.trackId ?? tracksState.selectedTrackId;
    const activeIndex = activeTrackId
      ? playbackQueueTrackIdsRef.current.findIndex((trackId) => trackId === activeTrackId)
      : -1;
    const nextTrackId =
      activeIndex >= 0 ? playbackQueueTrackIdsRef.current[activeIndex + 1] : undefined;
    const nextTrack = nextTrackId
      ? trackCatalogRef.current.get(nextTrackId)
      : undefined;

    if (nextTrack) {
      void startTrackPlayback(nextTrack, true);
    }
  }, [
    shellState?.playback.outputOwner,
    shellState?.playback.progressSeconds,
    shellState?.playback.statusLabel,
    shellState?.playback.trackId,
    trackCatalogRef,
    tracksState.selectedTrackId,
  ]);

  const startTrackPlayback = async (track: TrackListItem, autoplay: boolean) => {
    const requestId = playbackRequestIdRef.current + 1;
    playbackRequestIdRef.current = requestId;
    setPlaybackQueueTrackIds((existing) => {
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
  };

  const handlePlaylistPlaybackHandoff = (playlistId: string, startEntryId?: string) => {
    void handoffPlaylistToQueue(playlistId, startEntryId ?? null)
      .then((payload) => {
        setPlaybackQueueTrackIds(payload.queue.trackIds);
        setShellState((existing) =>
          existing
            ? {
                ...existing,
                playback: payload.playback,
              }
            : existing,
        );
        setTracksState((existing) => ({
          ...existing,
          selectedTrackId: payload.playback.trackId ?? existing.selectedTrackId,
        }));
        setPlaylistsState((existing) => ({
          ...existing,
          playbackQueue: payload.queue,
        }));
        void playbackAction("toggle");
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to hand off playlist to playback.",
        }));
      });
  };

  const handlePlaybackAction = (action: "previous" | "toggle" | "next") => {
    const audio = audioRef.current;

    if (action === "previous" || action === "next") {
      const activeTrackId = shellState?.playback.trackId ?? tracksState.selectedTrackId;
      const activeIndex = activeTrackId
        ? playbackQueueTrackIds.findIndex((trackId) => trackId === activeTrackId)
        : -1;

      const currentProgressSeconds = isRustOutputPlayback
        ? shellState?.playback.progressSeconds ?? 0
        : audio?.currentTime ?? 0;

      if (action === "previous" && currentProgressSeconds > 3 && activeTrackId) {
        if (audio) {
          audio.currentTime = 0;
        }
        void seekPlayback(0);
        return;
      }

      const targetIndex =
        activeIndex >= 0
          ? action === "previous"
            ? activeIndex - 1
            : activeIndex + 1
          : action === "next"
            ? 0
            : -1;
      const targetTrackId =
        targetIndex >= 0 ? playbackQueueTrackIds[targetIndex] : undefined;
      const targetTrack = targetTrackId
        ? trackCatalogRef.current.get(targetTrackId)
        : undefined;

      if (targetTrack) {
        void startTrackPlayback(targetTrack, true);
        return;
      }
    }

    if (action === "toggle") {
      if (shellState?.playback.trackId && (isRustOutputPlayback || (audio && audio.src))) {
        void playbackAction("toggle");
        return;
      }

      if (!shellState?.playback.trackId && tracksState.items.length > 0) {
        void startTrackPlayback(tracksState.items[0], true);
        return;
      }
    }

    void playbackAction(action);
  };

  const handleTrackSelection = (track: TrackListItem) => {
    void startTrackPlayback(track, true);
  };

  const handlePlaybackSeek = (positionSeconds: number) => {
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
  };

  const queueState = deriveQueueState(
    trackCatalogRef.current,
    playbackQueueTrackIds,
    shellState?.playback.trackId ?? tracksState.selectedTrackId,
    playlistsState.playbackQueue?.sourceLabel,
  );

  return {
    queueState,
    handlePlaylistPlaybackHandoff,
    handlePlaybackAction,
    handlePlaybackSeek,
    handleTrackSelection,
  };
}
