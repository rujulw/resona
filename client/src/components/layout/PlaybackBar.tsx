import { Pause, Play, StepBack, StepForward } from "lucide-react";

import type { PlaybackShellState } from "../../desktop";
import type { TrackListItem } from "../../desktop";
import { formatDuration } from "../../utils/format";
import { ArtworkTile } from "../ui/ArtworkTile";

export function PlaybackBar({
  activeTrack,
  playback,
  onPlaybackAction,
}: {
  activeTrack: TrackListItem | null;
  playback: PlaybackShellState;
  onPlaybackAction: (action: "previous" | "toggle" | "next") => void;
}) {
  const hasActiveTrack = Boolean(playback.trackId);
  const progressValue =
    playback.durationSeconds > 0
      ? Math.min(playback.durationSeconds, playback.progressSeconds)
      : 0;
  const transportButtons = [
    {
      action: "previous" as const,
      ariaLabel: "Previous track",
      icon: StepBack,
    },
    {
      action: "toggle" as const,
      ariaLabel: playback.isPlaying ? "Pause playback" : "Play playback",
      icon: playback.isPlaying ? Pause : Play,
    },
    {
      action: "next" as const,
      ariaLabel: "Next track",
      icon: StepForward,
    },
  ];

  return (
    <footer className="col-span-full grid min-h-[108px] grid-cols-[minmax(260px,1fr)_minmax(420px,640px)_minmax(260px,1fr)] items-center gap-4 border-t border-white/6 bg-[#0e0e0e] px-4">
      <div className="flex min-w-0 items-center gap-3 py-4">
        <ArtworkTile
          artworkKey={activeTrack?.artworkKey}
          title={activeTrack?.title ?? playback.trackTitle ?? "Nothing playing"}
          sizeClassName="h-14 w-14"
          roundedClassName="rounded-sm"
        />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <strong className="truncate text-sm font-medium text-[#f2f2f2]">
            {activeTrack?.title ?? playback.trackTitle ?? "Nothing playing"}
          </strong>
          <span className="truncate text-sm text-[#8f8f8f]">
            {activeTrack?.artist ?? playback.trackArtist ?? ""}
          </span>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4">
        <div className="flex justify-center gap-2">
          {transportButtons.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.action}
                className="h-10 min-w-10 rounded-full border border-white/8 bg-white/[0.03] text-sm text-[#d4d4d4] transition-colors hover:border-white/12 hover:text-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={item.ariaLabel}
                type="button"
                disabled={!hasActiveTrack && item.action !== "toggle"}
                onClick={() => {
                  onPlaybackAction(item.action);
                }}
              >
                <Icon className="mx-auto h-4 w-4" strokeWidth={2.2} />
              </button>
            );
          })}
        </div>

        <div className="grid gap-2">
          <progress
            className="block h-1 w-full appearance-none overflow-hidden rounded-full bg-white/8 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[#8f8f8f] [&::-webkit-progress-bar]:bg-white/8 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[#8f8f8f]"
            max={Math.max(playback.durationSeconds, 1)}
            value={progressValue}
          />
          <div className="flex justify-between text-xs text-[#8f8f8f]">
            <span>{formatDuration(playback.progressSeconds)}</span>
            <span>{formatDuration(playback.durationSeconds)}</span>
          </div>
        </div>
      </div>

      <div aria-hidden="true" />
    </footer>
  );
}
