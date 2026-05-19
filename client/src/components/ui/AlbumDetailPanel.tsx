import { Play } from "lucide-react";
import type { AlbumDetail } from "../../desktop";
import { useTrackContextMenu } from "../../contexts/QueueActionsContext";
import { ArtistLinks } from "./ArtistLinks";
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
  const { handleContextMenu, contextMenuEl } = useTrackContextMenu();

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
    <>
    {contextMenuEl}
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-black">
      <header className="flex flex-wrap items-end justify-between gap-6 px-8 pb-4 pt-10 bg-gradient-to-b from-white/[0.07] to-transparent">
        <div className="flex min-w-0 items-end gap-6">
          <ArtworkTile
            artworkKey={albumDetail.album.artworkKey}
            title={albumDetail.album.title}
            sizeClassName="h-52 w-52 shadow-2xl shadow-black/40"
            roundedClassName="rounded-md"
            fallbackClassName="bg-white/[0.04]"
          />
          <div className="min-w-0 pb-1">
            <p className="m-0 text-[11px] tracking-[0.08em] text-[#f2f2f2]/80">album</p>
            <h2 className="mt-2 text-7xl font-bold tracking-[-0.04em] text-white text-wrap break-words">
              {albumDetail.album.title}
            </h2>
            <p className="mt-4 flex flex-wrap gap-x-1 text-base">
              <ArtistLinks
                artist={albumDetail.album.artist}
                linkClassName="text-[#d4d4d4] transition-colors hover:text-white"
                unknownClassName="text-[#d4d4d4]"
                separatorClassName="text-[#d4d4d4]"
              />
            </p>
            <p className="mt-2 text-sm text-[#8f8f8f]">
              {albumDetail.album.trackCount} track
              {albumDetail.album.trackCount === 1 ? "" : "s"} ·{" "}
              {albumDetail.album.totalDurationSeconds
                ? formatDuration(Math.round(albumDetail.album.totalDurationSeconds))
                : "--:--"}
            </p>
          </div>
        </div>
        
        {albumDetail.tracks.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-label="Play album"
              onClick={() => {
                onPlayAlbum();
              }}
              className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-all"
            >
              <Play className="h-6 w-6 ml-1" fill="currentColor" strokeWidth={0} />
            </button>
          </div>
        ) : null}
      </header>

      <div className="grid min-h-0 overflow-y-auto px-8 pb-8 pt-0">
        <section className="grid min-h-[62vh] grid-rows-[auto_minmax(0,1fr)] bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="grid grid-cols-[32px_minmax(0,1fr)_100px] gap-4 border-t border-white/10 px-8 py-3 text-[11px] tracking-[0.08em] text-[#a5a5a5]">
            <span className="text-center">#</span>
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
                  "group relative grid grid-cols-[32px_minmax(0,1fr)_100px] items-center gap-4 px-8 py-2.5 text-left transition-colors",
                  activeTrackId === track.id ? "bg-white/10" : "hover:bg-white/5",
                ].join(" ")}
                onClick={() => {
                  onPlayAlbum(track.id);
                  onTrackSelect(track.id);
                }}
                onContextMenu={(e) => handleContextMenu(e, track.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onPlayAlbum(track.id);
                    onTrackSelect(track.id);
                  }
                }}
              >
                <div className="flex w-8 justify-center text-[#a5a5a5]">
                  <span className="text-[15px] tabular-nums group-hover:hidden group-focus-within:hidden">
                    {track.trackNumber ?? index + 1}
                  </span>
                  <button
                    type="button"
                    aria-label={`Play ${track.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onPlayAlbum(track.id);
                      onTrackSelect(track.id);
                    }}
                    className="hidden text-white group-hover:block group-focus-within:block focus:outline-none"
                  >
                    <Play className="h-4 w-4 ml-0.5" fill="currentColor" strokeWidth={0} />
                  </button>
                </div>
                
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-[15px] font-medium text-[#f2f2f2] group-hover:text-white transition-colors">
                    {track.title}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <AdvisoryBadge advisory={track.advisory} />
                    <ArtistLinks
                      artist={track.artist ?? albumDetail.album.artist}
                      linkClassName="text-[13px] text-[#a5a5a5] transition-colors hover:text-white"
                      separatorClassName="text-[13px] text-[#a5a5a5]"
                      unknownClassName="truncate text-[13px] text-[#a5a5a5]"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </span>
                </span>
                
                <span className="text-[13px] text-[#a5a5a5] group-hover:text-[#f2f2f2] transition-colors">
                  {track.durationSeconds
                    ? formatDuration(Math.round(track.durationSeconds))
                    : "--:--"}
                </span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
    </>
  );
}
