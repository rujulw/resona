import type { TracksState } from "../types/app";
import { formatDuration } from "../utils/format";

export function TracksPage({
  tracksState,
}: {
  tracksState: TracksState;
}) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-6 overflow-hidden px-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">tracks</p>
          <h2 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
            library table
          </h2>
        </div>
        <p className="m-0 text-sm text-[#8f8f8f]">{tracksState.total} total</p>
      </header>

      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-white/6 bg-[#1b1b1b]">
        <div className="grid grid-cols-[minmax(280px,2fr)_minmax(180px,1.1fr)_96px] gap-4 border-b border-white/6 px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-[#8f8f8f]">
          <span>title</span>
          <span>album</span>
          <span>duration</span>
        </div>

        <div className="min-h-0 overflow-y-auto">
          {tracksState.status === "loading" ? (
            <div className="px-5 py-8 text-sm text-[#8f8f8f]">Loading tracks...</div>
          ) : null}

          {tracksState.status === "error" ? (
            <div className="px-5 py-8 text-sm text-[#8f8f8f]">{tracksState.message}</div>
          ) : null}

          {tracksState.status !== "loading" && tracksState.items.length === 0 ? (
            <div className="px-5 py-8 text-sm text-[#8f8f8f]">
              No tracks indexed yet. Add a library path in settings and scan a folder.
            </div>
          ) : null}

          {tracksState.items.map((track) => (
            <div
              key={track.id}
              className="grid grid-cols-[minmax(280px,2fr)_minmax(180px,1.1fr)_96px] items-center gap-4 border-b border-white/5 px-5 py-3.5 last:border-b-0 hover:bg-white/3"
            >
              <div className="grid min-w-0 gap-1">
                <span className="truncate text-sm text-[#f2f2f2]">{track.title}</span>
                <span className="truncate text-xs text-[#8f8f8f]">
                  {track.artist ?? "unknown artist"}
                </span>
              </div>
              <span className="truncate text-sm text-[#d4d4d4]">
                {track.album ?? "unknown album"}
              </span>
              <span className="text-sm text-[#8f8f8f]">
                {track.durationSeconds
                  ? formatDuration(Math.round(track.durationSeconds))
                  : "--:--"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
