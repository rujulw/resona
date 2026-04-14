import { Plus } from "lucide-react";

import type { PlaylistDetail, TrackListItem } from "../../desktop";
import type { TracksState } from "../../types/app";
import { ArtworkTile } from "./ArtworkTile";

export function PlaylistLibrarySection({
  playlist,
  tracksState,
  searchDraft,
  visibleTracks,
  onSearchDraftChange,
  onTrackAdd,
}: {
  playlist: PlaylistDetail;
  tracksState: TracksState;
  searchDraft: string;
  visibleTracks: TrackListItem[];
  onSearchDraftChange: (value: string) => void;
  onTrackAdd: (track: TrackListItem) => void;
}) {
  return (
    <section className="grid min-h-[44vh] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-white/6 bg-[#1b1b1b]">
      <label className="block min-w-0 border-b border-white/6 px-5 py-4">
        <input
          className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#f2f2f2] outline-none placeholder:text-[#6f6f6f]"
          type="text"
          value={searchDraft}
          placeholder="Search title, artist, album"
          onChange={(event) => {
            onSearchDraftChange(event.target.value);
          }}
        />
      </label>

      <div className="grid grid-cols-[minmax(320px,2fr)_minmax(180px,1.1fr)_72px] gap-4 border-b border-white/6 px-5 py-3 text-[11px] tracking-[0.08em] text-[#8f8f8f]">
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

        {tracksState.status !== "loading" && visibleTracks.length === 0 ? (
          <div className="grid gap-2 px-5 py-8">
            <p className="m-0 text-sm text-[#e5e5e5]">
              {tracksState.items.length === 0 ? "No indexed tracks yet." : "No matching tracks."}
            </p>
            <p className="m-0 text-sm text-[#8f8f8f]">
              {tracksState.items.length === 0
                ? "Scan a local music folder before adding tracks to playlists."
                : "Try a different title, artist, or album search."}
            </p>
          </div>
        ) : null}

        {visibleTracks.map((track) => {
          const duplicateCount = playlist.entries.filter((entry) => entry.trackId === track.id).length;

          return (
            <div
              key={track.id}
              className="grid grid-cols-[minmax(320px,2fr)_minmax(180px,1.1fr)_72px] items-center gap-4 border-b border-white/5 px-5 py-3.5 last:border-b-0"
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
                    {duplicateCount > 0 ? ` • already added ${duplicateCount}x` : ""}
                  </span>
                </div>
              </div>

              <span className="truncate text-sm text-[#d4d4d4]">
                {track.album ?? "unknown album"}
              </span>

              <button
                type="button"
                aria-label={`Add ${track.title} to ${playlist.playlist.name}`}
                onClick={() => onTrackAdd(track)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/[0.05] hover:text-[#f2f2f2]"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
