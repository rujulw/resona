import { type DragEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import {
  pickPlaylistArtwork,
  type PlaylistEntryInput,
  type PlaylistEntryItem,
  type TrackListItem,
} from "../desktop";
import type { PlaylistsState, TracksState } from "../types/app";
import { CreatePlaylistDialog } from "../components/ui/CreatePlaylistDialog";
import { PlaylistDetailHeader } from "../components/ui/PlaylistDetailHeader";
import { PlaylistEntriesSection } from "../components/ui/PlaylistEntriesSection";
import { PlaylistLibrarySection } from "../components/ui/PlaylistLibrarySection";

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
  const [optimisticEntries, setOptimisticEntries] = useState<PlaylistEntryItem[] | null>(null);
  const draggedEntryIdRef = useRef<string | null>(null);
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

  useEffect(() => {
    setOptimisticEntries(null);
  }, [activePlaylist?.playlist.id, activePlaylist?.playlist.updatedAt, activePlaylist?.entries]);

  useEffect(() => {
    if (playlistsState.status === "error") {
      setOptimisticEntries(null);
    }
  }, [playlistsState.status]);

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

  const persistedOrderedPlaylistEntries = useMemo(
    () =>
      [...(activePlaylist?.entries ?? [])].sort(
        (left, right) => left.position - right.position,
      ),
    [activePlaylist?.entries],
  );

  const orderedPlaylistEntries = optimisticEntries ?? persistedOrderedPlaylistEntries;

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
  ): PlaylistEntryItem[] | null => {
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
      ...entry,
      position: index,
    }));
  };

  const clearDropIndicator = (entryId?: string) => {
    setDropIndicator((existing) => {
      if (!existing) {
        return null;
      }

      if (entryId && existing.entryId !== entryId) {
        return existing;
      }

      return null;
    });
  };

  const resolveActiveDragEntryId = (event: DragEvent<HTMLElement>) =>
    draggedEntryIdRef.current ||
    draggedEntryId ||
    event.dataTransfer.getData("text/plain") ||
    selectedEntryId;

  const updateDropIndicatorFromPointer = (
    event: MouseEvent<HTMLElement>,
    entryId: string,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const midpoint = bounds.top + bounds.height / 2;
    const placement = event.clientY >= midpoint ? "after" : "before";
    setDropIndicator((existing) =>
      existing?.entryId === entryId && existing.placement === placement
        ? existing
        : { entryId, placement },
    );
  };

  const commitReorder = (
    movingEntryId: string,
    targetEntryId: string,
    placement: "before" | "after",
  ) => {
    if (!activePlaylist || movingEntryId === targetEntryId) {
      draggedEntryIdRef.current = null;
      setDraggedEntryId(null);
      clearDropIndicator();
      return;
    }

    const nextEntries = reorderEntries(
      orderedPlaylistEntries,
      movingEntryId,
      targetEntryId,
      placement,
    );
    if (nextEntries) {
      setOptimisticEntries(nextEntries);
      onPlaylistEntriesReplace(
        activePlaylist.playlist.id,
        nextEntries.map((nextEntry) => ({
          entryId: nextEntry.entryId,
          trackId: nextEntry.trackId,
          position: nextEntry.position,
        })),
      );
    }
    draggedEntryIdRef.current = null;
    setDraggedEntryId(null);
    clearDropIndicator();
  };

  useEffect(() => {
    if (!draggedEntryId) {
      return;
    }

    const clearDrag = () => {
      draggedEntryIdRef.current = null;
      setDraggedEntryId(null);
      clearDropIndicator();
    };

    window.addEventListener("mouseup", clearDrag);
    return () => {
      window.removeEventListener("mouseup", clearDrag);
    };
  }, [draggedEntryId]);

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
        <PlaylistDetailHeader
          playlist={activePlaylist}
          onArtworkPick={() => {
            void pickPlaylistArtwork().then((artworkPath) => {
              if (artworkPath) {
                onPlaylistArtworkChange(activePlaylist.playlist.id, artworkPath);
              }
            });
          }}
          onCreatePlaylist={openCreateDialog}
          onEditPlaylist={openEditDialog}
          onDeletePlaylist={() => {
            if (window.confirm(`Delete ${title}?`)) {
              navigate("/playlists");
              onPlaylistDelete(activePlaylist.playlist.id);
            }
          }}
          onPlayPlaylist={() => onPlaylistPlaybackHandoff(activePlaylist.playlist.id)}
        />

        <div className="grid min-h-0 gap-4 overflow-y-auto pb-2">
          <PlaylistEntriesSection
            playlist={activePlaylist}
            entries={orderedPlaylistEntries}
            selectedEntryId={selectedEntryId}
            draggedEntryId={draggedEntryId}
            dropIndicator={dropIndicator}
            onContainerKeyDown={(event) => {
              if ((event.key === "Backspace" || event.key === "Delete") && selectedEntryId) {
                event.preventDefault();
                onPlaylistEntryRemove(activePlaylist.playlist.id, selectedEntryId);
              }
            }}
            onEntrySelect={setSelectedEntryId}
            onEntryDragOver={(event, entryId) => {
              event.preventDefault();
              const activeDragEntryId = resolveActiveDragEntryId(event);
              if (!activeDragEntryId || activeDragEntryId === entryId) {
                clearDropIndicator(entryId);
                return;
              }

              const nextIndicator = resolveDragPlacement(event, entryId);
              setDropIndicator((existing) =>
                existing?.entryId === nextIndicator.entryId &&
                existing.placement === nextIndicator.placement
                  ? existing
                  : nextIndicator,
              );
            }}
            onEntryDragLeave={(event, entryId) => {
              const relatedTarget = event.relatedTarget;
              if (
                relatedTarget instanceof Node &&
                event.currentTarget.contains(relatedTarget)
              ) {
                return;
              }

              clearDropIndicator(entryId);
            }}
            onEntryMouseMove={(event, entryId) => {
              if (!draggedEntryIdRef.current || draggedEntryIdRef.current === entryId) {
                return;
              }

              updateDropIndicatorFromPointer(event, entryId);
            }}
            onEntryMouseUp={(event, entryId) => {
              const activeDragEntryId = draggedEntryIdRef.current;
              if (!activeDragEntryId || activeDragEntryId === entryId) {
                return;
              }

              event.preventDefault();
              updateDropIndicatorFromPointer(event, entryId);
              const targetPlacement =
                event.clientY >=
                event.currentTarget.getBoundingClientRect().top +
                  event.currentTarget.getBoundingClientRect().height / 2
                  ? "after"
                  : "before";
              commitReorder(activeDragEntryId, entryId, targetPlacement);
            }}
            onEntryDrop={(event, entryId) => {
              event.preventDefault();
              const activeDragEntryId = resolveActiveDragEntryId(event);
              if (!activeDragEntryId || activeDragEntryId === entryId) {
                draggedEntryIdRef.current = null;
                setDraggedEntryId(null);
                clearDropIndicator();
                return;
              }

              const target =
                dropIndicator?.entryId === entryId
                  ? dropIndicator
                  : resolveDragPlacement(event, entryId);
              commitReorder(activeDragEntryId, target.entryId, target.placement);
            }}
            onEntryPlay={(entryId) => {
              setSelectedEntryId(entryId);
              onPlaylistPlaybackHandoff(activePlaylist.playlist.id, entryId);
            }}
            onEntryKeyDown={(event, entryId) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedEntryId(entryId);
                return;
              }

              if (event.key === "Backspace" || event.key === "Delete") {
                event.preventDefault();
                onPlaylistEntryRemove(activePlaylist.playlist.id, entryId);
              }
            }}
            onDragHandleClick={(event, entryId) => {
              event.stopPropagation();
              setSelectedEntryId(entryId);
            }}
            onDragHandleMouseDown={(event, entryId) => {
              event.preventDefault();
              event.stopPropagation();
              draggedEntryIdRef.current = entryId;
              setDraggedEntryId(entryId);
              setSelectedEntryId(entryId);
            }}
            onDragHandleStart={(event, entryId) => {
              event.dataTransfer.setData("text/plain", entryId);
              event.dataTransfer.effectAllowed = "move";
              draggedEntryIdRef.current = entryId;
              setDraggedEntryId(entryId);
              setSelectedEntryId(entryId);
            }}
            onDragHandleEnd={() => {
              draggedEntryIdRef.current = null;
              setDraggedEntryId(null);
              clearDropIndicator();
            }}
            onMoveEntryUp={(event, entry) => {
              event.stopPropagation();
              setSelectedEntryId(entry.entryId);
              onPlaylistEntryMove(
                activePlaylist.playlist.id,
                entry.entryId,
                entry.position - 1,
              );
            }}
            onMoveEntryDown={(event, entry) => {
              event.stopPropagation();
              setSelectedEntryId(entry.entryId);
              onPlaylistEntryMove(
                activePlaylist.playlist.id,
                entry.entryId,
                entry.position + 1,
              );
            }}
          />

          <PlaylistLibrarySection
            playlist={activePlaylist}
            tracksState={tracksState}
            searchDraft={librarySearchDraft}
            visibleTracks={visibleLibraryTracks}
            onSearchDraftChange={setLibrarySearchDraft}
            onTrackAdd={(track) => onTrackAdd(activePlaylist.playlist.id, track)}
          />
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
