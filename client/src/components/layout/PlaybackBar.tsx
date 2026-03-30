import type { PlaybackShellState } from "../../desktop";
import { formatDuration } from "../../utils/format";

export function PlaybackBar({
  playback,
  onPlaybackAction,
}: {
  playback: PlaybackShellState;
  onPlaybackAction: (action: "previous" | "toggle" | "next") => void;
}) {
  const hasActiveTrack = Boolean(playback.trackId);
  const progressValue =
    playback.durationSeconds > 0
      ? Math.min(playback.durationSeconds, playback.progressSeconds)
      : 0;

  return (
    <footer className="col-span-full grid min-h-[104px] grid-cols-[248px_minmax(0,1fr)_220px] items-center gap-4 border-t border-white/6 bg-[#0e0e0e] pr-4">
      <div className="flex min-w-0 items-center gap-3 self-stretch border-r border-white/6 py-4 pl-4">
        <div className="h-12 w-12 rounded-xl border border-white/8 bg-gradient-to-br from-white/12 to-transparent" />
        <div className="grid min-w-0 gap-0.5">
          <strong className="truncate text-sm font-medium text-[#f2f2f2]">
            {playback.trackTitle ?? "Nothing playing"}
          </strong>
          <span className="truncate text-sm text-[#8f8f8f]">
            {playback.trackArtist ?? "Playback shell ready"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4">
        <div className="flex justify-center gap-2">
          {[
            { action: "previous" as const, label: "<", ariaLabel: "Previous track" },
            {
              action: "toggle" as const,
              label: playback.isPlaying ? "||" : ">",
              ariaLabel: playback.isPlaying ? "Pause playback" : "Play or pause playback",
            },
            { action: "next" as const, label: ">>", ariaLabel: "Next track" },
          ].map((item) => (
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
              {item.label}
            </button>
          ))}
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

      <div className="grid justify-items-end gap-1 pr-1">
        <span className="text-xs text-[#8f8f8f]">output</span>
        <span className="text-sm text-[#d4d4d4]">{playback.transportLabel}</span>
      </div>
    </footer>
  );
}
