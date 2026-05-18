import { useEffect, useState } from "react";
import type { RefObject } from "react";

import { resolveArtworkSource } from "../desktop";
import type { TrackListItem } from "../desktop";
import type { QueueState } from "../types/app";
import { AdvisoryBadge } from "../components/ui/AdvisoryBadge";
import { VinylDisc } from "../components/ui/VinylDisc";

export function PlayerPage({
  queueState,
  isPlaying,
}: {
  queueState: QueueState;
  isPlaying: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const { activeTrack, upcomingTracks } = queueState;
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeTrack?.artworkKey) {
      setArtworkUrl(null);
      return () => { cancelled = true; };
    }
    void resolveArtworkSource(activeTrack.artworkKey).then((source) => {
      if (!cancelled) setArtworkUrl(source?.assetUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [activeTrack?.artworkKey]);

  if (!activeTrack) {
    return (
      <div className="grid h-full min-h-0 place-items-center bg-black px-6 py-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid max-w-md gap-2 text-center">
          <h2 className="m-0 text-xl font-medium text-[#f2f2f2]">queue is waiting</h2>
          <p className="m-0 text-sm text-[#8f8f8f]">
            Select a track from the library to derive the active queue and next-up flow.
          </p>
        </div>
      </div>
    );
  }

  const upcoming = upcomingTracks ?? [];

  return (
    <div className="flex h-full min-h-0 items-center bg-black p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <section className="relative ml-[4%] flex h-full w-full max-w-[99vh] shrink-0 items-center justify-center overflow-hidden rounded-[clamp(2rem,4vw,3rem)] border border-white/5 bg-[#2c2c2c] shadow-[0_0_100px_rgba(0,0,0,0.5)]">
        <div className="absolute left-[clamp(1rem,2.2vw,2.5rem)] top-[clamp(1rem,2.2vw,2.5rem)] text-[10px] font-black uppercase tracking-[0.5em] text-white/10">
          direct drive system / quartz lock
        </div>
        <div className="absolute bottom-[clamp(1rem,2.2vw,2.5rem)] right-[clamp(1rem,2.2vw,2.5rem)] z-50 text-[10px] font-bold uppercase tracking-[0.4em] text-white/15">
          timbre. audio / mk-7
        </div>
        <VinylDisc
          key={activeTrack.artworkKey ?? "no-art"}
          artworkUrl={artworkUrl}
          title={activeTrack.title}
          isPlaying={isPlaying}
        />
      </section>

      <aside className="flex min-w-0 flex-1 flex-col self-stretch overflow-hidden px-8 py-8">
        {upcoming.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <p className="shrink-0 text-[11px] tracking-[0.08em] text-[#4a4a4a]">up next</p>
            <div className="min-h-0 flex-1 overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {upcoming.map((track: TrackListItem, i) => {
                const opacity = Math.max(0.22, 1 - i * 0.14);
                return (
                  <div
                    key={track.id}
                    className="flex items-center gap-4 py-2.5"
                    style={{ opacity }}
                  >
                    <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-[#3a3a3a]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-xs font-medium text-[#8f8f8f]">
                        {track.title}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <AdvisoryBadge advisory={track.advisory} />
                        <span className="truncate text-[11px] text-[#5a5a5a]">{track.artist}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
