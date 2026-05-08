import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

import type { TrackListItem } from "../../desktop";
import { recordPlayEvent, resolveAutoContinue } from "../../desktop/playback";
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
      // Record the completion event before advancing, best-effort.
      if (activeTrackId) {
        void recordPlayEvent(activeTrackId);
      }
      void startTrackPlayback(nextTrack, true);
      return;
    }

    // Queue exhausted — resolve auto-continue based on the finishing track's artist.
    const finishedArtist = playback.trackArtist ?? null;
    const excludeIds = activeTrackId
      ? [activeTrackId, ...playbackQueueTrackIdsRef.current]
      : [...playbackQueueTrackIdsRef.current];

    void (async () => {
      if (activeTrackId) {
        await recordPlayEvent(activeTrackId).catch(() => undefined);
      }

      const result = await resolveAutoContinue(
        finishedArtist,
        [...new Set(excludeIds)],
      ).catch(() => ({ trackIds: [], sourceLabel: "" }));

      const firstId = result.trackIds[0];
      if (!firstId) {
        return;
      }

      const firstTrack = trackCatalogRef.current.get(firstId);
      if (firstTrack) {
        void startTrackPlayback(firstTrack, true, {
          queueTrackIds: result.trackIds,
        });
      }
    })();
  }, [
    shellState?.playback.outputOwner,
    shellState?.playback.progressSeconds,
    shellState?.playback.statusLabel,
    shellState?.playback.trackId,
    shellState?.playback.trackArtist,
    startTrackPlayback,
    trackCatalogRef,
    tracksState.selectedTrackId,
  ]);
}
