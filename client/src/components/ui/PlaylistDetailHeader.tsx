import type { ReactNode } from "react";
import { ImagePlus, CassetteTape, Pencil, Play, Plus, Trash2 } from "lucide-react";

import type { PlaylistDetail } from "../../desktop";
import { ArtworkTile } from "./ArtworkTile";

export function PlaylistDetailHeader({
  playlist,
  onArtworkPick,
  onCreatePlaylist,
  onEditPlaylist,
  onDeletePlaylist,
  onPlayPlaylist,
  onTurnToMixtape,
}: {
  playlist: PlaylistDetail;
  onArtworkPick: () => void;
  onCreatePlaylist: () => void;
  onEditPlaylist: () => void;
  onDeletePlaylist: () => void;
  onPlayPlaylist: () => void;
  onTurnToMixtape: () => void;
}) {
  const title = playlist.playlist.name;

  return (
    <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-white/6 bg-[#181818] px-6 py-7">
      <div className="flex min-w-0 items-start gap-5">
        <button
          type="button"
          onClick={onArtworkPick}
          className="shrink-0 transition-opacity hover:opacity-90"
          aria-label="Choose playlist cover"
        >
          {playlist.playlist.artworkKey ? (
            <ArtworkTile
              artworkKey={playlist.playlist.artworkKey}
              title={title}
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
          <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">
            {playlist.playlist.isMixtape ? "mixtape" : "playlist"}
          </p>
          <h2 className="mt-4 truncate text-6xl font-medium tracking-[-0.06em] text-[#f2f2f2]">
            {title}
          </h2>
          <p className="mt-4 text-sm text-[#8f8f8f]">
            {playlist.playlist.entryCount} saved track
            {playlist.playlist.entryCount === 1 ? "" : "s"}
          </p>
          {playlist.playlist.description ? (
            <p className="mt-2 max-w-2xl text-sm text-[#a5a5a5]">
              {playlist.playlist.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!playlist.playlist.isMixtape ? (
          <IconActionButton
            label="Create playlist"
            onClick={onCreatePlaylist}
            icon={<Plus className="h-4 w-4" strokeWidth={2} />}
          />
        ) : null}
        {playlist.entries.length > 0 ? (
          <IconActionButton
            label="Play playlist"
            onClick={onPlayPlaylist}
            icon={<Play className="h-4 w-4" strokeWidth={2} />}
          />
        ) : null}
        <IconActionButton
          label="Edit playlist"
          onClick={onEditPlaylist}
          icon={<Pencil className="h-4 w-4" strokeWidth={2} />}
        />
        {!playlist.playlist.isMixtape ? (
          <IconActionButton
            label="Turn to mixtape"
            onClick={onTurnToMixtape}
            icon={<CassetteTape className="h-4 w-4" strokeWidth={2} />}
          />
        ) : null}
        <IconActionButton
          label="Delete playlist"
          onClick={onDeletePlaylist}
          icon={<Trash2 className="h-4 w-4" strokeWidth={2} />}
        />
      </div>
    </header>
  );
}

function IconActionButton({
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
