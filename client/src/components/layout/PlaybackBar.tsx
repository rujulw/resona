import { Pause, Play, StepBack, StepForward } from "lucide-react";
import type { MouseEvent } from "react";

import type { PlaybackShellState } from "../../desktop";
import type { TrackListItem } from "../../desktop";
import { buildPlaybackBarViewModel } from "../../hooks/appShellViewModels";
import { formatDuration } from "../../utils/format";
import { AdvisoryBadge } from "../ui/AdvisoryBadge";
import { ArtworkTile } from "../ui/ArtworkTile";

export function PlaybackBar({
  activeTrack,
  playback,
  onPlaybackAction,
  onSeek,
}: {
  activeTrack: TrackListItem | null;
  playback: PlaybackShellState;
  onPlaybackAction: (action: "previous" | "toggle" | "next") => void;
  onSeek: (positionSeconds: number) => void;
}) {
  const playbackBar = buildPlaybackBarViewModel({ activeTrack, playback });
  const transportButtons = [
    {
      action: "previous" as const,
      ariaLabel: "Previous track",
      icon: StepBack,
    },
    {
      action: "toggle" as const,
      ariaLabel: playbackBar.isPlaying ? "Pause playback" : "Play playback",
      icon: playbackBar.isPlaying ? Pause : Play,
    },
    {
      action: "next" as const,
      ariaLabel: "Next track",
      icon: StepForward,
    },
  ];

  const handleSeekClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!playbackBar.hasActiveTrack || playbackBar.durationSeconds <= 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
    const nextPosition = (relativeX / bounds.width) * playbackBar.durationSeconds;
    onSeek(nextPosition);
  };

  return (
    <footer className="col-span-full grid min-h-27 grid-cols-[minmax(260px,1fr)_minmax(420px,640px)_minmax(260px,1fr)] items-center gap-4 border-t border-white/6 bg-[#0e0e0e] px-4">
      <div className="flex min-w-0 items-center gap-3 py-4">
        <ArtworkTile
          artworkKey={activeTrack?.artworkKey}
          title={playbackBar.title}
          sizeClassName="h-14 w-14"
          roundedClassName="rounded-sm"
        />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <strong className="truncate text-sm font-medium text-[#f2f2f2]">
              {playbackBar.title}
            </strong>
            <AdvisoryBadge advisory={playbackBar.advisory} />
          </div>
          <span className="truncate text-sm text-[#8f8f8f]">
            {playbackBar.artist}
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
                className="h-10 min-w-10 rounded-full border border-white/8 bg-white/3 text-sm text-[#d4d4d4] transition-colors hover:border-white/12 hover:text-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={item.ariaLabel}
                type="button"
                disabled={!playbackBar.hasActiveTrack && item.action !== "toggle"}
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
          <button
            aria-label="Seek playback"
            className="block h-1 w-full overflow-hidden rounded-full bg-white/8 text-left disabled:cursor-not-allowed disabled:opacity-45"
            type="button"
            disabled={!playbackBar.hasActiveTrack || playbackBar.durationSeconds <= 0}
            onClick={handleSeekClick}
          >
            <span
              aria-hidden="true"
              className="block h-full rounded-full bg-[#8f8f8f]"
              style={{ width: `${playbackBar.progressPercent}%` }}
            />
          </button>
          <div className="flex justify-between text-xs text-[#8f8f8f]">
            <span>{formatDuration(playbackBar.progressSeconds)}</span>
            <span>{formatDuration(playbackBar.durationSeconds)}</span>
          </div>
        </div>
      </div>

      <div aria-hidden="true" />
    </footer>
  );
}
