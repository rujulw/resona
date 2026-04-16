import { useMemo } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import {
  handoffPlaylistToQueue,
  playbackAction,
  seekPlayback,
  type TrackListItem,
} from "../../desktop";
import {
  selectActivePlaybackTrackId,
  selectCurrentPlaybackProgressSeconds,
  selectIsRustOutputPlayback,
} from "./playbackSelectors";
import type { PlaylistsState, ShellState, TracksState } from "../../types/app";
import { buildPlaybackQueueViewModel } from "../appShellViewModels";
import type { PlaybackAction } from "./playbackCoordinatorShared";

export function usePlaybackQueueSync({
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
}: {
  shellState: ShellState | null;
  tracksState: TracksState;
  playlistsState: PlaylistsState;
  trackCatalogRef: MutableRefObject<Map<string, TrackListItem>>;
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  playbackQueueTrackIds: string[];
  setPlaybackQueueTrackIds: Dispatch<SetStateAction<string[]>>;
  setShellState: Dispatch<SetStateAction<ShellState | null>>;
  setTracksState: Dispatch<SetStateAction<TracksState>>;
  setPlaylistsState: Dispatch<SetStateAction<PlaylistsState>>;
  startTrackPlayback: (track: TrackListItem, autoplay: boolean) => Promise<void>;
}) {

  const isRustOutputPlayback = selectIsRustOutputPlayback(shellState);

  const queueState = useMemo(
    () =>
      buildPlaybackQueueViewModel({
        trackCatalog: trackCatalogRef.current,
        playbackQueueTrackIds,
        activeTrackId: selectActivePlaybackTrackId(shellState, tracksState),
        sourceLabel: playlistsState.playbackQueue?.sourceLabel,
      }),
    [
      playbackQueueTrackIds,
      playlistsState.playbackQueue?.sourceLabel,
      shellState?.playback.trackId,
      trackCatalogRef,
      tracksState.selectedTrackId,
    ],
  );

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

  const handlePlaybackAction = (action: PlaybackAction) => {
    const audio = audioRef.current;
    const activeTrackId = selectActivePlaybackTrackId(shellState, tracksState);

    if (action === "previous" || action === "next") {
      const activeIndex = activeTrackId
        ? playbackQueueTrackIds.findIndex((trackId) => trackId === activeTrackId)
        : -1;

      const currentProgressSeconds = selectCurrentPlaybackProgressSeconds(
        shellState,
        audio?.currentTime ?? 0,
      );

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
      if (activeTrackId && (isRustOutputPlayback || (audio && audio.src))) {
        void playbackAction("toggle");
        return;
      }

      if (!activeTrackId && tracksState.items.length > 0) {
        void startTrackPlayback(tracksState.items[0], true);
        return;
      }
    }

    void playbackAction(action);
  };

  return {
    playbackQueueTrackIds,
    setPlaybackQueueTrackIds,
    queueState,
    handlePlaylistPlaybackHandoff,
    handlePlaybackAction,
  };
}