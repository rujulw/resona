import { type DragEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ImagePlus,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import {
  pickPlaylistArtwork,
  type PlaylistEntryInput,
  type PlaylistEntryItem,
  type TrackListItem,
} from "../desktop";
import type { PlaylistsState, TracksState } from "../types/app";
import { AdvisoryBadge } from "../components/ui/AdvisoryBadge";
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
  onPlaylistEntriesReplace,
  onPlaylistEntryRemove,
  onPlaylistPlaybackHandoff,
  onPlaylistRename,
  onPlaylistSelect,
  onTrackAdd,
}: {
  playlistsState: PlaylistsState;
  tracksState: TracksState;
  onCreatePlaylist: (
    name: string,
    description?: string | null,
    artworkPath?: string | null,
  ) => Promise<string | null>;
  onPlaylistArtworkChange: (playlistId: string, artworkPath: string) => void;
  onPlaylistDelete: (playlistId: string) => void;
  onPlaylistEntryMove: (playlistId: string, entryId: string, targetPosition: number) => void;
  onPlaylistEntriesReplace: (playlistId: string, entries: PlaylistEntryInput[]) => void;
  onPlaylistEntryRemove: (playlistId: string, entryId: string) => void;
  onPlaylistPlaybackHandoff: (playlistId: string, startEntryId?: string) => void;
  onPlaylistRename: (
    playlistId: string,
    name: string,
    description?: string | null,
    artworkPath?: string | null,
  ) => void;
  onPlaylistSelect: (playlistId: string) => void;
  onTrackAdd: (playlistId: string, track: TrackListItem) => void;
}) {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const activePlaylistId = playlistId ?? playlistsState.activePlaylistId;
  const activePlaylist = playlistsState.activePlaylist;
  const [createDraft, setCreateDraft] = useState("");
  const [createDescriptionDraft, setCreateDescriptionDraft] = useState("");
  const [createArtworkPath, setCreateArtworkPath] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editDescriptionDraft, setEditDescriptionDraft] = useState("");
  const [editArtworkPath, setEditArtworkPath] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [librarySearchDraft, setLibrarySearchDraft] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    entryId: string;
    placement: "before" | "after";
  } | null>(null);

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
    setCreateDescriptionDraft("");
    setCreateArtworkPath(null);
    setIsCreateDialogOpen(false);
    setIsCreatingPlaylist(false);
  };

  const openEditDialog = () => {
    if (!activePlaylist) {
      return;
    }

    setEditDraft(activePlaylist.playlist.name);
    setEditDescriptionDraft(activePlaylist.playlist.description ?? "");
    setEditArtworkPath(activePlaylist.playlist.artworkKey ?? null);
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDraft("");
    setEditDescriptionDraft("");
    setEditArtworkPath(null);
    setIsEditDialogOpen(false);
  };

  const handleCreateSubmit = () => {
    const nextName = createDraft.trim();
    if (!nextName || isCreatingPlaylist) {
      return;
    }

    setIsCreatingPlaylist(true);
    void onCreatePlaylist(nextName, createDescriptionDraft, createArtworkPath).then(
      (createdPlaylistId) => {
        setIsCreatingPlaylist(false);
        if (createdPlaylistId) {
          closeCreateDialog();
          navigate(`/playlists/${createdPlaylistId}`);
        }
      },
    );
  };

  const handleEditSubmit = () => {
    if (!activePlaylist || !editDraft.trim()) {
      return;
    }

    onPlaylistRename(
      activePlaylist.playlist.id,
      editDraft,
      editDescriptionDraft,
      editArtworkPath,
    );
    closeEditDialog();
  };

  const orderedPlaylistEntries = useMemo(
    () =>
      [...(activePlaylist?.entries ?? [])].sort(
        (left, right) => left.position - right.position,
      ),
    [activePlaylist?.entries],
  );

  const resolveDragPlacement = (
    event: DragEvent<HTMLElement>,
    entryId: string,
  ): { entryId: string; placement: "before" | "after" } => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const midpoint = bounds.top + bounds.height / 2;
    const placement =
      bounds.height <= 1
        ? event.clientY > bounds.top
          ? "after"
          : "before"
        : event.clientY >= midpoint
          ? "after"
          : "before";

    return { entryId, placement };
  };

  const reorderEntries = (
    entries: PlaylistEntryItem[],
    movingEntryId: string,
    targetEntryId: string,
    placement: "before" | "after",
  ): PlaylistEntryInput[] | null => {
    const nextEntries = [...entries];
    const movingIndex = nextEntries.findIndex((entry) => entry.entryId === movingEntryId);
    const targetIndex = nextEntries.findIndex((entry) => entry.entryId === targetEntryId);

    if (movingIndex < 0 || targetIndex < 0) {
      return null;
    }

    const [movingEntry] = nextEntries.splice(movingIndex, 1);
    const insertIndex = nextEntries.findIndex((entry) => entry.entryId === targetEntryId);
    const boundedIndex = placement === "after" ? insertIndex + 1 : insertIndex;
    nextEntries.splice(boundedIndex, 0, movingEntry);

    if (nextEntries.every((entry, index) => entry.entryId === entries[index]?.entryId)) {
      return null;
    }

    return nextEntries.map((entry, index) => ({
      entryId: entry.entryId,
      trackId: entry.trackId,
      position: index,
    }));
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
          dialogTitle="Create playlist"
          submitLabel="Create playlist"
          nameDraft={createDraft}
          descriptionDraft={createDescriptionDraft}
          selectedArtworkPath={createArtworkPath}
          onClose={closeCreateDialog}
          onNameDraftChange={setCreateDraft}
          onDescriptionDraftChange={setCreateDescriptionDraft}
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
              onClick={openEditDialog}
              aria-label="Edit playlist"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/[0.05] hover:text-[#f2f2f2]"
            >
              <Pencil className="h-4 w-4" strokeWidth={2} />
            </button>
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
                orderedPlaylistEntries.map((entry) => (
                  <article
                    key={entry.entryId}
                    role="button"
                    tabIndex={0}
                    draggable
                    aria-label={`Select ${entry.title}`}
                    aria-pressed={selectedEntryId === entry.entryId}
                    onClick={() => setSelectedEntryId(entry.entryId)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", entry.entryId);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggedEntryId(entry.entryId);
                      setSelectedEntryId(entry.entryId);
                    }}
                    onDragEnd={() => {
                      setDraggedEntryId(null);
                      setDropIndicator(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      const activeDragEntryId =
                        draggedEntryId ||
                        event.dataTransfer.getData("text/plain") ||
                        selectedEntryId;
                      if (!activeDragEntryId || activeDragEntryId === entry.entryId) {
                        return;
                      }
                      setDropIndicator(resolveDragPlacement(event, entry.entryId));
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const activeDragEntryId =
                        draggedEntryId ||
                        event.dataTransfer.getData("text/plain") ||
                        selectedEntryId;
                      if (!activeDragEntryId || activeDragEntryId === entry.entryId) {
                        setDraggedEntryId(null);
                        setDropIndicator(null);
                        return;
                      }

                      const target = resolveDragPlacement(event, entry.entryId);
                      const nextEntries = reorderEntries(
                        orderedPlaylistEntries,
                        activeDragEntryId,
                        target.entryId,
                        target.placement,
                      );
                      if (nextEntries) {
                        onPlaylistEntriesReplace(activePlaylist.playlist.id, nextEntries);
                      }
                      setDraggedEntryId(null);
                      setDropIndicator(null);
                    }}
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
                      draggedEntryId === entry.entryId ? "opacity-60" : "",
                      dropIndicator?.entryId === entry.entryId &&
                      dropIndicator.placement === "before"
                        ? "border-t-2 border-t-[#f2f2f2]"
                        : "",
                      dropIndicator?.entryId === entry.entryId &&
                      dropIndicator.placement === "after"
                        ? "border-b-2 border-b-[#f2f2f2]"
                        : "",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        aria-label={`Play ${entry.title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedEntryId(entry.entryId);
                          onPlaylistPlaybackHandoff(activePlaylist.playlist.id, entry.entryId);
                        }}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/[0.05] hover:text-[#f2f2f2]"
                      >
                        <Play className="h-4 w-4" strokeWidth={2} />
                      </button>
                      <ArtworkTile
                        artworkKey={entry.artworkKey}
                        title={entry.title}
                        sizeClassName="h-11 w-11"
                        roundedClassName="rounded-sm"
                        fallbackClassName="bg-white/[0.04]"
                      />
                      <div className="grid min-w-0 gap-1">
                        <span className="truncate text-sm text-[#f2f2f2]">{entry.title}</span>
                        <div className="flex min-w-0 items-center gap-2">
                          <AdvisoryBadge advisory={entry.advisory} />
                          <span className="truncate text-xs text-[#8f8f8f]">
                            {entry.artist ?? "unknown artist"}
                          </span>
                        </div>
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
                      <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-[#8f8f8f]"
                        aria-label={`Drag ${entry.title}`}
                      >
                        <GripVertical className="h-4 w-4" strokeWidth={1.8} />
                      </span>
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
                        disabled={entry.position === orderedPlaylistEntries.length - 1}
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
        dialogTitle="Create playlist"
        submitLabel="Create playlist"
        nameDraft={createDraft}
        descriptionDraft={createDescriptionDraft}
        selectedArtworkPath={createArtworkPath}
        onClose={closeCreateDialog}
        onNameDraftChange={setCreateDraft}
        onDescriptionDraftChange={setCreateDescriptionDraft}
        onSelectedArtworkPathChange={setCreateArtworkPath}
        onSubmit={handleCreateSubmit}
      />
      <CreatePlaylistDialog
        isOpen={isEditDialogOpen}
        dialogTitle="Edit playlist"
        dialogDescription="Update the playlist name, notes, and cover without touching its saved order."
        submitLabel="Save changes"
        nameDraft={editDraft}
        descriptionDraft={editDescriptionDraft}
        selectedArtworkPath={editArtworkPath}
        onClose={closeEditDialog}
        onNameDraftChange={setEditDraft}
        onDescriptionDraftChange={setEditDescriptionDraft}
        onSelectedArtworkPathChange={setEditArtworkPath}
        onSubmit={handleEditSubmit}
      />
    </>
  );
}
