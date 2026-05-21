import { Pause, Play, StepBack, StepForward, Volume1, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

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
  volumeLevel,
  isMuted,
  onVolumeChange,
  onMuteToggle,
}: {
  activeTrack: TrackListItem | null;
  playback: PlaybackShellState;
  onPlaybackAction: (action: "previous" | "toggle" | "next") => void;
  onSeek: (positionSeconds: number) => void;
  volumeLevel: number;
  isMuted: boolean;
  onVolumeChange: (level: number) => void;
  onMuteToggle: () => void;
}) {
  const playbackBar = buildPlaybackBarViewModel({ activeTrack, playback });

  // Local drag state prevents live progress ticks from snapping thumb during drag
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);

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

  const VolumeIcon = isMuted ? VolumeX : volumeLevel > 0.5 ? Volume2 : Volume1;

  const seekDisabled = !playbackBar.hasActiveTrack || playbackBar.durationSeconds <= 0;
  const displayedProgress = isDragging ? dragPosition : playbackBar.progressSeconds;
  const seekMaxSeconds = playbackBar.durationSeconds > 0 ? playbackBar.durationSeconds : 100;
  const seekFillPercent =
    seekMaxSeconds > 0 ? Math.min((displayedProgress / seekMaxSeconds) * 100, 100) : 0;

  const effectiveVolume = isMuted ? 0 : volumeLevel;
  const volumeFillPercent = effectiveVolume * 100;

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
        <div className="flex items-center justify-center gap-1">
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
          <input
            aria-label="Seek playback"
            type="range"
            min={0}
            max={seekMaxSeconds}
            step={0.1}
            value={displayedProgress}
            disabled={seekDisabled}
            style={{
              background: `linear-gradient(to right, rgba(143,143,143,0.9) ${seekFillPercent}%, rgba(255,255,255,0.08) ${seekFillPercent}%)`,
            }}
            className="h-1 w-full cursor-pointer appearance-none rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-45 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:opacity-0 hover:[&::-webkit-slider-thumb]:opacity-100 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:opacity-0 hover:[&::-moz-range-thumb]:opacity-100"
            onPointerDown={() => {
              if (seekDisabled) return;
              setIsDragging(true);
              setDragPosition(playbackBar.progressSeconds);
            }}
            onChange={(e) => {
              if (!isDragging) return;
              setDragPosition(parseFloat(e.target.value));
            }}
            onPointerUp={(e) => {
              if (!isDragging) return;
              const value = parseFloat((e.target as HTMLInputElement).value);
              setIsDragging(false);
              onSeek(value);
            }}
          />
          <div className="flex justify-between text-xs text-[#8f8f8f]">
            <span>{formatDuration(displayedProgress)}</span>
            <span>{formatDuration(playbackBar.durationSeconds)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pr-2">
        <button
          aria-label={isMuted ? "Unmute" : "Mute"}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-[#8f8f8f] transition-colors hover:text-[#f2f2f2]"
          type="button"
          onClick={onMuteToggle}
        >
          <VolumeIcon className="h-4 w-4" strokeWidth={2.2} />
        </button>
        <input
          aria-label="Volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={effectiveVolume}
          style={{
            background: `linear-gradient(to right, rgba(242,242,242,0.65) ${volumeFillPercent}%, rgba(255,255,255,0.08) ${volumeFillPercent}%)`,
          }}
          className="h-[3px] w-20 cursor-pointer appearance-none rounded-full transition-all [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:opacity-0 hover:[&::-webkit-slider-thumb]:opacity-100 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:opacity-0 hover:[&::-moz-range-thumb]:opacity-100"
          onChange={(e) => {
            onVolumeChange(parseFloat(e.target.value));
          }}
        />
      </div>
    </footer>
  );
}
