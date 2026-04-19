import { Link } from "react-router-dom";

import type { AlbumSummary } from "../../desktop";
import { formatDuration } from "../../utils/format";
import { ArtworkTile } from "./ArtworkTile";

export function AlbumGrid({
  albums,
  activeAlbumId,
}: {
  albums: AlbumSummary[];
  activeAlbumId: string | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {albums.map((album) => (
        <Link
          key={album.id}
          to={`/albums/${album.id}`}
          className={[
            "grid gap-3 rounded-lg border px-4 py-4 transition-colors",
            album.id === activeAlbumId
              ? "border-white/12 bg-white/8"
              : "border-white/6 bg-white/3 hover:border-white/10 hover:bg-white/5",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <ArtworkTile
              artworkKey={album.artworkKey}
              title={album.title}
              sizeClassName="h-14 w-14"
              roundedClassName="rounded-sm"
            />
            <div className="grid min-w-0 gap-1">
              <span className="truncate text-sm text-[#f2f2f2]">{album.title}</span>
              <span className="truncate text-xs text-[#8f8f8f]">
                {album.artist ?? "unknown artist"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-[#8f8f8f]">
            <span>
              {album.trackCount} track{album.trackCount === 1 ? "" : "s"}
            </span>
            <span>
              {album.totalDurationSeconds
                ? formatDuration(Math.round(album.totalDurationSeconds))
                : "--:--"}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
