import type { PlaybackShellState, TrackListItem } from "../desktop";
import { deriveQueueState } from "./appShellShared";

export function buildPlaybackQueueViewModel({
  trackCatalog,
  playbackQueueTrackIds,
  activeTrackId,
  sourceLabel,
}: {
  trackCatalog: Map<string, TrackListItem>;
  playbackQueueTrackIds: string[];
  activeTrackId: string | null;
  sourceLabel?: string | null;
}) {
  return deriveQueueState(
    trackCatalog,
    playbackQueueTrackIds,
    activeTrackId,
    sourceLabel ?? undefined,
  );
}

export function buildPlaybackBarViewModel({
  activeTrack,
  playback,
}: {
  activeTrack: TrackListItem | null;
  playback: PlaybackShellState;
}) {
  const hasActiveTrack = Boolean(playback.trackId);
  const progressValue =
    playback.durationSeconds > 0
      ? Math.min(playback.durationSeconds, playback.progressSeconds)
      : 0;
  const progressPercent =
    playback.durationSeconds > 0 ? (progressValue / playback.durationSeconds) * 100 : 0;

  return {
    hasActiveTrack,
    progressValue,
    progressPercent,
    title: activeTrack?.title ?? playback.trackTitle ?? "Nothing playing",
    advisory: activeTrack?.advisory ?? playback.trackAdvisory,
    artist: activeTrack?.artist ?? playback.trackArtist ?? "",
    isPlaying: playback.isPlaying,
    durationSeconds: playback.durationSeconds,
    progressSeconds: playback.progressSeconds,
  };
}