import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

import type { TrackListItem } from "../../desktop";
import type { ShellState, TracksState } from "../../types/app";

export function usePlaybackAutoAdvance({
  shellState,
  tracksState,
  trackCatalogRef,
  playbackQueueTrackIds,
  startTrackPlayback,
}: {
  shellState: ShellState | null;
  tracksState: TracksState;
  trackCatalogRef: MutableRefObject<Map<string, TrackListItem>>;
  playbackQueueTrackIds: string[];
  startTrackPlayback: (track: TrackListItem, autoplay: boolean) => Promise<void>;
}) {
  const playbackQueueTrackIdsRef = useRef<string[]>([]);
  const completionHandledRef = useRef<string | null>(null);

  useEffect(() => {
    playbackQueueTrackIdsRef.current = playbackQueueTrackIds;
  }, [playbackQueueTrackIds]);

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
    startTrackPlayback,
    trackCatalogRef,
    tracksState.selectedTrackId,
  ]);
}
