import type { ScanState, TracksQueryState, TracksState } from "../types/app";
import { ArtworkTile } from "../components/ui/ArtworkTile";
import { formatDuration } from "../utils/format";

export function TracksPage({
  libraryPath,
  scanState,
  tracksQueryState,
  tracksState,
  onTrackSelect,
  onTracksSearchDraftChange,
  onTracksSearchSubmit,
  onTracksTitleHeaderSort,
  onTracksAlbumHeaderSort,
}: {
  libraryPath: string;
  scanState: ScanState;
  tracksQueryState: TracksQueryState;
  tracksState: TracksState;
  onTrackSelect: (track: TracksState["items"][number]) => void;
  onTracksSearchDraftChange: (value: string) => void;
  onTracksSearchSubmit: () => void;
  onTracksTitleHeaderSort: () => void;
  onTracksAlbumHeaderSort: () => void;
}) {
  const emptyState = getEmptyState(libraryPath, scanState);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4 overflow-hidden px-6 py-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">tracks</p>
          <h2 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
            library table
          </h2>
        </div>
        <div className="grid justify-items-end gap-1">
          <p className="m-0 text-sm text-[#8f8f8f]">{tracksState.total} total</p>
        </div>
      </header>

      <label className="block min-w-0">
        <input
          className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#f2f2f2] outline-none placeholder:text-[#6f6f6f]"
          type="text"
          value={tracksQueryState.searchDraft}
          placeholder="Search title, artist, album"
          onChange={(event) => {
            onTracksSearchDraftChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onTracksSearchSubmit();
            }
          }}
        />
      </label>

      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-white/6 bg-[#1b1b1b]">
        <div className="grid grid-cols-[minmax(320px,2fr)_minmax(180px,1.1fr)_96px] gap-4 border-b border-white/6 px-5 py-3 text-[11px] tracking-[0.08em] text-[#8f8f8f]">
          <button
            className="justify-self-start text-[11px] tracking-[0.08em] text-[#8f8f8f] transition-colors hover:text-[#d4d4d4]"
            type="button"
            onClick={onTracksTitleHeaderSort}
          >
            {titleHeaderLabel(tracksQueryState)}
          </button>
          <button
            className="justify-self-start text-[11px] tracking-[0.08em] text-[#8f8f8f] transition-colors hover:text-[#d4d4d4]"
            type="button"
            onClick={onTracksAlbumHeaderSort}
          >
            {albumHeaderLabel(tracksQueryState)}
          </button>
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
            <div className="grid gap-2 px-5 py-8">
              <p className="m-0 text-sm text-[#e5e5e5]">{emptyState.title}</p>
              <p className="m-0 text-sm text-[#8f8f8f]">{emptyState.detail}</p>
            </div>
          ) : null}

          {tracksState.items.map((track) => (
            <button
              key={track.id}
              className={[
                "grid w-full grid-cols-[minmax(320px,2fr)_minmax(180px,1.1fr)_96px] items-center gap-4 border-b border-white/5 px-5 py-3.5 text-left last:border-b-0",
                tracksState.selectedTrackId === track.id
                  ? "bg-white/8"
                  : "hover:bg-white/3",
              ].join(" ")}
              aria-label={`Select ${track.title}`}
              aria-pressed={tracksState.selectedTrackId === track.id}
              type="button"
              onClick={() => {
                onTrackSelect(track);
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <ArtworkTile
                  artworkKey={track.artworkKey}
                  title={track.title}
                  sizeClassName="h-11 w-11"
                  roundedClassName="rounded-sm"
                />
                <div className="grid min-w-0 gap-1">
                  <span className="truncate text-sm text-[#f2f2f2]">{track.title}</span>
                  <span className="truncate text-xs text-[#8f8f8f]">
                    {track.artist ?? "unknown artist"}
                  </span>
                </div>
              </div>
              <span className="truncate text-sm text-[#d4d4d4]">
                {track.album ?? "unknown album"}
              </span>
              <span className="text-sm text-[#8f8f8f]">
                {track.durationSeconds
                  ? formatDuration(Math.round(track.durationSeconds))
                  : "--:--"}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function titleHeaderLabel(tracksQueryState: TracksQueryState) {
  if (tracksQueryState.sortKey === "title") {
    return tracksQueryState.sortDirection === "asc" ? "title ↑" : "title ↓";
  }

  if (tracksQueryState.sortKey === "artist") {
    return tracksQueryState.sortDirection === "asc" ? "artist ↑" : "artist ↓";
  }

  return "title";
}

function albumHeaderLabel(tracksQueryState: TracksQueryState) {
  if (tracksQueryState.sortKey === "album") {
    return tracksQueryState.sortDirection === "asc" ? "album ↑" : "album ↓";
  }

  return "album";
}

function getEmptyState(libraryPath: string, scanState: ScanState) {
  if (!libraryPath.trim() && !scanState.lastScan) {
    return {
      title: "No local library selected yet.",
      detail: "Choose a folder in settings to start the first recursive audio scan.",
    };
  }

  if (scanState.lastScan && scanState.lastScan.discoveredTracks === 0) {
    return {
      title: `No audio files found in ${scanState.lastScan.libraryRootName}.`,
      detail:
        "The recursive scan completed, but that root did not contain any supported audio files in the selected folder tree.",
    };
  }

  return {
    title: "No tracks indexed yet.",
    detail: "Scan the selected folder in settings to populate the tracks table.",
  };
}
