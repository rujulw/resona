import { convertFileSrc } from "@tauri-apps/api/core";
import { Play } from "lucide-react";
import { Link } from "react-router-dom";

import type { ArtistDetail, ArtistPlaylistItem, DiscographyAlbum } from "../../desktop";
import { ArtworkTile } from "./ArtworkTile";

export function ArtistDetailPanel({
  artistDetail,
  onPlayAlbum,
}: {
  artistDetail: ArtistDetail | null;
  onPlayAlbum?: (albumId: string) => Promise<void>;
}) {
  if (!artistDetail) {
    return (
      <section className="grid min-h-[320px] place-items-center rounded-lg border border-white/6 bg-[#1b1b1b] px-5 py-6">
        <div className="grid gap-2 text-center">
          <h2 className="m-0 text-xl font-medium text-[#f2f2f2]">Select an artist</h2>
          <p className="m-0 text-sm text-[#8f8f8f]">
            Navigate to an artist to load their profile and discography.
          </p>
        </div>
      </section>
    );
  }

  const imageUrl = artistDetail.imageConfig
    ? convertFileSrc(artistDetail.imageConfig.localImagePath)
    : null;

  const { albums } = artistDetail;

  function handlePlay() {
    if (!onPlayAlbum || albums.length === 0) return;
    const pick = albums[Math.floor(Math.random() * albums.length)];
    void onPlayAlbum(pick.id);
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-black">
      <header className="relative bg-black overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={artistDetail.name}
            className="w-full h-[420px] object-cover object-center block"
          />
        ) : (
          <div className="w-full h-[420px] bg-gradient-to-b from-[#1c1c1c] to-black" />
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to top, #000 0%, #000 18%, rgba(0,0,0,0.4) 50%, transparent 80%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 px-8 pb-7">
          <div>
            <p className="m-0 text-[11px] tracking-[0.08em] text-[#f2f2f2]/70 lowercase">artist</p>
            <h2 className="mt-1 text-7xl font-bold tracking-[-0.04em] text-white break-words drop-shadow-lg">
              {artistDetail.name}
            </h2>
          </div>
          {albums.length > 0 && onPlayAlbum ? (
            <div className="shrink-0 pb-1">
              <button
                type="button"
                aria-label={`Play ${artistDetail.name}`}
                onClick={handlePlay}
                className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-all"
              >
                <Play className="h-6 w-6 ml-1" fill="currentColor" strokeWidth={0} />
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="grid gap-8 px-12 pb-8 pt-3">
        {albums.length > 0 && (
          <HorizontalRow label="discography">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </HorizontalRow>
        )}

        {artistDetail.features.length > 0 && (
          <HorizontalRow label="featured on">
            {artistDetail.features.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </HorizontalRow>
        )}

        {artistDetail.playlists.length > 0 && (
          <HorizontalRow label="appears on">
            {artistDetail.playlists.map((pl) => (
              <PlaylistCard key={pl.id} playlist={pl} />
            ))}
          </HorizontalRow>
        )}

        {albums.length === 0 && artistDetail.features.length === 0 && artistDetail.playlists.length === 0 && (
          <p className="text-sm text-[#8f8f8f]">No music found.</p>
        )}
      </div>
    </div>
  );
}

function HorizontalRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <p className="m-0 text-[11px] tracking-[0.08em] text-[#a5a5a5] lowercase">{label}</p>
      <div className="flex gap-4 overflow-x-auto pb-1 -mx-8 px-8 [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </section>
  );
}

function AlbumCard({ album }: { album: DiscographyAlbum }) {
  const to = album.kind === "concept_album" ? `/concept-albums/${album.id}` : `/albums/${album.id}`;
  return (
    <Link to={to} className="group flex-none w-52 grid gap-2">
      <ArtworkTile
        artworkKey={album.artworkKey}
        title={album.title || "Unknown Album"}
        sizeClassName="w-52 h-52"
        roundedClassName="rounded-md"
        fallbackClassName="bg-white/[0.04]"
      />
      <div className="grid gap-0.5 px-0.5">
        <span className="truncate text-sm font-medium text-[#f2f2f2] group-hover:text-white transition-colors">
          {album.title || "Unknown Album"}
        </span>
        <span className="text-xs text-[#8f8f8f]">
          {album.year ?? (album.kind === "concept_album" ? "concept album" : "")}
        </span>
      </div>
    </Link>
  );
}

function PlaylistCard({ playlist }: { playlist: ArtistPlaylistItem }) {
  return (
    <Link to={`/playlists/${playlist.id}`} className="group flex-none w-52 grid gap-2">
      <ArtworkTile
        artworkKey={playlist.artworkKey}
        title={playlist.title}
        sizeClassName="w-52 h-52"
        roundedClassName="rounded-md"
        fallbackClassName="bg-white/[0.04]"
      />
      <div className="px-0.5">
        <span className="truncate text-sm font-medium text-[#f2f2f2] group-hover:text-white transition-colors block">
          {playlist.title}
        </span>
      </div>
    </Link>
  );
}
