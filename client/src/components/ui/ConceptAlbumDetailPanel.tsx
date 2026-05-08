import { GripVertical, ImagePlus, Pencil, Play, Plus, Trash2 } from "lucide-react";

import type {
  DragEvent,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";

import type {
  ConceptAlbumDetail,
  ConceptAlbumEntryItem,
  TrackListItem,
} from "../../desktop";
import type { TracksState } from "../../types/app";
import { ArtistLinks } from "./ArtistLinks";
import { formatDuration } from "../../utils/format";
import { AdvisoryBadge } from "./AdvisoryBadge";
import { ArtworkTile } from "./ArtworkTile";

type ConceptAlbumDetailPanelProps = {
  conceptAlbum: ConceptAlbumDetail;
  entries: ConceptAlbumEntryItem[];
  tracksState: TracksState;
  visibleLibraryTracks: TrackListItem[];
  librarySearchDraft: string;
  selectedEntryId: string | null;
  draggedEntryId: string | null;
  dropIndicator: { entryId: string; placement: "before" | "after" } | null;
  onArtworkPick: () => void;
  onEditConceptAlbum: () => void;
  onDeleteConceptAlbum: () => void;
  onPlayConceptAlbum: (startEntryId?: string) => void;
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
  onTrackAdd: (track: TrackListItem) => void;
  onLibrarySearchDraftChange: (value: string) => void;
};

export function ConceptAlbumDetailPanel({
  conceptAlbum,
  entries,
  tracksState,
  visibleLibraryTracks,
  librarySearchDraft,
  selectedEntryId,
  draggedEntryId,
  dropIndicator,
  onArtworkPick,
  onEditConceptAlbum,
  onDeleteConceptAlbum,
  onPlayConceptAlbum,
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
  onTrackAdd,
  onLibrarySearchDraftChange,
}: ConceptAlbumDetailPanelProps) {
  const totalDurationSeconds = conceptAlbum.entries.reduce(
    (total, entry) => total + (entry.durationSeconds ?? 0),
    0,
  );

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-black">
      <header className="flex flex-wrap items-end justify-between gap-6 px-8 pb-4 pt-10 bg-gradient-to-b from-white/[0.07] to-transparent">
        <div className="flex min-w-0 items-end gap-6">
          <button
            type="button"
            onClick={onArtworkPick}
            className="shrink-0 transition-opacity hover:opacity-90"
            aria-label="Choose concept album cover"
          >
            {conceptAlbum.conceptAlbum.artworkKey ? (
              <ArtworkTile
                artworkKey={conceptAlbum.conceptAlbum.artworkKey}
                title={conceptAlbum.conceptAlbum.title}
                sizeClassName="h-52 w-52 shadow-2xl shadow-black/40"
                roundedClassName="rounded-md"
                fallbackClassName="bg-white/[0.04]"
              />
            ) : (
              <div className="grid h-52 w-52 place-items-center rounded-md border border-white/8 bg-white/4 text-[#8f8f8f] shadow-2xl shadow-black/40">
                <ImagePlus className="h-12 w-12" strokeWidth={1.75} />
              </div>
            )}
          </button>

          <div className="min-w-0 pb-1">
            <p className="m-0 text-[11px] tracking-[0.08em] text-[#f2f2f2]/80">concept album</p>
            <h2 className="mt-2 text-7xl font-bold tracking-[-0.04em] text-white text-wrap break-words">
              {conceptAlbum.conceptAlbum.title}
            </h2>
            <p className="mt-4 flex flex-wrap gap-x-1 text-base">
              <ArtistLinks
                artist={conceptAlbum.conceptAlbum.artist}
                linkClassName="text-[#d4d4d4] transition-colors hover:text-white"
                unknownClassName="text-[#d4d4d4]"
                separatorClassName="text-[#d4d4d4]"
              />
            </p>
            <p className="mt-2 text-sm text-[#8f8f8f]">
              {conceptAlbum.conceptAlbum.entryCount} track
              {conceptAlbum.conceptAlbum.entryCount === 1 ? "" : "s"} ·{" "}
              {conceptAlbum.entries.length > 0
                ? formatDuration(Math.round(totalDurationSeconds))
                : "--:--"}
            </p>
            {conceptAlbum.conceptAlbum.description ? (
              <p className="mt-3 max-w-2xl text-sm text-[#a5a5a5]">
                {conceptAlbum.conceptAlbum.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {conceptAlbum.entries.length > 0 ? (
            <button
              type="button"
              aria-label="Play concept album"
              onClick={() => onPlayConceptAlbum()}
              className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-all"
            >
              <Play className="h-6 w-6 ml-1" fill="currentColor" strokeWidth={0} />
            </button>
          ) : null}
          <HeaderIconButton
            label="Edit concept album"
            onClick={onEditConceptAlbum}
            icon={<Pencil className="h-5 w-5" strokeWidth={2} />}
          />
          <HeaderIconButton
            label="Delete concept album"
            onClick={onDeleteConceptAlbum}
            icon={<Trash2 className="h-5 w-5" strokeWidth={2} />}
          />
        </div>
      </header>

      <div className="grid min-h-0 overflow-y-auto px-8 pb-8 pt-0 gap-8">
        <section className="grid min-h-[50vh] grid-rows-[auto_minmax(0,1fr)] bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="grid grid-cols-[32px_minmax(0,1fr)_100px_48px] gap-4 border-t border-white/10 px-8 py-3 text-[11px] tracking-[0.08em] text-[#a5a5a5]">
            <span className="text-center">#</span>
            <span>title</span>
            <span>duration</span>
            <span></span>
          </div>

          <div className="min-h-0 overflow-y-auto" tabIndex={0} onKeyDown={onContainerKeyDown}>
            {conceptAlbum.entries.length === 0 ? (
              <div className="grid gap-2 px-5 py-8">
                <p className="m-0 text-sm text-[#e5e5e5]">No sequence yet.</p>
                <p className="m-0 text-sm text-[#8f8f8f]">
                  Add tracks from the library handoff list below to shape an editable release order.
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
                      "group relative grid grid-cols-[32px_minmax(0,1fr)_100px_48px] items-center gap-4 px-8 py-2.5 text-left transition-colors",
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
                        {entry.trackNumber ?? entry.position + 1}
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

                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate text-[15px] font-medium text-[#f2f2f2] group-hover:text-white transition-colors">{entry.title}</span>
                      <span className="flex min-w-0 items-center gap-2">
                        <AdvisoryBadge advisory={entry.advisory} />
                        <ArtistLinks
                          artist={entry.artist ?? conceptAlbum.conceptAlbum.artist}
                          linkClassName="text-[13px] text-[#a5a5a5] transition-colors hover:text-white"
                          separatorClassName="text-[13px] text-[#a5a5a5]"
                          unknownClassName="truncate text-[13px] text-[#a5a5a5]"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </span>
                    </span>

                    <span className="text-[13px] text-[#a5a5a5] group-hover:text-[#f2f2f2] transition-colors">
                      {entry.durationSeconds != null
                        ? formatDuration(Math.round(entry.durationSeconds))
                        : "--:--"}
                    </span>

                    <div className="flex items-center justify-end">
                      <OrderButton
                        label={`Drag ${entry.title}`}
                        draggable
                        className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
                        onClick={(event) => onDragHandleClick(event, entry.entryId)}
                        onMouseDown={(event) => onDragHandleMouseDown(event, entry.entryId)}
                        onDragStart={(event) => onDragHandleStart(event, entry.entryId)}
                        onDragEnd={onDragHandleEnd}
                        icon={<GripVertical className="h-4 w-4" strokeWidth={1.8} />}
                        tone="muted"
                      />
                    </div>
                  </article>
              ))
            )}
          </div>
        </section>

        <section className="grid min-h-[44vh] grid-rows-[auto_auto_minmax(0,1fr)] bg-gradient-to-b from-white/[0.04] to-transparent">
          <label className="block min-w-0 px-8 py-4">
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#f2f2f2] outline-none placeholder:text-[#6f6f6f] focus:border-white/20 focus:bg-white/10 transition-colors"
              type="text"
              value={librarySearchDraft}
              placeholder="Search title, artist, album"
              onChange={(event) => {
                onLibrarySearchDraftChange(event.target.value);
              }}
            />
          </label>

          <div className="grid grid-cols-[minmax(220px,1.8fr)_minmax(160px,1fr)_48px] gap-4 border-t border-white/10 px-8 py-3 text-[11px] tracking-[0.08em] text-[#a5a5a5]">
            <span>library handoff</span>
            <span>album</span>
            <span></span>
          </div>

          <div className="min-h-0 overflow-y-auto">
            {tracksState.status === "loading" ? (
              <div className="px-8 py-8 text-sm text-[#8f8f8f]">Loading indexed tracks...</div>
            ) : null}
            {tracksState.status === "error" ? (
              <div className="px-8 py-8 text-sm text-[#8f8f8f]">{tracksState.message}</div>
            ) : null}
            {tracksState.status !== "loading" && visibleLibraryTracks.length === 0 ? (
              <div className="grid gap-2 px-8 py-8">
                <p className="m-0 text-sm text-[#e5e5e5]">
                  {tracksState.items.length === 0 ? "No indexed tracks yet." : "No matching tracks."}
                </p>
                <p className="m-0 text-sm text-[#8f8f8f]">
                  {tracksState.items.length === 0
                    ? "Scan a local music folder before building concept albums."
                    : "Try a different title, artist, or album search."}
                </p>
              </div>
            ) : null}

            {visibleLibraryTracks.map((track) => {
              const duplicateCount = conceptAlbum.entries.filter(
                (entry) => entry.trackId === track.id,
              ).length;

              return (
                <div
                  key={track.id}
                  className="group grid grid-cols-[minmax(220px,1.8fr)_minmax(160px,1fr)_48px] items-center gap-4 px-8 py-3.5 hover:bg-white/5 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <ArtworkTile
                      artworkKey={track.artworkKey}
                      title={track.title}
                      sizeClassName="h-12 w-12 shadow-md shadow-black/40"
                      roundedClassName="rounded-sm"
                      fallbackClassName="bg-white/[0.04]"
                    />
                    <div className="grid min-w-0 gap-0.5">
                      <span className="truncate text-[15px] font-medium text-[#f2f2f2] group-hover:text-white transition-colors">{track.title}</span>
                      <span className="truncate text-[13px] text-[#a5a5a5] group-hover:text-[#f2f2f2] transition-colors">
                        {track.artist ?? "unknown artist"}
                        {duplicateCount > 0 ? ` • already sequenced ${duplicateCount}x` : ""}
                      </span>
                    </div>
                  </div>
                  <span className="truncate text-[13px] text-[#a5a5a5] group-hover:text-[#f2f2f2] transition-colors">
                    {track.album ?? "unknown album"}
                  </span>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      aria-label={`Add ${track.title} to ${conceptAlbum.conceptAlbum.title}`}
                      onClick={() => onTrackAdd(track)}
                      className="hidden items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-all h-8 w-8 group-hover:flex"
                    >
                      <Plus className="h-4 w-4" strokeWidth={3} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function HeaderIconButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-white/3 text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/5 hover:text-[#f2f2f2]"
    >
      {icon}
    </button>
  );
}

function OrderButton({
  label,
  icon,
  onClick,
  disabled,
  draggable,
  onMouseDown,
  onDragStart,
  onDragEnd,
  tone = "default",
  className,
}: {
  label: string;
  icon: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  draggable?: boolean;
  onMouseDown?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onDragStart?: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  tone?: "default" | "muted";
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      draggable={draggable}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/3 transition-colors disabled:cursor-not-allowed disabled:opacity-35",
        tone === "muted"
          ? "cursor-grab text-[#8f8f8f] hover:border-white/12 hover:bg-white/5 active:cursor-grabbing"
          : "text-[#d4d4d4] hover:border-white/12 hover:bg-white/5 hover:text-[#f2f2f2]",
        className,
      ].join(" ")}
    >
      {icon}
    </button>
  );
}
