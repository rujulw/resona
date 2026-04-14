import { ArrowDown, ArrowUp, GripVertical, Play } from "lucide-react";
import type {
  DragEvent,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  MouseEvent as ReactMouseEvent,
} from "react";

import type { PlaylistDetail, PlaylistEntryItem } from "../../desktop";
import { AdvisoryBadge } from "./AdvisoryBadge";
import { ArtworkTile } from "./ArtworkTile";
import { formatDuration } from "../../utils/format";

export function PlaylistEntriesSection({
  playlist,
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
    <section className="grid min-h-[62vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-white/6 bg-[#1b1b1b]">
      <div className="grid grid-cols-[minmax(320px,2fr)_minmax(180px,1.1fr)_96px_112px] gap-4 border-b border-white/6 px-5 py-3 text-[11px] tracking-[0.08em] text-[#8f8f8f]">
        <span>saved order</span>
        <span>album</span>
        <span>duration</span>
        <span>actions</span>
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
                "relative grid w-full grid-cols-[minmax(320px,2fr)_minmax(180px,1.1fr)_96px_112px] items-center gap-4 border-b border-white/5 px-5 py-3.5 text-left last:border-b-0",
                selectedEntryId === entry.entryId ? "bg-white/8" : "hover:bg-white/3",
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

              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  aria-label={`Play ${entry.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEntryPlay(entry.entryId);
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/3 text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/5 hover:text-[#f2f2f2]"
                >
                  <Play className="h-4 w-4" strokeWidth={2} />
                </button>
                <ArtworkTile
                  artworkKey={entry.artworkKey}
                  title={entry.title}
                  sizeClassName="h-11 w-11"
                  roundedClassName="rounded-sm"
                  fallbackClassName="bg-white/[0.04]"
                />
                <div className="grid min-w-0 gap-1">
                  <span className="truncate text-sm text-[#f2f2f2]">{entry.title}</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <AdvisoryBadge advisory={entry.advisory} />
                    <span className="truncate text-xs text-[#8f8f8f]">
                      {entry.artist ?? "unknown artist"}
                    </span>
                  </div>
                </div>
              </div>

              <span className="truncate text-sm text-[#d4d4d4]">
                {entry.album ?? "unknown album"}
              </span>

              <span className="text-sm text-[#8f8f8f]">
                {entry.durationSeconds != null
                  ? formatDuration(Math.round(entry.durationSeconds))
                  : "--:--"}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  draggable
                  aria-label={`Drag ${entry.title}`}
                  onClick={(event) => onDragHandleClick(event, entry.entryId)}
                  onMouseDown={(event) => onDragHandleMouseDown(event, entry.entryId)}
                  onDragStart={(event) => onDragHandleStart(event, entry.entryId)}
                  onDragEnd={onDragHandleEnd}
                  className="inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-xl border border-white/8 bg-white/3 text-[#8f8f8f] transition-colors hover:border-white/12 hover:bg-white/5 active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${entry.title} up`}
                  disabled={entry.position === 0}
                  onClick={(event) => onMoveEntryUp(event, entry)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/3 text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/5 hover:text-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${entry.title} down`}
                  disabled={entry.position === entries.length - 1}
                  onClick={(event) => onMoveEntryDown(event, entry)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/3 text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/5 hover:text-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ArrowDown className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
