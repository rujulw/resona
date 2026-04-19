import { Play } from "lucide-react";

import type { AlbumDetail } from "../../desktop";
import { formatDuration } from "../../utils/format";
import { AdvisoryBadge } from "./AdvisoryBadge";
import { ArtworkTile } from "./ArtworkTile";

export function AlbumDetailPanel({
  albumDetail,
  activeTrackId,
  onPlayAlbum,
  onTrackSelect,
}: {
  albumDetail: AlbumDetail | null;
  activeTrackId: string | null;
  onPlayAlbum: (startTrackId?: string) => void;
  onTrackSelect: (trackId: string) => void;
}) {
  if (!albumDetail) {
    return (
      <section className="grid min-h-[320px] place-items-center rounded-lg border border-white/6 bg-[#1b1b1b] px-5 py-6">
        <div className="grid gap-2 text-center">
          <h2 className="m-0 text-xl font-medium text-[#f2f2f2]">Select an album</h2>
          <p className="m-0 text-sm text-[#8f8f8f]">
            Open a result to load grouped metadata and track order.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid min-h-0 gap-5">
      <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-white/6 bg-[#181818] px-6 py-7">
        <div className="flex min-w-0 items-start gap-5">
          <ArtworkTile
            artworkKey={albumDetail.album.artworkKey}
            title={albumDetail.album.title}
            sizeClassName="h-36 w-36"
            roundedClassName="rounded-sm"
          />
          <div className="min-w-0 pt-1">
            <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">album</p>
            <h2 className="mt-4 text-6xl font-medium tracking-[-0.06em] text-[#f2f2f2]">
              {albumDetail.album.title}
            </h2>
            <p className="mt-4 text-base text-[#d4d4d4]">
              {albumDetail.album.artist ?? "unknown artist"}
            </p>
            <p className="mt-3 text-sm text-[#8f8f8f]">
              {albumDetail.album.trackCount} track
              {albumDetail.album.trackCount === 1 ? "" : "s"} ·{" "}
              {albumDetail.album.totalDurationSeconds
                ? formatDuration(Math.round(albumDetail.album.totalDurationSeconds))
                : "--:--"}
            </p>
          </div>
        </div>
        {albumDetail.tracks.length > 0 ? (
          <button
            type="button"
            aria-label="Play album"
            onClick={() => {
              onPlayAlbum();
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-white/3 text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/5 hover:text-[#f2f2f2]"
          >
            <Play className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </header>

      <section className="grid min-h-[62vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-white/6 bg-[#1b1b1b]">
        <div className="grid grid-cols-[40px_minmax(0,1fr)_112px] gap-4 border-b border-white/6 px-3 py-3 text-[11px] tracking-[0.08em] text-[#8f8f8f]">
          <span>track</span>
          <span>title</span>
          <span>duration</span>
        </div>

        <div className="min-h-0 overflow-y-auto">
          {albumDetail.tracks.map((track, index) => (
            <article
              key={track.id}
              role="button"
              tabIndex={0}
              aria-label={`Select ${track.title}`}
              aria-pressed={activeTrackId === track.id}
              className={[
                "grid grid-cols-[30px_minmax(0,1fr)_112px] items-center gap-4 border-b border-white/5 px-5 py-3.5 text-left last:border-b-0",
                activeTrackId === track.id ? "bg-white/8" : "hover:bg-white/3",
              ].join(" ")}
              onClick={() => {
                onPlayAlbum(track.id);
                onTrackSelect(track.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onPlayAlbum(track.id);
                  onTrackSelect(track.id);
                }
              }}
            >
              <span className="text-sm text-[#8f8f8f]">
                {track.trackNumber ?? index + 1}
              </span>
              <span className="grid min-w-0 gap-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm text-[#f2f2f2]">{track.title}</span>
                  <AdvisoryBadge advisory={track.advisory} />
                </span>
                <span className="truncate text-xs text-[#8f8f8f]">
                  {track.artist ?? albumDetail.album.artist ?? "unknown artist"}
                </span>
              </span>
              <span className="text-sm text-[#8f8f8f]">
                {track.durationSeconds
                  ? formatDuration(Math.round(track.durationSeconds))
                  : "--:--"}
              </span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
