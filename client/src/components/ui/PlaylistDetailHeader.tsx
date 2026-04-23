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
    <header className="flex flex-wrap items-end justify-between gap-6 px-8 pb-4 pt-10 bg-gradient-to-b from-white/[0.07] to-transparent">
      <div className="flex min-w-0 items-end gap-6">
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
              sizeClassName="h-52 w-52 shadow-2xl shadow-black/40"
              roundedClassName="rounded-md"
              fallbackClassName="bg-white/[0.04]"
            />
          ) : (
            <div className="grid h-52 w-52 place-items-center rounded-md border border-white/8 bg-white/4 text-[#8f8f8f] shadow-2xl shadow-black/40">
              <ImagePlus className="h-12 w-12" strokeWidth={1.5} />
            </div>
          )}
        </button>

        <div className="min-w-0 pb-1">
          <p className="m-0 text-[11px] tracking-[0.08em] text-[#f2f2f2]/80">
            {playlist.playlist.isMixtape ? "mixtape" : "playlist"}
          </p>
          <h2 className="mt-2 text-7xl font-bold tracking-[-0.04em] text-white text-wrap break-words">
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

      <div className="flex flex-wrap items-center gap-3">
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
            variant="primary"
            icon={<Play className="h-6 w-6 ml-1" fill="currentColor" strokeWidth={0} />}
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
  variant = "secondary",
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex items-center justify-center transition-all ${
        isPrimary
          ? "h-14 w-14 rounded-full bg-white text-black hover:bg-white/90"
          : "h-11 w-11 rounded-xl border border-white/8 bg-white/3 text-[#d4d4d4] hover:border-white/12 hover:bg-white/5 hover:text-[#f2f2f2]"
      }`}
    >
      {icon}
    </button>
  );
}
