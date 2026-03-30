import type { QueueState } from "../types/app";
import { ArtworkTile } from "../components/ui/ArtworkTile";
import { formatDuration } from "../utils/format";
export function QueuePage({
  queueState,
}: {
  queueState: QueueState;
}) {
  return (
    <div className="grid gap-6 px-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">queue</p>
          <h2 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
            playback queue
          </h2>
        </div>
        <p className="m-0 text-sm text-[#8f8f8f]">{queueState.totalTracks} in flow</p>
      </header>

      {queueState.activeTrack ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-3xl border border-white/6 bg-[#1b1b1b] p-5">
            <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">now playing</p>
            <div className="mt-4 grid justify-items-center gap-4 text-center">
              <ArtworkTile
                artworkKey={queueState.activeTrack.artworkKey}
                title={queueState.activeTrack.title}
                sizeClassName="aspect-square w-full max-w-[320px]"
                roundedClassName="rounded-none"
              />
              <div className="grid gap-1">
                <h3 className="m-0 text-2xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
                  {queueState.activeTrack.title}
                </h3>
                <p className="m-0 text-sm text-[#8f8f8f]">
                  {queueState.activeTrack.artist ?? "unknown artist"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/6 bg-[#1b1b1b] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">next up</p>
                <h3 className="mt-2 text-lg font-medium text-[#f2f2f2]">
                  derived from the current local selection
                </h3>
              </div>
              <p className="m-0 text-sm text-[#8f8f8f]">
                {queueState.upcomingTracks.length} waiting
              </p>
            </div>

            {queueState.upcomingTracks.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {queueState.upcomingTracks.map((track, index) => (
                  <div
                    key={track.id}
                    className="grid grid-cols-[48px_minmax(0,1fr)_80px] items-center gap-4 rounded-2xl border border-white/6 bg-white/3 px-4 py-3"
                  >
                    <span className="text-sm text-[#8f8f8f]">
                      {(index + 1).toString().padStart(2, "0")}
                    </span>
                    <div className="grid min-w-0 gap-1">
                      <span className="truncate text-sm text-[#f2f2f2]">{track.title}</span>
                      <span className="truncate text-xs text-[#8f8f8f]">
                        {track.artist ?? "unknown artist"}
                      </span>
                    </div>
                    <span className="text-right text-sm text-[#8f8f8f]">
                      {track.durationSeconds
                        ? formatDuration(Math.round(track.durationSeconds))
                        : "--:--"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/6 bg-white/3 px-4 py-6">
                <p className="m-0 text-sm text-[#8f8f8f]">
                  No additional indexed tracks are queued after the current selection.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="grid place-items-center rounded-3xl border border-white/6 bg-[#1b1b1b] px-6 py-16">
          <div className="grid max-w-md gap-2 text-center">
            <h2 className="m-0 text-xl font-medium text-[#f2f2f2]">queue is waiting</h2>
            <p className="m-0 text-sm text-[#8f8f8f]">
              Select a track from the library to derive the active queue and next-up flow.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
