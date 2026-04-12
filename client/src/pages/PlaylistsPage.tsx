import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Play, Plus, Trash2 } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { pickPlaylistArtwork, type TrackListItem } from "../desktop";
import type { PlaylistsState, TracksState } from "../types/app";
import { ArtworkTile } from "../components/ui/ArtworkTile";
import { CreatePlaylistDialog } from "../components/ui/CreatePlaylistDialog";
import { formatDuration } from "../utils/format";

export function PlaylistsPage({
  playlistsState,
  tracksState,
  onCreatePlaylist,
  onPlaylistArtworkChange,
  onPlaylistDelete,
  onPlaylistEntryMove,
  onPlaylistEntryRemove,
  onPlaylistPlaybackHandoff,
  onPlaylistRename: _onPlaylistRename,
  onPlaylistSelect,
  onTrackAdd,
}: {
  playlistsState: PlaylistsState;
  tracksState: TracksState;
  onCreatePlaylist: (name: string, artworkPath?: string | null) => Promise<string | null>;
  onPlaylistArtworkChange: (playlistId: string, artworkPath: string) => void;
  onPlaylistDelete: (playlistId: string) => void;
  onPlaylistEntryMove: (playlistId: string, entryId: string, targetPosition: number) => void;
  onPlaylistEntryRemove: (playlistId: string, entryId: string) => void;
  onPlaylistPlaybackHandoff: (playlistId: string, startEntryId?: string) => void;
  onPlaylistRename: (playlistId: string, name: string, description?: string | null) => void;
  onPlaylistSelect: (playlistId: string) => void;
  onTrackAdd: (playlistId: string, track: TrackListItem) => void;
}) {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const activePlaylistId = playlistId ?? playlistsState.activePlaylistId;
  const activePlaylist = playlistsState.activePlaylist;
  const [createDraft, setCreateDraft] = useState("");
  const [createArtworkPath, setCreateArtworkPath] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [librarySearchDraft, setLibrarySearchDraft] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

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
    if (!selectedEntryId) {
      return;
    }

    if (activePlaylist?.entries.some((entry) => entry.entryId === selectedEntryId)) {
      return;
    }

    setSelectedEntryId(null);
  }, [activePlaylist, selectedEntryId]);

  const openCreateDialog = () => {
    setIsCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    setCreateDraft("");
    setCreateArtworkPath(null);
    setIsCreateDialogOpen(false);
    setIsCreatingPlaylist(false);
  };

  const handleCreateSubmit = () => {
    const nextName = createDraft.trim();
    if (!nextName || isCreatingPlaylist) {
      return;
    }

    setIsCreatingPlaylist(true);
    void onCreatePlaylist(nextName, createArtworkPath).then((createdPlaylistId) => {
      setIsCreatingPlaylist(false);
      if (createdPlaylistId) {
        closeCreateDialog();
        navigate(`/playlists/${createdPlaylistId}`);
      }
    });
  };

  if (!playlistId && playlistsState.items[0]) {
    return <Navigate to={`/playlists/${playlistsState.items[0].id}`} replace />;
  }

  if (!activePlaylistId) {
    return (
      <>
        <section className="grid h-full place-items-center px-6 py-8">
          <div className="grid gap-4 text-center">
            <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">playlists</p>
            <h2 className="m-0 text-4xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
              no playlists yet
            </h2>
            <p className="m-0 text-sm text-[#8f8f8f]">
              Create the first playlist to start saving an order outside the library table.
            </p>
            <button
              type="button"
              onClick={openCreateDialog}
              className="justify-self-center rounded-xl border border-white/10 bg-[#272727] px-4 py-2.5 text-sm text-[#f2f2f2] transition-colors hover:border-white/14 hover:bg-[#303030]"
            >
              Create playlist
            </button>
          </div>
        </section>

        <CreatePlaylistDialog
          isOpen={isCreateDialogOpen}
          isSubmitting={isCreatingPlaylist}
          nameDraft={createDraft}
          selectedArtworkPath={createArtworkPath}
          onClose={closeCreateDialog}
          onNameDraftChange={setCreateDraft}
          onSelectedArtworkPathChange={setCreateArtworkPath}
          onSubmit={handleCreateSubmit}
        />
      </>
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
  const normalizedLibrarySearch = librarySearchDraft.trim().toLowerCase();
  const visibleLibraryTracks = tracksState.items.filter((track) => {
    if (!normalizedLibrarySearch) {
      return true;
    }

    return [track.title, track.artist, track.album]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedLibrarySearch));
  });

  return (
    <>
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-5 overflow-hidden px-6 py-5">
        <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-white/6 bg-[#181818] px-6 py-7">
          <div className="flex min-w-0 items-start gap-5">
            <button
              type="button"
              onClick={() => {
                void pickPlaylistArtwork().then((artworkPath) => {
                  if (artworkPath) {
                    onPlaylistArtworkChange(activePlaylist.playlist.id, artworkPath);
                  }
                });
              }}
              className="shrink-0 transition-opacity hover:opacity-90"
              aria-label="Choose playlist cover"
            >
              {activePlaylist.playlist.artworkKey ? (
                <ArtworkTile
                  artworkKey={activePlaylist.playlist.artworkKey}
                  title={title}
                  sizeClassName="h-36 w-36"
                  roundedClassName="rounded-sm"
                  fallbackClassName="bg-white/[0.04]"
                />
              ) : (
                <div className="grid h-36 w-36 place-items-center rounded-sm border border-white/8 bg-white/[0.04] text-[#8f8f8f]">
                  <ImagePlus className="h-10 w-10" strokeWidth={1.75} />
                </div>
              )}
            </button>

            <div className="min-w-0 pt-1">
              <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">playlist</p>
              <h2 className="mt-4 truncate text-6xl font-medium tracking-[-0.06em] text-[#f2f2f2]">
                {title}
              </h2>
              <p className="mt-4 text-sm text-[#8f8f8f]">
                {activePlaylist.playlist.entryCount} saved track
                {activePlaylist.playlist.entryCount === 1 ? "" : "s"}
              </p>
              {activePlaylist.playlist.description ? (
                <p className="mt-2 max-w-2xl text-sm text-[#a5a5a5]">
                  {activePlaylist.playlist.description}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCreateDialog}
              aria-label="Create playlist"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/[0.05] hover:text-[#f2f2f2]"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
            </button>
            {activePlaylist.entries.length > 0 ? (
              <button
                type="button"
                onClick={() => onPlaylistPlaybackHandoff(activePlaylist.playlist.id)}
                aria-label="Play playlist"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/[0.05] hover:text-[#f2f2f2]"
              >
                <Play className="h-4 w-4" strokeWidth={2} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete ${title}?`)) {
                  navigate("/playlists");
                  onPlaylistDelete(activePlaylist.playlist.id);
                }
              }}
              aria-label="Delete playlist"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/[0.05] hover:text-[#f2f2f2]"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 gap-4 overflow-y-auto pb-2">
          <section className="grid min-h-[62vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-white/6 bg-[#1b1b1b]">
            <div className="grid grid-cols-[minmax(320px,2fr)_minmax(180px,1.1fr)_96px_112px] gap-4 border-b border-white/6 px-5 py-3 text-[11px] tracking-[0.08em] text-[#8f8f8f]">
              <span>saved order</span>
              <span>album</span>
              <span>duration</span>
              <span>actions</span>
            </div>

            <div
              className="min-h-0 overflow-y-auto"
              tabIndex={0}
              onKeyDown={(event) => {
                if (
                  (event.key === "Backspace" || event.key === "Delete") &&
                  selectedEntryId
                ) {
                  event.preventDefault();
                  onPlaylistEntryRemove(activePlaylist.playlist.id, selectedEntryId);
                }
              }}
            >
              {activePlaylist.entries.length === 0 ? (
                <div className="grid gap-2 px-5 py-8">
                  <p className="m-0 text-sm text-[#e5e5e5]">No tracks saved yet.</p>
                  <p className="m-0 text-sm text-[#8f8f8f]">
                    Use the library handoff list below to start building the playlist order.
                  </p>
                </div>
              ) : (
                activePlaylist.entries.map((entry) => (
                  <article
                    key={entry.entryId}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select ${entry.title}`}
                    aria-pressed={selectedEntryId === entry.entryId}
                    onClick={() => setSelectedEntryId(entry.entryId)}
                    onDoubleClick={() =>
                      onPlaylistPlaybackHandoff(activePlaylist.playlist.id, entry.entryId)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedEntryId(entry.entryId);
                        return;
                      }

                      if (event.key === "Backspace" || event.key === "Delete") {
                        event.preventDefault();
                        onPlaylistEntryRemove(activePlaylist.playlist.id, entry.entryId);
                      }
                    }}
                    className={[
                      "grid w-full grid-cols-[minmax(320px,2fr)_minmax(180px,1.1fr)_96px_112px] items-center gap-4 border-b border-white/5 px-5 py-3.5 text-left last:border-b-0",
                      selectedEntryId === entry.entryId ? "bg-white/8" : "hover:bg-white/3",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ArtworkTile
                        artworkKey={entry.artworkKey}
                        title={entry.title}
                        sizeClassName="h-11 w-11"
                        roundedClassName="rounded-sm"
                        fallbackClassName="bg-white/[0.04]"
                      />
                      <div className="grid min-w-0 gap-1">
                        <span className="truncate text-sm text-[#f2f2f2]">{entry.title}</span>
                        <span className="truncate text-xs text-[#8f8f8f]">
                          {entry.artist ?? "unknown artist"}
                        </span>
                      </div>
                    </div>

                    <span className="truncate text-sm text-[#d4d4d4]">
                      {entry.album ?? "unknown album"}
                    </span>

                    <span className="text-sm text-[#8f8f8f]">
                      {entry.durationSeconds != null
                        ? formatDuration(Math.round(entry.durationSeconds))
                        : "--:--"}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Play ${entry.title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedEntryId(entry.entryId);
                          onPlaylistPlaybackHandoff(activePlaylist.playlist.id, entry.entryId);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/[0.05] hover:text-[#f2f2f2]"
                      >
                        <Play className="h-4 w-4" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${entry.title} up`}
                        disabled={entry.position === 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedEntryId(entry.entryId);
                          onPlaylistEntryMove(
                            activePlaylist.playlist.id,
                            entry.entryId,
                            entry.position - 1,
                          );
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/[0.05] hover:text-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <ArrowUp className="h-4 w-4" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${entry.title} down`}
                        disabled={entry.position === activePlaylist.entries.length - 1}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedEntryId(entry.entryId);
                          onPlaylistEntryMove(
                            activePlaylist.playlist.id,
                            entry.entryId,
                            entry.position + 1,
                          );
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/[0.05] hover:text-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <ArrowDown className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="grid min-h-[44vh] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-white/6 bg-[#1b1b1b]">
            <label className="block min-w-0 border-b border-white/6 px-5 py-4">
              <input
                className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#f2f2f2] outline-none placeholder:text-[#6f6f6f]"
                type="text"
                value={librarySearchDraft}
                placeholder="Search title, artist, album"
                onChange={(event) => {
                  setLibrarySearchDraft(event.target.value);
                }}
              />
            </label>

            <div className="grid grid-cols-[minmax(320px,2fr)_minmax(180px,1.1fr)_72px] gap-4 border-b border-white/6 px-5 py-3 text-[11px] tracking-[0.08em] text-[#8f8f8f]">
              <span>library handoff</span>
              <span>album</span>
              <span>add</span>
            </div>

            <div className="min-h-0 overflow-y-auto">
              {tracksState.status === "loading" ? (
                <div className="px-5 py-8 text-sm text-[#8f8f8f]">Loading indexed tracks...</div>
              ) : null}

              {tracksState.status === "error" ? (
                <div className="px-5 py-8 text-sm text-[#8f8f8f]">{tracksState.message}</div>
              ) : null}

              {tracksState.status !== "loading" && visibleLibraryTracks.length === 0 ? (
                <div className="grid gap-2 px-5 py-8">
                  <p className="m-0 text-sm text-[#e5e5e5]">
                    {tracksState.items.length === 0 ? "No indexed tracks yet." : "No matching tracks."}
                  </p>
                  <p className="m-0 text-sm text-[#8f8f8f]">
                    {tracksState.items.length === 0
                      ? "Scan a local music folder before adding tracks to playlists."
                      : "Try a different title, artist, or album search."}
                  </p>
                </div>
              ) : null}

              {visibleLibraryTracks.map((track) => {
                const duplicateCount = activePlaylist.entries.filter(
                  (entry) => entry.trackId === track.id,
                ).length;

                return (
                  <div
                    key={track.id}
                    className="grid grid-cols-[minmax(320px,2fr)_minmax(180px,1.1fr)_72px] items-center gap-4 border-b border-white/5 px-5 py-3.5 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ArtworkTile
                        artworkKey={track.artworkKey}
                        title={track.title}
                        sizeClassName="h-11 w-11"
                        roundedClassName="rounded-sm"
                        fallbackClassName="bg-white/[0.04]"
                      />
                      <div className="grid min-w-0 gap-1">
                        <span className="truncate text-sm text-[#f2f2f2]">{track.title}</span>
                        <span className="truncate text-xs text-[#8f8f8f]">
                          {track.artist ?? "unknown artist"}
                          {duplicateCount > 0 ? ` • already added ${duplicateCount}x` : ""}
                        </span>
                      </div>
                    </div>

                    <span className="truncate text-sm text-[#d4d4d4]">
                      {track.album ?? "unknown album"}
                    </span>

                    <button
                      type="button"
                      aria-label={`Add ${track.title} to ${title}`}
                      onClick={() => onTrackAdd(activePlaylist.playlist.id, track)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/[0.05] hover:text-[#f2f2f2]"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <CreatePlaylistDialog
        isOpen={isCreateDialogOpen}
        isSubmitting={isCreatingPlaylist}
        nameDraft={createDraft}
        selectedArtworkPath={createArtworkPath}
        onClose={closeCreateDialog}
        onNameDraftChange={setCreateDraft}
        onSelectedArtworkPathChange={setCreateArtworkPath}
        onSubmit={handleCreateSubmit}
      />
    </>
  );
}
