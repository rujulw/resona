import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

import { queryTopArtists, queryTopTracks, resolveArtworkSource } from "../desktop";
import type { PlaylistSummary, TopArtistEntry, TopTrackEntry, TrackListItem } from "../desktop";
import { AdvisoryBadge } from "../components/ui/AdvisoryBadge";
import { useTrackContextMenu } from "../contexts/QueueActionsContext";
import { artistRoute } from "../constants/routes";

type TimeRange = "4w" | "6m" | "all";

const TIME_RANGES: { value: TimeRange; label: string; days: number | undefined }[] = [
  { value: "4w", label: "4 weeks", days: 28 },
  { value: "6m", label: "6 months", days: 180 },
  { value: "all", label: "all time", days: undefined },
];

const PER_PAGE = 5;

type DerivedAlbum = { name: string; albumId: string; artworkKey: string | null; playCount: number };

function encodeAlbumId(album: string, artist: string | null): string {
  const normalize = (s: string) => s.trim().toLowerCase();
  const escape = (s: string) => s.replace(/%/g, "%25").replace(/:/g, "%3A");
  return `album:${escape(normalize(album))}:${escape(normalize(artist ?? ""))}`;
}

function deriveTopAlbums(tracks: TopTrackEntry[]): DerivedAlbum[] {
  const map = new Map<string, DerivedAlbum>();
  for (const t of tracks) {
    if (!t.album) continue;
    const key = encodeAlbumId(t.album, t.artist);
    const existing = map.get(key);
    if (existing) {
      existing.playCount += t.playCount;
      if (!existing.artworkKey && t.artworkKey) existing.artworkKey = t.artworkKey;
    } else {
      map.set(key, {
        name: t.album,
        albumId: key,
        artworkKey: t.artworkKey,
        playCount: t.playCount,
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 20);
}

function getPage<T>(list: T[], page: number): T[] {
  return list.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
}

// ── Lazy artwork ─────────────────────────────────────────────────────────────

function ArtworkImage({
  artworkKey,
  className,
}: {
  artworkKey: string | null | undefined;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!artworkKey) return;
    let cancelled = false;
    void resolveArtworkSource(artworkKey).then((src) => {
      if (!cancelled) setUrl(src?.assetUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [artworkKey]);

  if (!url) return <div className={`bg-white/[0.05] ${className ?? ""}`} />;
  return <img src={url} alt="" className={`object-cover ${className ?? ""}`} />;
}

// ── Section pager header ─────────────────────────────────────────────────────

function PagerHeader({
  title,
  onPrev,
  onNext,
  disablePrev,
  disableNext,
  first = false,
}: {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  disablePrev: boolean;
  disableNext: boolean;
  first?: boolean;
}) {
  return (
    <div className={`mb-3 flex items-center justify-between ${first ? "mt-0" : "mt-1"}`}>
      <p className="text-[11px] tracking-[0.08em] text-[#4a4a4a]">{title}</p>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={disablePrev}
          className="rounded-sm bg-white/5 p-1 transition-colors hover:bg-white/10 disabled:opacity-20"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-[#6f6f6f]" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={disableNext}
          className="rounded-sm bg-white/5 p-1 transition-colors hover:bg-white/10 disabled:opacity-20"
        >
          <ChevronRight className="h-3.5 w-3.5 text-[#6f6f6f]" />
        </button>
      </div>
    </div>
  );
}

// ── Track row ────────────────────────────────────────────────────────────────

const TRACK_ROW_HEIGHT = "3.75rem"; // ~60px

function TrackRow({ entry, trackId, onClick }: { entry: TopTrackEntry; trackId: string; onClick: () => void }) {
  const { handleContextMenu, contextMenuEl } = useTrackContextMenu();
  return (
    <>
    {contextMenuEl}
    <button
      type="button"
      onClick={onClick}
      onContextMenu={(e) => handleContextMenu(e, trackId)}
      className="group flex w-full shrink-0 items-center gap-3 rounded-sm px-2 text-left transition-colors hover:bg-white/5"
      style={{ height: TRACK_ROW_HEIGHT }}
    >
      <ArtworkImage artworkKey={entry.artworkKey} className="h-10 w-10 shrink-0 rounded-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#d0d0d0] transition-colors group-hover:text-white">
          {entry.title}
        </p>
        <div className="flex items-center gap-1.5">
          {entry.advisory && <AdvisoryBadge advisory={entry.advisory} />}
          <p className="truncate text-[11px] font-medium text-[#5a5a5a]">{entry.artist}</p>
        </div>
      </div>
    </button>
    </>
  );
}

function TrackRowSkeleton() {
  return (
    <div
      className="flex shrink-0 animate-pulse items-center gap-3 px-2"
      style={{ height: TRACK_ROW_HEIGHT }}
    >
      <div className="h-9 w-9 shrink-0 rounded-sm bg-white/5" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 w-3/4 rounded-sm bg-white/[0.08]" />
        <div className="h-2 w-1/2 rounded-sm bg-white/5" />
      </div>
    </div>
  );
}

// ── Tile components ──────────────────────────────────────────────────────────

function AlbumTile({ album, onClick }: { album: DerivedAlbum; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
      <ArtworkImage artworkKey={album.artworkKey} className="mb-1.5 aspect-square w-full rounded-sm shadow-md" />
      <p className="truncate text-xs font-medium text-[#8f8f8f]">{album.name}</p>
    </button>
  );
}

function ArtistTile({ entry, onClick }: { entry: TopArtistEntry; onClick: () => void }) {
  const imgSrc = entry.imagePath ? convertFileSrc(entry.imagePath) : null;
  return (
    <button type="button" onClick={onClick} className="min-w-0 flex-1 flex flex-col items-center">
      <div className="mb-2 aspect-square w-full overflow-hidden rounded-full bg-white/[0.06]">
        {imgSrc ? (
          <img src={imgSrc} alt={entry.artist} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[#5a5a5a]">
            {entry.artist.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <p className="w-full truncate text-center text-xs font-medium text-[#8f8f8f]">
        {entry.artist}
      </p>
    </button>
  );
}

function PlaylistTile({ playlist, onClick }: { playlist: PlaylistSummary; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
      <ArtworkImage artworkKey={playlist.artworkKey} className="mb-1.5 aspect-square w-full rounded-sm shadow-md" />
      <p className="truncate text-xs font-medium text-[#8f8f8f]">{playlist.name}</p>
    </button>
  );
}

function TileSkeleton({ circle = false }: { circle?: boolean }) {
  return (
    <div className="min-w-0 flex-1 animate-pulse">
      <div className={`aspect-square w-full bg-white/5 mb-1.5 ${circle ? "rounded-full" : "rounded-sm"}`} />
      <div className="h-2.5 w-2/3 rounded-sm bg-white/[0.06]" />
    </div>
  );
}

function EmptyTile() {
  return <div className="min-w-0 flex-1" />;
}

function padTiles(count: number) {
  const need = PER_PAGE - count;
  return need > 0 ? Array.from({ length: need }, (_, i) => <EmptyTile key={`empty-${i}`} />) : null;
}

// ── Time range switcher ──────────────────────────────────────────────────────

function TimeRangeSwitcher({
  selected,
  onChange,
  loading,
}: {
  selected: TimeRange;
  onChange: (r: TimeRange) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="select time range"
        className={[
          "flex h-6 w-6 items-center justify-center rounded-sm border transition-all duration-500",
          loading
            ? "animate-pulse border-white/30 bg-white/10"
            : "border-white/8 bg-white/5 hover:bg-white/10",
        ].join(" ")}
      >
        <div className="grid grid-cols-2 gap-[2px]">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-[3px] w-[3px] rounded-[1px] ${loading ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-20 w-36 rounded-sm border border-white/10 bg-[#0e0e0e] p-1.5 shadow-2xl">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => { onChange(r.value); setOpen(false); }}
              className={[
                "w-full rounded-sm px-3 py-2 text-left text-[11px] tracking-[0.06em] transition-colors",
                selected === r.value
                  ? "bg-white/10 text-white"
                  : "text-[#4a4a4a] hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AnalyticsPage({
  playlists,
  allTracks,
  onTrackSelect,
}: {
  playlists: PlaylistSummary[];
  allTracks: TrackListItem[];
  onTrackSelect: (
    track: TrackListItem,
    options?: { queueTrackIds?: string[]; queueItems?: TrackListItem[]; sourceLabel?: string },
  ) => void;
}) {
  const navigate = useNavigate();
  const [range, setRange] = useState<TimeRange>("all");
  const [tracks, setTracks] = useState<TopTrackEntry[]>([]);
  const [artists, setArtists] = useState<TopArtistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [albumPage, setAlbumPage] = useState(0);
  const [artistPage, setArtistPage] = useState(0);
  const [playlistPage, setPlaylistPage] = useState(0);

  const tracksById = useMemo(
    () => new Map(allTracks.map((t) => [t.id, t])),
    [allTracks],
  );

  const days = TIME_RANGES.find((r) => r.value === range)?.days;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      queryTopTracks(days, 50),
      queryTopArtists(days, 25),
    ]).then(([t, a]) => {
      if (!cancelled) {
        setTracks(t);
        setArtists(a);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [days]);

  useEffect(() => {
    setAlbumPage(0);
    setArtistPage(0);
    setPlaylistPage(0);
  }, [range]);

  const albums = deriveTopAlbums(tracks);
  const pagedAlbums = getPage(albums, albumPage);
  const pagedArtists = getPage(artists, artistPage);
  const pagedPlaylists = getPage(playlists, playlistPage);

  return (
    <div className="flex h-full min-h-0 bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Left: top tracks */}
      <div className="flex w-[clamp(240px,26%,340px)] shrink-0 flex-col border-r border-white/5 py-12">
        <div className="shrink-0 px-2 py-2">
          <p className="text-[11px] tracking-[0.08em] text-[#4a4a4a]">top tracks</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {loading
            ? Array.from({ length: 10 }, (_, i) => <TrackRowSkeleton key={i} />)
            : tracks.length === 0
              ? <p className="px-4 py-4 text-xs text-[#3a3a3a]">no play data yet</p>
              : tracks.map((t) => (
                  <TrackRow
                    key={t.trackId}
                    entry={t}
                    trackId={t.trackId}
                    onClick={() => {
                      const full = tracksById.get(t.trackId);
                      if (full) {
                        const queueItems = tracks
                          .map((entry) => tracksById.get(entry.trackId))
                          .filter((item): item is TrackListItem => item != null);
                        onTrackSelect(full, {
                          queueTrackIds: queueItems.map((item) => item.id),
                          queueItems,
                          sourceLabel: "analytics-top-tracks",
                        });
                      }
                    }}
                  />
                ))}
        </div>
      </div>

      {/* Right: grids */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-end px-6 py-4">
          <TimeRangeSwitcher selected={range} onChange={setRange} loading={loading} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Albums */}
          <section>
            <PagerHeader
              title="top albums"
              onPrev={() => setAlbumPage((p) => Math.max(0, p - 1))}
              onNext={() => setAlbumPage((p) => p + 1)}
              disablePrev={albumPage === 0}
              disableNext={(albumPage + 1) * PER_PAGE >= albums.length}
              first
            />
            <div className="flex gap-3">
              {loading
                ? Array.from({ length: PER_PAGE }, (_, i) => <TileSkeleton key={i} />)
                : pagedAlbums.length === 0
                  ? <p className="py-2 text-xs text-[#3a3a3a]">no album data yet</p>
                  : <>{pagedAlbums.map((a) => (
                      <AlbumTile
                        key={a.artworkKey ?? a.name}
                        album={a}
                        onClick={() => navigate(`/albums/${a.albumId}`)}
                      />
                    ))}{padTiles(pagedAlbums.length)}</>}
            </div>
          </section>

          {/* Artists */}
          <section>
            <PagerHeader
              title="top artists"
              onPrev={() => setArtistPage((p) => Math.max(0, p - 1))}
              onNext={() => setArtistPage((p) => p + 1)}
              disablePrev={artistPage === 0}
              disableNext={(artistPage + 1) * PER_PAGE >= artists.length}
            />
            <div className="flex gap-3">
              {loading
                ? Array.from({ length: PER_PAGE }, (_, i) => <TileSkeleton key={i} circle />)
                : pagedArtists.length === 0
                  ? <p className="py-2 text-xs text-[#3a3a3a]">no artist data yet</p>
                  : <>{pagedArtists.map((a) => (
                      <ArtistTile
                        key={a.artist}
                        entry={a}
                        onClick={() => navigate(artistRoute(a.artist))}
                      />
                    ))}{padTiles(pagedArtists.length)}</>}
            </div>
          </section>

          {/* Playlists */}
          <section>
            <PagerHeader
              title="playlists"
              onPrev={() => setPlaylistPage((p) => Math.max(0, p - 1))}
              onNext={() => setPlaylistPage((p) => p + 1)}
              disablePrev={playlistPage === 0}
              disableNext={(playlistPage + 1) * PER_PAGE >= playlists.length}
            />
            <div className="flex gap-3">
              {pagedPlaylists.length === 0
                ? <p className="py-2 text-xs text-[#3a3a3a]">no playlists yet</p>
                : <>{pagedPlaylists.map((p) => (
                    <PlaylistTile
                      key={p.id}
                      playlist={p}
                      onClick={() => navigate(`/playlists/${p.id}`)}
                    />
                  ))}{padTiles(pagedPlaylists.length)}</>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
