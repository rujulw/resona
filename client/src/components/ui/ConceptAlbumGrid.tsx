import { Link } from "react-router-dom";

import type { ConceptAlbumSummary } from "../../desktop";
import { formatDuration } from "../../utils/format";
import { ArtworkTile } from "./ArtworkTile";

type ConceptAlbumGridProps = {
  conceptAlbums: ConceptAlbumSummary[];
  activeConceptAlbumId: string | null;
};

export function ConceptAlbumGrid({
  conceptAlbums,
  activeConceptAlbumId,
}: ConceptAlbumGridProps) {
  return (
    <div className="grid gap-3">
      {conceptAlbums.map((conceptAlbum) => (
        <Link
          key={conceptAlbum.id}
          to={`/concept-albums/${conceptAlbum.id}`}
          className={[
            "grid gap-3 rounded-lg border px-4 py-4 transition-colors",
            conceptAlbum.id === activeConceptAlbumId
              ? "border-white/12 bg-white/8"
              : "border-white/6 bg-white/3 hover:border-white/10 hover:bg-white/5",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <ArtworkTile
              artworkKey={conceptAlbum.artworkKey}
              title={conceptAlbum.title}
              sizeClassName="h-14 w-14"
              roundedClassName="rounded-sm"
            />
            <div className="grid min-w-0 gap-1">
              <span className="truncate text-sm text-[#f2f2f2]">
                {conceptAlbum.title}
              </span>
              <span className="truncate text-xs text-[#8f8f8f]">
                {conceptAlbum.artist ?? "unknown artist"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-[#8f8f8f]">
            <span>
              {conceptAlbum.entryCount} track{conceptAlbum.entryCount === 1 ? "" : "s"}
            </span>
            <span>{formatUpdatedLabel(conceptAlbum.updatedAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function formatUpdatedLabel(updatedAt: string) {
  const value = Number(updatedAt);
  if (!Number.isFinite(value) || value <= 0) {
    return formatDuration(0);
  }

  const date = new Date(value * (updatedAt.length <= 10 ? 1000 : 1));
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
