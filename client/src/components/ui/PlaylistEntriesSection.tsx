import { ArrowDown, ArrowUp, GripVertical, Play } from "lucide-react";
import { Link } from "react-router-dom";

import { ArtistLinks } from "./ArtistLinks";
import type {
  DragEvent,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  MouseEvent as ReactMouseEvent,
} from "react";

import type { AlbumSummary, PlaylistDetail, PlaylistEntryItem } from "../../desktop";
import { AdvisoryBadge } from "./AdvisoryBadge";
import { ArtworkTile } from "./ArtworkTile";
import { formatDuration } from "../../utils/format";

export function PlaylistEntriesSection({
  playlist,
  albums,
  entries,
  selectedEntryId,
  draggedEntryId,
  dropIndicator,
  onContainerKeyDown,
  onEntrySelect,
  onEntryDragOver,
  onEntryDragLeave,
  onEntryMouseMove,
  onEntryMouseUp,
  onEntryDrop,
  onEntryPlay,
  onEntryKeyDown,
  onDragHandleClick,
  onDragHandleMouseDown,
  onDragHandleStart,
  onDragHandleEnd,
  onMoveEntryUp,
  onMoveEntryDown,
}: {
  playlist: PlaylistDetail;
  albums: AlbumSummary[];
  entries: PlaylistEntryItem[];
  selectedEntryId: string | null;
  draggedEntryId: string | null;
  dropIndicator: { entryId: string; placement: "before" | "after" } | null;
  onContainerKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onEntrySelect: (entryId: string) => void;
  onEntryDragOver: (event: DragEvent<HTMLElement>, entryId: string) => void;
  onEntryDragLeave: (event: ReactDragEvent<HTMLElement>, entryId: string) => void;
  onEntryMouseMove: (event: MouseEvent<HTMLElement>, entryId: string) => void;
  onEntryMouseUp: (event: MouseEvent<HTMLElement>, entryId: string) => void;
  onEntryDrop: (event: DragEvent<HTMLElement>, entryId: string) => void;
  onEntryPlay: (entryId: string) => void;
  onEntryKeyDown: (event: ReactKeyboardEvent<HTMLElement>, entryId: string) => void;
  onDragHandleClick: (event: ReactMouseEvent<HTMLButtonElement>, entryId: string) => void;
  onDragHandleMouseDown: (
    event: ReactMouseEvent<HTMLButtonElement>,
    entryId: string,
  ) => void;
  onDragHandleStart: (
    event: ReactDragEvent<HTMLButtonElement>,
    entryId: string,
  ) => void;
  onDragHandleEnd: () => void;
  onMoveEntryUp: (event: ReactMouseEvent<HTMLButtonElement>, entry: PlaylistEntryItem) => void;
  onMoveEntryDown: (
    event: ReactMouseEvent<HTMLButtonElement>,
    entry: PlaylistEntryItem,
  ) => void;
}) {
  return (
    <section className="grid min-h-[62vh] grid-rows-[auto_minmax(0,1fr)] bg-gradient-to-b from-white/[0.04] to-transparent">
      <div
        className={`grid gap-4 border-t border-white/10 px-8 py-3 text-[11px] tracking-[0.08em] text-[#a5a5a5] ${
          playlist.playlist.isMixtape
            ? "grid-cols-[32px_minmax(320px,2fr)_minmax(180px,1.1fr)_minmax(100px,1fr)]"
            : "grid-cols-[32px_minmax(320px,2fr)_minmax(180px,1.1fr)_minmax(100px,1fr)_48px]"
        }`}
      >
        <span className="text-center">#</span>
        <span>title</span>
        <span>album</span>
        <span>duration</span>
        {!playlist.playlist.isMixtape ? <span></span> : null}
      </div>

      <div className="min-h-0 overflow-y-auto" tabIndex={0} onKeyDown={onContainerKeyDown}>
        {playlist.entries.length === 0 ? (
          <div className="grid gap-2 px-5 py-8">
            <p className="m-0 text-sm text-[#e5e5e5]">No tracks saved yet.</p>
            <p className="m-0 text-sm text-[#8f8f8f]">
              Use the library handoff list below to start building the playlist order.
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            (() => {
              const albumSummary = resolveAlbumSummary(albums, entry.album, entry.artist);

              return (
            <article
              key={entry.entryId}
              role="button"
              tabIndex={0}
              aria-label={`Select ${entry.title}`}
              aria-pressed={selectedEntryId === entry.entryId}
              onClick={() => onEntrySelect(entry.entryId)}
              onDragOver={(event) => onEntryDragOver(event, entry.entryId)}
              onDragLeave={(event) => onEntryDragLeave(event, entry.entryId)}
              onMouseMove={(event) => onEntryMouseMove(event, entry.entryId)}
              onMouseUp={(event) => onEntryMouseUp(event, entry.entryId)}
              onDrop={(event) => onEntryDrop(event, entry.entryId)}
              onDoubleClick={() => onEntryPlay(entry.entryId)}
              onKeyDown={(event) => onEntryKeyDown(event, entry.entryId)}
              className={[
                `group relative grid w-full items-center gap-4 px-8 py-2.5 text-left transition-colors ${
                  playlist.playlist.isMixtape
                    ? "grid-cols-[32px_minmax(320px,2fr)_minmax(180px,1.1fr)_minmax(100px,1fr)]"
                    : "grid-cols-[32px_minmax(320px,2fr)_minmax(180px,1.1fr)_minmax(100px,1fr)_48px]"
                }`,
                selectedEntryId === entry.entryId ? "bg-white/10" : "hover:bg-white/5",
                draggedEntryId === entry.entryId ? "opacity-60" : "",
              ].join(" ")}
            >
              {dropIndicator?.entryId === entry.entryId &&
              dropIndicator.placement === "before" ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-4 top-0 z-10 h-1 rounded-full bg-[#f2f2f2] shadow-[0_0_0_1px_rgba(18,18,18,0.9)]"
                />
              ) : null}
              {dropIndicator?.entryId === entry.entryId &&
              dropIndicator.placement === "after" ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-4 bottom-0 z-10 h-1 rounded-full bg-[#f2f2f2] shadow-[0_0_0_1px_rgba(18,18,18,0.9)]"
                />
              ) : null}

              <div className="flex w-8 justify-center text-[#a5a5a5]">
                <span className="text-[15px] tabular-nums group-hover:hidden group-focus-within:hidden">
                  {entry.position + 1}
                </span>
                <button
                  type="button"
                  aria-label={`Play ${entry.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEntryPlay(entry.entryId);
                  }}
                  className="hidden text-white group-hover:block group-focus-within:block focus:outline-none"
                >
                  <Play className="h-4 w-4 ml-0.5" fill="currentColor" strokeWidth={0} />
                </button>
              </div>

              <div className="flex min-w-0 items-center gap-4">
                <ArtworkTile
                  artworkKey={
                    playlist.playlist.isMixtape ? playlist.playlist.artworkKey : entry.artworkKey
                  }
                  title={entry.title}
                  sizeClassName="h-12 w-12 shadow-md shadow-black/40"
                  roundedClassName="rounded-sm"
                  fallbackClassName="bg-white/[0.04]"
                />
                <div className="grid min-w-0 gap-0.5">
                  <span className="truncate text-[15px] font-medium text-[#f2f2f2] group-hover:text-white transition-colors">{entry.title}</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <AdvisoryBadge advisory={entry.advisory} />
                    <ArtistLinks
                      artist={entry.artist}
                      linkClassName="text-[13px] text-[#a5a5a5] transition-colors hover:text-white"
                      separatorClassName="text-[13px] text-[#a5a5a5]"
                      unknownClassName="truncate text-[13px] text-[#a5a5a5]"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </div>

              {albumSummary ? (
                <Link
                  to={`/albums/${albumSummary.id}`}
                  className="truncate text-[13px] text-[#a5a5a5] underline-offset-4 hover:text-[#f2f2f2] hover:underline transition-colors"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  {entry.album ?? "unknown album"}
                </Link>
              ) : (
                <span className="truncate text-[13px] text-[#a5a5a5] group-hover:text-[#f2f2f2] transition-colors">
                  {entry.album ?? "unknown album"}
                </span>
              )}

              <span className="text-[13px] text-[#a5a5a5] group-hover:text-[#f2f2f2] transition-colors">
                {entry.durationSeconds != null
                  ? formatDuration(Math.round(entry.durationSeconds))
                  : "--:--"}
              </span>

              {!playlist.playlist.isMixtape ? (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    draggable
                    aria-label={`Drag ${entry.title}`}
                    onClick={(event) => onDragHandleClick(event, entry.entryId)}
                    onMouseDown={(event) => onDragHandleMouseDown(event, entry.entryId)}
                    onDragStart={(event) => onDragHandleStart(event, entry.entryId)}
                    onDragEnd={onDragHandleEnd}
                    className="inline-flex h-8 w-8 cursor-grab items-center justify-center text-[#8f8f8f] transition-colors hover:text-white active:cursor-grabbing opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <GripVertical className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              ) : null}
            </article>
              );
            })()
          ))
        )}
      </div>
    </section>
  );
}

function resolveAlbumSummary(
  albums: AlbumSummary[],
  albumTitle: string | null,
  artistName: string | null,
) {
  if (!albumTitle) {
    return null;
  }

  return (
    albums.find(
      (album) =>
        album.title === albumTitle &&
        (album.artist ?? null) === (artistName ?? null),
    ) ??
    albums.find((album) => album.title === albumTitle) ??
    null
  );
}
