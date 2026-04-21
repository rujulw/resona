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
    <section className="grid min-h-0 gap-5">
      <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-white/6 bg-[#181818] px-6 py-7">
        <div className="flex min-w-0 items-start gap-5">
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
                sizeClassName="h-36 w-36"
                roundedClassName="rounded-sm"
                fallbackClassName="bg-white/[0.04]"
              />
            ) : (
              <div className="grid h-36 w-36 place-items-center rounded-sm border border-white/8 bg-white/4 text-[#8f8f8f]">
                <ImagePlus className="h-10 w-10" strokeWidth={1.75} />
              </div>
            )}
          </button>

          <div className="min-w-0 pt-1">
            <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">concept album</p>
            <h2 className="mt-4 text-6xl font-medium tracking-[-0.06em] text-[#f2f2f2]">
              {conceptAlbum.conceptAlbum.title}
            </h2>
            <p className="mt-4 text-base text-[#d4d4d4]">
              {conceptAlbum.conceptAlbum.artist ?? "unknown artist"}
            </p>
            <p className="mt-3 text-sm text-[#8f8f8f]">
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

        <div className="flex flex-wrap gap-2">
          {conceptAlbum.entries.length > 0 ? (
            <HeaderIconButton
              label="Play concept album"
              onClick={() => onPlayConceptAlbum()}
              icon={<Play className="h-4 w-4" strokeWidth={2} />}
            />
          ) : null}
          <HeaderIconButton
            label="Edit concept album"
            onClick={onEditConceptAlbum}
            icon={<Pencil className="h-4 w-4" strokeWidth={2} />}
          />
          <HeaderIconButton
            label="Delete concept album"
            onClick={onDeleteConceptAlbum}
            icon={<Trash2 className="h-4 w-4" strokeWidth={2} />}
          />
        </div>
      </header>

      <section className="grid min-h-[64vh] gap-4">
        <section className="grid min-h-[48vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-white/6 bg-[#1b1b1b]">
          <div className="grid grid-cols-[40px_minmax(0,1fr)_96px_72px] gap-4 border-b border-white/6 px-3 py-3 text-[11px] tracking-[0.08em] text-[#8f8f8f]">
            <span>track</span>
            <span>title</span>
            <span>duration</span>
            <span>order</span>
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
                      "relative grid grid-cols-[30px_minmax(0,1fr)_96px_72px] items-center gap-4 border-b border-white/5 px-5 py-3.5 text-left last:border-b-0",
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

                    <span className="text-sm text-[#8f8f8f]">
                      {entry.trackNumber ?? entry.position + 1}
                    </span>

                    <span className="grid min-w-0 gap-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm text-[#f2f2f2]">{entry.title}</span>
                        <AdvisoryBadge advisory={entry.advisory} />
                      </span>
                      <span className="truncate text-xs text-[#8f8f8f]">
                        {entry.artist ?? conceptAlbum.conceptAlbum.artist ?? "unknown artist"}
                      </span>
                    </span>

                    <span className="text-sm text-[#8f8f8f]">
                      {entry.durationSeconds != null
                        ? formatDuration(Math.round(entry.durationSeconds))
                        : "--:--"}
                    </span>

                    <div className="flex items-center gap-1">
                      <OrderButton
                        label={`Drag ${entry.title}`}
                        draggable
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

        <section className="grid min-h-[44vh] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-white/6 bg-[#1b1b1b]">
          <label className="block min-w-0 border-b border-white/6 px-5 py-4">
            <input
              className="w-full rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-[#f2f2f2] outline-none placeholder:text-[#6f6f6f]"
              type="text"
              value={librarySearchDraft}
              placeholder="Search title, artist, album"
              onChange={(event) => {
                onLibrarySearchDraftChange(event.target.value);
              }}
            />
          </label>

          <div className="grid grid-cols-[minmax(220px,1.8fr)_minmax(160px,1fr)_72px] gap-4 border-b border-white/6 px-5 py-3 text-[11px] tracking-[0.08em] text-[#8f8f8f]">
            <span>library handoff</span>
            <span>album</span>
            <span>add</span>
          </div>

          <div className="min-h-0 overflow-y-auto">
            {tracksState.status === "loading" ? (
              <div className="px-5 py-8 text-sm text-[#8f8f8f]">Loading indexed tracks...</div>
            ) : null}
            {tracksState.status === "error" ? (
              <div className="px-5 py-8 text-sm text-[#8f8f8f]">{tracksState.message}</div>
            ) : null}
            {tracksState.status !== "loading" && visibleLibraryTracks.length === 0 ? (
              <div className="grid gap-2 px-5 py-8">
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
                  className="grid grid-cols-[minmax(220px,1.8fr)_minmax(160px,1fr)_72px] items-center gap-4 border-b border-white/5 px-5 py-3.5 last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ArtworkTile
                      artworkKey={track.artworkKey}
                      title={track.title}
                      sizeClassName="h-11 w-11"
                      roundedClassName="rounded-sm"
                      fallbackClassName="bg-white/[0.04]"
                    />
                    <div className="grid min-w-0 gap-1">
                      <span className="truncate text-sm text-[#f2f2f2]">{track.title}</span>
                      <span className="truncate text-xs text-[#8f8f8f]">
                        {track.artist ?? "unknown artist"}
                        {duplicateCount > 0 ? ` • already sequenced ${duplicateCount}x` : ""}
                      </span>
                    </div>
                  </div>
                  <span className="truncate text-sm text-[#d4d4d4]">
                    {track.album ?? "unknown album"}
                  </span>
                  <button
                    type="button"
                    aria-label={`Add ${track.title} to ${conceptAlbum.conceptAlbum.title}`}
                    onClick={() => onTrackAdd(track)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/3 text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/5 hover:text-[#f2f2f2]"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </section>
    </section>
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
      ].join(" ")}
    >
      {icon}
    </button>
  );
}
