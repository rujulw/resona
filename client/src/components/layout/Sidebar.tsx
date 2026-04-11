import { FolderHeart, Home, ListMusic, ListOrdered, Settings2 } from "lucide-react";
import { NavLink } from "react-router-dom";

import { primaryRoutes } from "../../constants/routes";
import type { PlaylistSummary } from "../../desktop";

const routeIcons = {
  home: Home,
  tracks: ListMusic,
  playlists: FolderHeart,
  queue: ListOrdered,
  settings: Settings2,
} as const;

export function Sidebar({
  appName,
  playlists,
  runtimeLabel,
}: {
  appName: string;
  playlists: PlaylistSummary[];
  runtimeLabel: string;
}) {
  return (
    <aside className="grid content-start gap-6 overflow-y-auto border-r border-white/6 bg-[#171717] px-4 py-5">
      <div className="grid gap-1">
        <h1 className="m-0 text-3xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
          {appName}
        </h1>
        <p className="m-0 text-sm text-[#8f8f8f]">{runtimeLabel}</p>
      </div>

      <section className="grid gap-3">
        <nav className="grid gap-1.5" aria-label="primary routes">
          {primaryRoutes.map((item) => {
            const Icon = routeIcons[item.icon];

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  [
                    "rounded-xl border px-3 py-3 transition-colors",
                    isActive
                      ? "border-white/10 bg-[#272727] text-[#f2f2f2]"
                      : "border-transparent bg-white/[0.03] text-[#d4d4d4] hover:border-white/8 hover:bg-white/[0.05] hover:text-[#f2f2f2]",
                  ].join(" ")
                }
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-[#8f8f8f]" strokeWidth={2} />
                  <span className="block text-sm">{item.label}</span>
                </span>
                <span className="mt-1 block pl-7 text-xs text-[#8f8f8f]">{item.caption}</span>
              </NavLink>
            );
          })}
        </nav>
      </section>

      <div
        aria-hidden="true"
        className="h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.06)_12%,rgba(255,255,255,0.18)_50%,rgba(255,255,255,0.06)_88%,transparent)]"
      />

      <section className="grid gap-3">
        {playlists.length > 0 ? (
          <nav className="grid gap-1.5" aria-label="playlists">
            {playlists.map((playlist) => (
              <NavLink
                key={playlist.id}
                to={`/playlists/${playlist.id}`}
                className={({ isActive }) =>
                  [
                    "rounded-xl border px-3 py-3 transition-colors",
                    isActive
                      ? "border-white/10 bg-[#272727] text-[#f2f2f2]"
                      : "border-transparent bg-white/[0.03] text-[#d4d4d4] hover:border-white/8 hover:bg-white/[0.05] hover:text-[#f2f2f2]",
                  ].join(" ")
                }
              >
                <span className="block truncate text-sm">{playlist.name}</span>
                <span className="mt-1 block text-xs text-[#8f8f8f]">
                  {playlist.entryCount} track{playlist.entryCount === 1 ? "" : "s"}
                </span>
              </NavLink>
            ))}
          </nav>
        ) : null}
      </section>
    </aside>
  );
}
