import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import type { TrackListItem } from "../desktop";
import type { PlaylistsState, TracksState } from "../types/app";
import { ArtworkTile } from "../components/ui/ArtworkTile";
import { formatDuration } from "../utils/format";

export function PlaylistsPage({
  playlistsState,
  tracksState,
  onCreatePlaylist,
  onPlaylistDelete,
  onPlaylistRename,
  onPlaylistSelect,
  onTrackAdd,
}: {
  playlistsState: PlaylistsState;
  tracksState: TracksState;
  onCreatePlaylist: (name: string) => Promise<string | null>;
  onPlaylistDelete: (playlistId: string) => void;
  onPlaylistRename: (playlistId: string, name: string, description?: string | null) => void;
  onPlaylistSelect: (playlistId: string) => void;
  onTrackAdd: (playlistId: string, track: TrackListItem) => void;
}) {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const activePlaylistId = playlistId ?? playlistsState.activePlaylistId;
  const activePlaylist = playlistsState.activePlaylist;
  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");

  useEffect(() => {
    if (
      playlistId &&
      playlistId !== playlistsState.activePlaylist?.playlist.id &&
      playlistsState.status !== "loading"
    ) {
      onPlaylistSelect(playlistId);
    }
  }, [
    onPlaylistSelect,
    playlistId,
    playlistsState.activePlaylist?.playlist.id,
    playlistsState.status,
  ]);

  useEffect(() => {
    setNameDraft(activePlaylist?.playlist.name ?? "");
    setDescriptionDraft(activePlaylist?.playlist.description ?? "");
  }, [activePlaylist?.playlist.description, activePlaylist?.playlist.name]);

  if (!playlistId && playlistsState.items[0]) {
    return <Navigate to={`/playlists/${playlistsState.items[0].id}`} replace />;
  }

  if (!activePlaylistId) {
    return (
      <section className="grid h-full place-items-center px-6 py-8">
        <div className="grid gap-4 rounded-4xl border border-white/6 bg-[#171717] px-8 py-10 text-center">
          <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">playlists</p>
          <h2 className="m-0 text-3xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
            no playlists yet
          </h2>
          <button
            type="button"
            onClick={() => {
              const name = window.prompt("Name your playlist");
              if (name?.trim()) {
                void onCreatePlaylist(name.trim()).then((createdPlaylistId) => {
                  if (createdPlaylistId) {
                    navigate(`/playlists/${createdPlaylistId}`);
                  }
                });
              }
            }}
            className="justify-self-center rounded-2xl border border-white/10 bg-white/3 px-4 py-3 text-sm text-[#f2f2f2] transition-colors hover:border-white/15 hover:bg-white/5"
          >
            Create playlist
          </button>
        </div>
      </section>
    );
  }

  if (playlistsState.status === "loading" && !activePlaylist) {
    return (
      <section className="grid h-full place-items-center px-6 py-8">
        <p className="m-0 text-sm text-[#8f8f8f]">Loading playlist...</p>
      </section>
    );
  }

  if (!activePlaylist) {
    return (
      <section className="grid h-full place-items-center px-6 py-8">
        <div className="grid gap-2 text-center">
          <h2 className="m-0 text-2xl font-medium text-[#f2f2f2]">playlist unavailable</h2>
          <p className="m-0 text-sm text-[#8f8f8f]">
            {playlistsState.message ?? "The selected playlist could not be loaded."}
          </p>
        </div>
      </section>
    );
  }

  const title = activePlaylist.playlist.name;

  return (
    <div className="grid gap-6 px-6 py-6">
      <header className="grid gap-5 rounded-4xl border border-white/6 bg-[linear-gradient(145deg,#241e17_0%,#171717_62%,#121212_100%)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">playlist</p>
            <h2 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
              {title}
            </h2>
            <p className="mt-2 text-sm text-[#a69b8e]">
              {activePlaylist.playlist.entryCount} saved track
              {activePlaylist.playlist.entryCount === 1 ? "" : "s"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete ${title}?`)) {
                navigate("/playlists");
                onPlaylistDelete(activePlaylist.playlist.id);
              }
            }}
            className="rounded-full border border-[#7d3b37]/50 bg-[#7d3b37]/12 px-4 py-2 text-sm text-[#f0b9b3] transition-colors hover:border-[#7d3b37]/70 hover:bg-[#7d3b37]/18"
          >
            Delete playlist
          </button>
        </div>

        <form
          className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!nameDraft.trim()) {
              return;
            }

            onPlaylistRename(
              activePlaylist.playlist.id,
              nameDraft.trim(),
              descriptionDraft.trim() || null,
            );
          }}
        >
          <label className="grid gap-2 text-sm text-[#d7d7d7]">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[#8f8f8f]">name</span>
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-[#f2f2f2] outline-none transition-colors focus:border-[#d1ab67]/45"
            />
          </label>
          <label className="grid gap-2 text-sm text-[#d7d7d7]">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[#8f8f8f]">
              description
            </span>
            <input
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              placeholder="Optional note"
              className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-[#f2f2f2] outline-none transition-colors focus:border-[#d1ab67]/45"
            />
          </label>
          <button
            type="submit"
            className="self-end rounded-2xl border border-[#d1ab67]/40 bg-[#d1ab67]/14 px-4 py-3 text-sm text-[#f5ddb0] transition-colors hover:border-[#d1ab67]/60 hover:bg-[#d1ab67]/20"
          >
            Save details
          </button>
        </form>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[28px] border border-white/6 bg-[#171717] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">saved order</p>
              <h3 className="mt-2 text-lg font-medium text-[#f2f2f2]">playlist entries</h3>
            </div>
            <p className="m-0 text-sm text-[#8f8f8f]">
              {activePlaylist.entries.length} total
            </p>
          </div>

          {activePlaylist.entries.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {activePlaylist.entries.map((entry) => (
                <article
                  key={entry.entryId}
                  className="grid grid-cols-[56px_minmax(0,1fr)_68px] items-center gap-4 rounded-3xl border border-white/6 bg-white/3 px-4 py-4"
                >
                  <ArtworkTile
                    artworkKey={entry.artworkKey}
                    title={entry.title}
                    sizeClassName="h-14 w-14"
                    roundedClassName="rounded-2xl"
                  />
                  <div className="grid min-w-0 gap-1">
                    <span className="truncate text-sm text-[#f2f2f2]">{entry.title}</span>
                    <span className="truncate text-xs text-[#8f8f8f]">
                      {[entry.artist ?? "unknown artist", entry.album ?? "unknown album"].join(" • ")}
                    </span>
                  </div>
                  <span className="text-right text-sm text-[#8f8f8f]">
                    {entry.durationSeconds != null
                      ? formatDuration(Math.round(entry.durationSeconds))
                      : "--:--"}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-dashed border-white/8 bg-white/2 px-5 py-8">
              <p className="m-0 text-sm text-[#8f8f8f]">
                This playlist is empty. Use the library panel to start adding tracks.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-white/6 bg-[#171717] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">library handoff</p>
              <h3 className="mt-2 text-lg font-medium text-[#f2f2f2]">
                add from indexed tracks
              </h3>
            </div>
            <p className="m-0 max-w-xs text-right text-xs leading-5 text-[#8f8f8f]">
              The first playlist pass keeps add flows simple: append from the local library, then refine playback handoff next.
            </p>
          </div>

          {tracksState.status === "loading" ? (
            <div className="mt-4 rounded-3xl border border-white/6 bg-white/3 px-4 py-6 text-sm text-[#8f8f8f]">
              Loading indexed tracks...
            </div>
          ) : tracksState.items.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-white/6 bg-white/3 px-4 py-6 text-sm text-[#8f8f8f]">
              Scan a local music folder before adding tracks to playlists.
            </div>
          ) : (
            <div className="mt-4 grid max-h-140 gap-2 overflow-y-auto pr-1">
              {tracksState.items.map((track) => {
                const duplicateCount = activePlaylist.entries.filter(
                  (entry) => entry.trackId === track.id,
                ).length;

                return (
                  <div
                    key={track.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-3xl border border-white/6 bg-white/3 px-4 py-4"
                  >
                    <div className="grid min-w-0 gap-1">
                      <span className="truncate text-sm text-[#f2f2f2]">{track.title}</span>
                      <span className="truncate text-xs text-[#8f8f8f]">
                        {[track.artist ?? "unknown artist", track.album ?? "unknown album"].join(" • ")}
                      </span>
                      {duplicateCount > 0 ? (
                        <span className="text-[11px] uppercase tracking-[0.12em] text-[#c8a869]">
                          already added {duplicateCount}x
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onTrackAdd(activePlaylist.playlist.id, track)}
                      className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-[#f2f2f2] transition-colors hover:border-[#d1ab67]/40 hover:bg-[#d1ab67]/12 hover:text-[#f5ddb0]"
                    >
                      Add
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
