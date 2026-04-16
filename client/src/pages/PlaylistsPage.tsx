import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { usePlaylistDialogs } from "../hooks/playlists/usePlaylistDialogs";
import { usePlaylistLibrarySearch } from "../hooks/playlists/usePlaylistLibrarySearch";
import { usePlaylistEntrySelection } from "../hooks/playlists/usePlaylistEntrySelection";
import { usePlaylistReorder } from "../hooks/playlists/usePlaylistReorder";

import {
  pickPlaylistArtwork,
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
  onPlaylistEntriesReplace: Parameters<typeof usePlaylistReorder>[0]["onPlaylistEntriesReplace"];
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
  const { librarySearchDraft, setLibrarySearchDraft, visibleLibraryTracks } =
    usePlaylistLibrarySearch(tracksState);
  const { selectedEntryId, setSelectedEntryId } = usePlaylistEntrySelection(activePlaylist);
  const {
    draggedEntryId,
    setDraggedEntryId,
    draggedEntryIdRef,
    dropIndicator,
    orderedPlaylistEntries,
    resolveDragPlacement,
    clearDropIndicator,
    resolveActiveDragEntryId,
    updateDropIndicatorFromPointer,
    setResolvedDropIndicator,
    commitReorder,
  } = usePlaylistReorder({
    activePlaylistId: activePlaylist?.playlist.id ?? null,
    activePlaylistEntries: activePlaylist?.entries ?? [],
    activePlaylistUpdatedAt: activePlaylist?.playlist.updatedAt,
    playlistsStatus: playlistsState.status,
    onPlaylistEntriesReplace,
  });
  const {
    createDraft,
    setCreateDraft,
    createDescriptionDraft,
    setCreateDescriptionDraft,
    createArtworkPath,
    setCreateArtworkPath,
    isCreateDialogOpen,
    isCreatingPlaylist,
    openCreateDialog,
    closeCreateDialog,
    handleCreateSubmit,
    editDraft,
    setEditDraft,
    editDescriptionDraft,
    setEditDescriptionDraft,
    editArtworkPath,
    setEditArtworkPath,
    isEditDialogOpen,
    openEditDialog,
    closeEditDialog,
    handleEditSubmit,
  } = usePlaylistDialogs({
    activePlaylist,
    onCreatePlaylist,
    onPlaylistRename,
    onCreatedPlaylistNavigate: (createdPlaylistId) => {
      navigate(`/playlists/${createdPlaylistId}`);
    },
  });

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
              const activeDragEntryId = resolveActiveDragEntryId(event, selectedEntryId);
              if (!activeDragEntryId || activeDragEntryId === entryId) {
                clearDropIndicator(entryId);
                return;
              }

              const nextIndicator = resolveDragPlacement(event, entryId);
              setResolvedDropIndicator(nextIndicator.entryId, nextIndicator.placement);
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
              const activeDragEntryId = resolveActiveDragEntryId(event, selectedEntryId);
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
