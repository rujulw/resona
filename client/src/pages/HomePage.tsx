import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type {
  AlbumSummary,
  ConceptAlbumSummary,
  PlaylistSummary,
  TrackListItem,
} from "../desktop";
import type { AlbumsState, ConceptAlbumsState, PlaylistsState, TracksState } from "../types/app";
import { ArtworkTile } from "../components/ui/ArtworkTile";
import { formatDuration } from "../utils/format";

type ResultKind = "track" | "album" | "artist" | "playlist" | "concept-album";

type SearchEntry = {
  id: string;
  kind: ResultKind;
  label: string;
  sublabel: string;
  meta: string;
  artworkKey: string | null;
  score: number;
  onSelect: () => void;
};

function scoreMatch(primary: string, secondary: string, q: string): number {
  const p = primary.toLowerCase();
  const s = secondary.toLowerCase();
  if (p === q) return 0;
  if (p.startsWith(q)) return 1;
  if (p.includes(q)) return 2;
  if (s.startsWith(q)) return 3;
  if (s.includes(q)) return 4;
  return Infinity;
}

const SEP_RE = /(,\s+|\s+feat\.\s+|\s+feat\s+|\s+ft\.\s+|\s+ft\s+|\s+&\s+|\s+x\s+|\s+\/\s+)/gi;

export function HomePage({
  tracksState,
  albumsState,
  playlistsState,
  conceptAlbumsState,
  onTrackSelect,
}: {
  tracksState: TracksState;
  albumsState: AlbumsState;
  playlistsState: PlaylistsState;
  conceptAlbumsState: ConceptAlbumsState;
  onTrackSelect: (
    track: TrackListItem,
    options?: { queueTrackIds?: string[]; queueItems?: TrackListItem[]; sourceLabel?: string },
  ) => void;
}) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const q = query.trim().toLowerCase();

  const recentlyAdded = useMemo(
    () => [...tracksState.items].sort(() => Math.random() - 0.5).slice(0, 20),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracksState.items.length],
  );

  const combinedAlbums = useMemo(() => {
    type Entry =
      | { kind: "album"; item: AlbumSummary }
      | { kind: "concept"; item: ConceptAlbumSummary };
    const all: Entry[] = [
      ...albumsState.items.map((item) => ({ kind: "album" as const, item })),
      ...conceptAlbumsState.items.map((item) => ({ kind: "concept" as const, item })),
    ];
    return all.sort((a, b) => a.item.title.localeCompare(b.item.title));
  }, [albumsState.items, conceptAlbumsState.items]);

  const results = useMemo<SearchEntry[]>(() => {
    if (!q) return [];

    // Score and sort tracks first so every track entry's onSelect closure captures
    // the full scored list as queue context — preserving search result order.
    const scoredTracks = tracksState.items
      .map((t) => ({ t, score: scoreMatch(t.title, `${t.artist ?? ""} ${t.album ?? ""}`, q) }))
      .filter(({ score }) => score < Infinity)
      .sort((a, b) => a.score - b.score);

    const scoredTrackIds = scoredTracks.map(({ t }) => t.id);
    const scoredTrackItems = scoredTracks.map(({ t }) => t);

    const entries: SearchEntry[] = [];

    for (const { t, score } of scoredTracks) {
      entries.push({
        id: `track:${t.id}`,
        kind: "track",
        label: t.title,
        sublabel: t.album ?? "",
        meta: t.durationSeconds != null ? formatDuration(Math.round(t.durationSeconds)) : "",
        artworkKey: t.artworkKey,
        score,
        onSelect: () =>
          onTrackSelect(t, {
            queueTrackIds: scoredTrackIds,
            queueItems: scoredTrackItems,
            sourceLabel: "home-search",
          }),
      });
    }

    for (const a of albumsState.items) {
      const score = scoreMatch(a.title, a.artist ?? "", q);
      if (score < Infinity) {
        entries.push({
          id: `album:${a.id}`,
          kind: "album",
          label: a.title,
          sublabel: "",
          meta: `${a.trackCount} tracks`,
          artworkKey: a.artworkKey,
          score,
          onSelect: () => navigate(`/albums/${a.id}`),
        });
      }
    }

    const artistMap = new Map<string, { trackCount: number; bestScore: number }>();
    for (const t of tracksState.items) {
      if (!t.artist) continue;
      const names = t.artist
        .split(SEP_RE)
        .filter((_, i) => i % 2 === 0)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const name of names) {
        const score = scoreMatch(name, "", q);
        if (score < Infinity) {
          const existing = artistMap.get(name);
          artistMap.set(name, {
            trackCount: (existing?.trackCount ?? 0) + 1,
            bestScore: existing ? Math.min(existing.bestScore, score) : score,
          });
        }
      }
    }
    for (const [name, { trackCount: tc, bestScore }] of artistMap.entries()) {
      entries.push({
        id: `artist:${name}`,
        kind: "artist",
        label: name,
        sublabel: "",
        meta: `${tc} tracks`,
        artworkKey: null,
        score: bestScore,
        onSelect: () => navigate(`/artist/${encodeURIComponent(name)}`),
      });
    }

    for (const p of playlistsState.items) {
      const score = scoreMatch(p.name, "", q);
      if (score < Infinity) {
        entries.push({
          id: `playlist:${p.id}`,
          kind: "playlist",
          label: p.name,
          sublabel: p.isMixtape ? "mixtape" : "playlist",
          meta: `${p.entryCount} tracks`,
          artworkKey: p.artworkKey,
          score,
          onSelect: () => navigate(`/playlists/${p.id}`),
        });
      }
    }

    for (const ca of conceptAlbumsState.items) {
      const score = scoreMatch(ca.title, ca.artist ?? "", q);
      if (score < Infinity) {
        entries.push({
          id: `ca:${ca.id}`,
          kind: "concept-album",
          label: ca.title,
          sublabel: "",
          meta: `${ca.entryCount} tracks`,
          artworkKey: ca.artworkKey,
          score,
          onSelect: () => navigate(`/concept-albums/${ca.id}`),
        });
      }
    }

    return entries.sort((a, b) => a.score - b.score);
  }, [q, tracksState.items, albumsState.items, playlistsState.items, conceptAlbumsState.items, navigate, onTrackSelect]);

  const isSearching = q.length > 0;

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="px-8 pb-4 pt-8">
        <input
          className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-[#f2f2f2] outline-none placeholder:text-[#6f6f6f]"
          type="text"
          value={query}
          placeholder="Search songs, albums, artists, playlists..."
          onChange={(e) => setQuery(e.target.value)}
        />

        {isSearching && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0d]">
            {results.length === 0 ? (
              <p className="px-5 py-5 text-sm text-[#8f8f8f]">
                No results for &ldquo;{query.trim()}&rdquo;
              </p>
            ) : (
              results.map((entry, idx) => (
                <button
                  key={entry.id}
                  type="button"
                  className={[
                    "flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.06]",
                    idx < results.length - 1 ? "border-b border-white/[0.05]" : "",
                  ].join(" ")}
                  onClick={entry.onSelect}
                >
                  <ArtworkTile
                    artworkKey={entry.artworkKey}
                    title={entry.label}
                    sizeClassName="h-11 w-11"
                    roundedClassName={entry.kind === "artist" ? "rounded-full" : "rounded-sm"}
                    fallbackClassName="bg-white/[0.04]"
                  />
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-[15px] font-medium text-[#f2f2f2]">
                      {entry.label}
                    </span>
                    {entry.sublabel && (
                      <span className="truncate text-[13px] text-[#a5a5a5]">
                        {entry.sublabel}
                      </span>
                    )}
                  </div>
                  {entry.meta && (
                    <span className="ml-auto shrink-0 text-[13px] text-[#6f6f6f]">
                      {entry.meta}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {!isSearching && (
        <div className="grid gap-8 px-8 pb-8 pt-2">
          {recentlyAdded.length > 0 && (
            <HorizontalRow label="jump back in">
              {recentlyAdded.map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onSelect={() =>
                    onTrackSelect(track, {
                      queueTrackIds: recentlyAdded.map((t) => t.id),
                      queueItems: recentlyAdded,
                      sourceLabel: "home-recently-added",
                    })
                  }
                />
              ))}
            </HorizontalRow>
          )}

          {playlistsState.items.length > 0 && (
            <HorizontalRow label="playlists">
              {playlistsState.items.map((pl) => (
                <PlaylistCard key={pl.id} playlist={pl} />
              ))}
            </HorizontalRow>
          )}

          {combinedAlbums.length > 0 && (
            <HorizontalRow label="albums">
              {combinedAlbums.map((entry) =>
                entry.kind === "album" ? (
                  <AlbumCard key={`album:${entry.item.id}`} album={entry.item} />
                ) : (
                  <ConceptAlbumCard key={`ca:${entry.item.id}`} ca={entry.item} />
                ),
              )}
            </HorizontalRow>
          )}
        </div>
      )}
    </div>
  );
}

function HorizontalRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <p className="m-0 text-[11px] tracking-[0.08em] text-[#a5a5a5] lowercase">{label}</p>
      <div className="-mx-8 flex gap-4 overflow-x-auto px-8 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </section>
  );
}

function TrackCard({ track, onSelect }: { track: TrackListItem; onSelect: () => void }) {
  return (
    <button type="button" aria-label={`Play ${track.title}`} className="group grid w-52 flex-none gap-2 text-left" onClick={onSelect}>
      <ArtworkTile
        artworkKey={track.artworkKey}
        title={track.title}
        sizeClassName="h-52 w-52"
        roundedClassName="rounded-md"
        fallbackClassName="bg-white/[0.04]"
      />
      <div className="grid gap-0.5 px-0.5">
        <span className="truncate text-sm font-medium text-[#f2f2f2] transition-colors group-hover:text-white">
          {track.title}
        </span>
        <span className="truncate text-xs text-[#8f8f8f]">
          {track.album ?? track.artist ?? "unknown"}
        </span>
      </div>
    </button>
  );
}

function AlbumCard({ album }: { album: AlbumSummary }) {
  return (
    <Link to={`/albums/${album.id}`} className="group grid w-52 flex-none gap-2">
      <ArtworkTile
        artworkKey={album.artworkKey}
        title={album.title}
        sizeClassName="h-52 w-52"
        roundedClassName="rounded-md"
        fallbackClassName="bg-white/[0.04]"
      />
      <div className="grid gap-0.5 px-0.5">
        <span className="truncate text-sm font-medium text-[#f2f2f2] transition-colors group-hover:text-white">
          {album.title}
        </span>
        <span className="text-xs text-[#8f8f8f]">{album.trackCount} tracks</span>
      </div>
    </Link>
  );
}

function PlaylistCard({ playlist }: { playlist: PlaylistSummary }) {
  return (
    <Link to={`/playlists/${playlist.id}`} className="group grid w-52 flex-none gap-2">
      <ArtworkTile
        artworkKey={playlist.artworkKey}
        title={playlist.name}
        sizeClassName="h-52 w-52"
        roundedClassName="rounded-md"
        fallbackClassName="bg-white/[0.04]"
      />
      <div className="grid gap-0.5 px-0.5">
        <span className="truncate text-sm font-medium text-[#f2f2f2] transition-colors group-hover:text-white">
          {playlist.name}
        </span>
        <span className="text-xs text-[#8f8f8f]">
          {playlist.isMixtape ? "mixtape" : "playlist"} · {playlist.entryCount} tracks
        </span>
      </div>
    </Link>
  );
}

function ConceptAlbumCard({ ca }: { ca: ConceptAlbumSummary }) {
  return (
    <Link to={`/concept-albums/${ca.id}`} className="group grid w-52 flex-none gap-2">
      <ArtworkTile
        artworkKey={ca.artworkKey}
        title={ca.title}
        sizeClassName="h-52 w-52"
        roundedClassName="rounded-md"
        fallbackClassName="bg-white/[0.04]"
      />
      <div className="grid gap-0.5 px-0.5">
        <span className="truncate text-sm font-medium text-[#f2f2f2] transition-colors group-hover:text-white">
          {ca.title}
        </span>
        <span className="text-xs text-[#8f8f8f]">{ca.entryCount} tracks</span>
      </div>
    </Link>
  );
}
