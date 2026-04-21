import { Home, ListMusic, ListOrdered, Plus, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { primaryRoutes } from "../../constants/routes";
import type { ConceptAlbumSummary, PlaylistSummary } from "../../desktop";
import { ArtworkTile } from "../ui/ArtworkTile";

const routeIcons = {
  home: Home,
  tracks: ListMusic,
  queue: ListOrdered,
  settings: Settings2,
} as const;

type SidebarProps = {
  appName: string;
  conceptAlbums: ConceptAlbumSummary[];
  playlists: PlaylistSummary[];
  runtimeLabel: string;
};

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getCollectionLink(type: "playlist" | "concept-album", id: string) {
  return type === "playlist" ? `/playlists/${id}` : `/concept-albums/${id}`;
}

function CollectionArtwork({
  artworkKey,
  title,
}: {
  artworkKey: string | null | undefined;
  title: string;
}) {
  if (!artworkKey) {
    return (
      <div
        className="h-10 w-10 shrink-0 rounded-sm bg-white/[0.07] ring-1 ring-white/8"
        aria-hidden="true"
      />
    );
  }

  return (
    <ArtworkTile
      artworkKey={artworkKey}
      title={title}
      sizeClassName="h-10 w-10 shrink-0"
      roundedClassName="rounded-sm"
      fallbackClassName="bg-white/[0.07]"
    />
  );
}

function FadeDivider() {
  return (
    <div
      aria-hidden="true"
      className="h-px w-full bg-linear-to-r from-transparent via-white/20 to-transparent"
    />
  );
}

export function Sidebar({ conceptAlbums, playlists }: SidebarProps) {
  const navigate = useNavigate();
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isCreateMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        createMenuRef.current &&
        event.target instanceof Node &&
        !createMenuRef.current.contains(event.target)
      ) {
        setIsCreateMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsCreateMenuOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isCreateMenuOpen]);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-white/5 bg-black">
      
      {/* HEADER */}
      <div className="px-6 py-4">
        <h1 className="m-0 text-[1.75rem] font-medium tracking-[-0.04em] text-white">
          resona
        </h1>
      </div>

      <FadeDivider />

      {/* NAV */}
      <nav className="px-3 py-6" aria-label="primary routes">
        <div className="flex flex-col gap-1">
          {primaryRoutes.map((item) => {
            const Icon = routeIcons[item.icon];
            return (
              <NavLink key={item.path} to={item.path}>
                {({ isActive }) => (
                  <div
                    className={[
                      "rounded-sm px-3 py-2.5 transition-all",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={[
                          "h-4.5 w-4.5",
                          isActive ? "text-white" : "text-neutral-400",
                        ].join(" ")}
                        strokeWidth={1.75}
                      />
                      <span className="text-sm tracking-wide">
                        {toTitleCase(item.label)}
                      </span>
                    </div>
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <FadeDivider />

      {/* LIBRARY */}
      <div className="flex min-h-0 flex-1 flex-col px-3 py-6">
        
        {/* Library header */}
        <div className="mb-4 flex items-center justify-between px-3">
          <div className="text-sm text-neutral-500">Library</div>

          <div className="relative" ref={createMenuRef}>
            <button
              type="button"
              onClick={() => setIsCreateMenuOpen((v) => !v)}
              className="group flex h-7 w-7 items-center justify-center rounded-sm bg-white/5 transition-all hover:bg-white/10"
            >
              <Plus className="h-4 w-4 text-neutral-400 group-hover:text-white" />
            </button>

            {isCreateMenuOpen && (
              <div className="absolute right-0 top-10 z-20 min-w-47.5 rounded-sm border border-white/10 bg-neutral-900 p-1.5 shadow-2xl">
                <button
                  onClick={() => {
                    setIsCreateMenuOpen(false);
                    navigate("/playlists?create=playlist");
                  }}
                  className="flex w-full rounded-sm px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/10 hover:text-white"
                >
                  Playlist
                </button>
                <button
                  onClick={() => {
                    setIsCreateMenuOpen(false);
                    navigate("/concept-albums?create=concept-album");
                  }}
                  className="flex w-full rounded-sm px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/10 hover:text-white"
                >
                  Concept Album
                </button>
              </div>
            )}
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            {playlists.map((playlist) => (
              <NavLink
                key={playlist.id}
                to={getCollectionLink("playlist", playlist.id)}
                className={({ isActive }) =>
                  [
                    "group rounded-sm px-3 py-2.5 transition-all",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-neutral-300 hover:bg-white/5 hover:text-white",
                  ].join(" ")
                }
              >
                <div className="flex items-center gap-3">
                  <CollectionArtwork artworkKey={playlist.artworkKey} title={playlist.name} />
                  <div className="min-w-0">
                    <div className="truncate text-sm tracking-wide">{playlist.name}</div>
                    <div className="mt-0.5 text-xs text-neutral-600">playlist</div>
                  </div>
                </div>
              </NavLink>
            ))}

            {conceptAlbums.map((conceptAlbum) => (
              <NavLink
                key={conceptAlbum.id}
                to={getCollectionLink("concept-album", conceptAlbum.id)}
                className={({ isActive }) =>
                  [
                    "group rounded-sm px-3 py-2.5 transition-all",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-neutral-300 hover:bg-white/5 hover:text-white",
                  ].join(" ")
                }
              >
                <div className="flex items-center gap-3">
                  <CollectionArtwork artworkKey={conceptAlbum.artworkKey} title={conceptAlbum.title} />
                  <div className="min-w-0">
                    <div className="truncate text-sm tracking-wide">{conceptAlbum.title}</div>
                    <div className="mt-0.5 text-xs text-neutral-600">concept album</div>
                  </div>
                </div>
              </NavLink>
            ))}

            {playlists.length === 0 && conceptAlbums.length === 0 && (
              <div className="px-3 py-2 text-sm text-neutral-600">
                No collections yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}