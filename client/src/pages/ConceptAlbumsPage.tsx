import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { pickPlaylistArtwork, type TrackListItem } from "../desktop";
import { ConceptAlbumDetailPanel } from "../components/ui/ConceptAlbumDetailPanel";
import { CreatePlaylistDialog } from "../components/ui/CreatePlaylistDialog";
import { useConceptAlbumDialogs } from "../hooks/conceptAlbums/useConceptAlbumDialogs";
import { usePlaylistReorder } from "../hooks/playlists/usePlaylistReorder";
import { usePlaylistLibrarySearch } from "../hooks/playlists/usePlaylistLibrarySearch";
import type { AlbumsState, ConceptAlbumsState, TracksState } from "../types/app";

export function ConceptAlbumsPage({
  conceptAlbumsState,
  tracksState,
  albumsState,
  onConceptAlbumCreate,
  onConceptAlbumArtworkChange,
  onConceptAlbumDelete,
  onConceptAlbumEntryMove,
  onConceptAlbumEntriesReplace,
  onConceptAlbumEntryRemove,
  onConceptAlbumPlaybackHandoff,
  onConceptAlbumRename,
  onConceptAlbumSelect,
  onConceptAlbumTrackAdd,
}: {
  conceptAlbumsState: ConceptAlbumsState;
  tracksState: TracksState;
  albumsState: AlbumsState;
  onConceptAlbumCreate: (
    title: string,
    artist?: string | null,
    description?: string | null,
    artworkPath?: string | null,
  ) => Promise<string | null>;
  onConceptAlbumArtworkChange: (conceptAlbumId: string, artworkPath: string) => void;
  onConceptAlbumDelete: (conceptAlbumId: string) => void;
  onConceptAlbumEntryMove: (conceptAlbumId: string, entryId: string, targetPosition: number) => void;
  onConceptAlbumEntriesReplace: (
    conceptAlbumId: string,
    entries: Array<{ entryId?: string; trackId: string; position: number }>,
  ) => void;
  onConceptAlbumEntryRemove: (conceptAlbumId: string, entryId: string) => void;
  onConceptAlbumPlaybackHandoff: (conceptAlbumId: string, startEntryId?: string) => void;
  onConceptAlbumRename: (
    conceptAlbumId: string,
    title: string,
    artist?: string | null,
    description?: string | null,
    artworkPath?: string | null,
  ) => void;
  onConceptAlbumSelect: (conceptAlbumId: string) => void;
  onConceptAlbumTrackAdd: (conceptAlbumId: string, track: TrackListItem) => void;
}) {
  const { conceptAlbumId } = useParams<{ conceptAlbumId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConceptAlbumId = conceptAlbumId ?? conceptAlbumsState.activeConceptAlbumId;
  const activeConceptAlbum = conceptAlbumsState.activeConceptAlbum;
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const { librarySearchDraft, setLibrarySearchDraft, visibleLibraryTracks } =
    usePlaylistLibrarySearch(tracksState);
  const {
    draggedEntryId,
    setDraggedEntryId,
    draggedEntryIdRef,
    dropIndicator,
    orderedPlaylistEntries: orderedConceptAlbumEntries,
    resolveDragPlacement,
    clearDropIndicator,
    resolveActiveDragEntryId,
    updateDropIndicatorFromPointer,
    setResolvedDropIndicator,
    commitReorder,
  } = usePlaylistReorder({
    activePlaylistId: activeConceptAlbum?.conceptAlbum.id ?? null,
    activePlaylistEntries: activeConceptAlbum?.entries ?? [],
    activePlaylistUpdatedAt: activeConceptAlbum?.conceptAlbum.updatedAt,
    playlistsStatus: conceptAlbumsState.status,
    onPlaylistEntriesReplace: onConceptAlbumEntriesReplace,
  });
  const {
    createTitleDraft,
    setCreateTitleDraft,
    createArtistDraft,
    setCreateArtistDraft,
    createDescriptionDraft,
    setCreateDescriptionDraft,
    createArtworkPath,
    setCreateArtworkPath,
    isCreateDialogOpen,
    isCreatingConceptAlbum,
    openCreateDialog,
    closeCreateDialog,
    handleCreateSubmit,
    editTitleDraft,
    setEditTitleDraft,
    editArtistDraft,
    setEditArtistDraft,
    editDescriptionDraft,
    setEditDescriptionDraft,
    editArtworkPath,
    setEditArtworkPath,
    isEditDialogOpen,
    openEditDialog,
    closeEditDialog,
    handleEditSubmit,
  } = useConceptAlbumDialogs({
    activeConceptAlbum,
    onCreateConceptAlbum: onConceptAlbumCreate,
    onConceptAlbumRename,
    onCreatedConceptAlbumNavigate: (createdConceptAlbumId) => {
      navigate(`/concept-albums/${createdConceptAlbumId}`);
    },
  });

  useEffect(() => {
    if (
      conceptAlbumId &&
      conceptAlbumId !== conceptAlbumsState.activeConceptAlbum?.conceptAlbum.id &&
      conceptAlbumsState.status !== "loading"
    ) {
      onConceptAlbumSelect(conceptAlbumId);
    }
  }, [
    conceptAlbumId,
    conceptAlbumsState.activeConceptAlbum?.conceptAlbum.id,
    conceptAlbumsState.status,
    onConceptAlbumSelect,
  ]);

  useEffect(() => {
    if (searchParams.get("create") === "concept-album" && !isCreateDialogOpen) {
      openCreateDialog();
      setSearchParams({}, { replace: true });
    }
  }, [isCreateDialogOpen, openCreateDialog, searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedEntryId) {
      return;
    }

    if (activeConceptAlbum?.entries.some((entry) => entry.entryId === selectedEntryId)) {
      return;
    }

    setSelectedEntryId(null);
  }, [activeConceptAlbum, selectedEntryId]);

  if (
    !conceptAlbumId &&
    conceptAlbumsState.items[0] &&
    searchParams.get("create") !== "concept-album"
  ) {
    return <Navigate to={`/concept-albums/${conceptAlbumsState.items[0].id}`} replace />;
  }

  if (!activeConceptAlbumId) {
    return (
      <>
        <section className="grid h-full place-items-center px-6 py-8">
          <div className="grid gap-4 text-center">
            <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">concept albums</p>
            <h2 className="m-0 text-4xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
              no concept albums yet
            </h2>
            <p className="m-0 text-sm text-[#8f8f8f]">
              Create a release-shaped playlist with editable sequencing and metadata.
            </p>
            <button
              type="button"
              onClick={openCreateDialog}
              className="justify-self-center rounded-xl border border-white/10 bg-[#272727] px-4 py-2.5 text-sm text-[#f2f2f2] transition-colors hover:border-white/14 hover:bg-[#303030]"
            >
              Create concept album
            </button>
          </div>
        </section>
        <ConceptAlbumDialog
          isOpen={isCreateDialogOpen}
          isSubmitting={isCreatingConceptAlbum}
          titleDraft={createTitleDraft}
          artistDraft={createArtistDraft}
          descriptionDraft={createDescriptionDraft}
          artworkPath={createArtworkPath}
          dialogTitle="Create concept album"
          submitLabel="Create concept album"
          onClose={closeCreateDialog}
          onTitleChange={setCreateTitleDraft}
          onArtistChange={setCreateArtistDraft}
          onDescriptionChange={setCreateDescriptionDraft}
          onArtworkChange={setCreateArtworkPath}
          onSubmit={handleCreateSubmit}
        />
      </>
    );
  }

  if (conceptAlbumsState.status === "loading" && !activeConceptAlbum) {
    return (
      <section className="grid h-full place-items-center px-6 py-8">
        <p className="m-0 text-sm text-[#8f8f8f]">Loading concept album...</p>
      </section>
    );
  }

  if (!activeConceptAlbum) {
    return (
      <section className="grid h-full place-items-center px-6 py-8">
        <div className="grid gap-2 text-center">
          <h2 className="m-0 text-2xl font-medium text-[#f2f2f2]">concept album unavailable</h2>
          <p className="m-0 text-sm text-[#8f8f8f]">
            {conceptAlbumsState.message ?? "The selected concept album could not be loaded."}
          </p>
        </div>
      </section>
    );
  }

  const title = activeConceptAlbum.conceptAlbum.title;

  return (
    <>
      <ConceptAlbumDetailPanel
        conceptAlbum={activeConceptAlbum}
        entries={orderedConceptAlbumEntries}
        tracksState={tracksState}
        visibleLibraryTracks={visibleLibraryTracks}
        librarySearchDraft={librarySearchDraft}
        selectedEntryId={selectedEntryId}
        draggedEntryId={draggedEntryId}
        dropIndicator={dropIndicator}
        onArtworkPick={() => {
          void pickPlaylistArtwork().then((artworkPath) => {
            if (artworkPath) {
              onConceptAlbumArtworkChange(activeConceptAlbum.conceptAlbum.id, artworkPath);
            }
          });
        }}
        onEditConceptAlbum={openEditDialog}
        onDeleteConceptAlbum={() => {
          if (window.confirm(`Delete ${title}?`)) {
            navigate("/concept-albums");
            onConceptAlbumDelete(activeConceptAlbum.conceptAlbum.id);
          }
        }}
        onPlayConceptAlbum={(startEntryId?: string) =>
          onConceptAlbumPlaybackHandoff(activeConceptAlbum.conceptAlbum.id, startEntryId)
        }
        onContainerKeyDown={(event) => {
          if ((event.key === "Backspace" || event.key === "Delete") && selectedEntryId) {
            event.preventDefault();
            onConceptAlbumEntryRemove(activeConceptAlbum.conceptAlbum.id, selectedEntryId);
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
          onConceptAlbumPlaybackHandoff(activeConceptAlbum.conceptAlbum.id, entryId);
        }}
        onEntryKeyDown={(event, entryId) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            setSelectedEntryId(entryId);
            return;
          }

          if (event.key === "Backspace" || event.key === "Delete") {
            event.preventDefault();
            event.stopPropagation();
            onConceptAlbumEntryRemove(activeConceptAlbum.conceptAlbum.id, entryId);
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
        onTrackAdd={(track) =>
          onConceptAlbumTrackAdd(activeConceptAlbum.conceptAlbum.id, track)
        }
        onLibrarySearchDraftChange={setLibrarySearchDraft}
      />

      <ConceptAlbumDialog
        isOpen={isCreateDialogOpen}
        isSubmitting={isCreatingConceptAlbum}
        titleDraft={createTitleDraft}
        artistDraft={createArtistDraft}
        descriptionDraft={createDescriptionDraft}
        artworkPath={createArtworkPath}
        dialogTitle="Create concept album"
        submitLabel="Create concept album"
        onClose={closeCreateDialog}
        onTitleChange={setCreateTitleDraft}
        onArtistChange={setCreateArtistDraft}
        onDescriptionChange={setCreateDescriptionDraft}
        onArtworkChange={setCreateArtworkPath}
        onSubmit={handleCreateSubmit}
      />

      <ConceptAlbumDialog
        isOpen={isEditDialogOpen}
        titleDraft={editTitleDraft}
        artistDraft={editArtistDraft}
        descriptionDraft={editDescriptionDraft}
        artworkPath={editArtworkPath}
        dialogTitle="Edit concept album"
        submitLabel="Save changes"
        onClose={closeEditDialog}
        onTitleChange={setEditTitleDraft}
        onArtistChange={setEditArtistDraft}
        onDescriptionChange={setEditDescriptionDraft}
        onArtworkChange={setEditArtworkPath}
        onSubmit={handleEditSubmit}
      />
    </>
  );
}

function ConceptAlbumDialog({
  isOpen,
  isSubmitting,
  titleDraft,
  artistDraft,
  descriptionDraft,
  artworkPath,
  dialogTitle,
  submitLabel,
  onClose,
  onTitleChange,
  onArtistChange,
  onDescriptionChange,
  onArtworkChange,
  onSubmit,
}: {
  isOpen: boolean;
  isSubmitting?: boolean;
  titleDraft: string;
  artistDraft: string;
  descriptionDraft: string;
  artworkPath: string | null;
  dialogTitle: string;
  submitLabel: string;
  onClose: () => void;
  onTitleChange: (value: string) => void;
  onArtistChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onArtworkChange: (value: string | null) => void;
  onSubmit: () => void;
}) {
  return (
    <CreatePlaylistDialog
      isOpen={isOpen}
      isSubmitting={isSubmitting}
      entityLabel="concept album"
      nameLabel="release title"
      namePlaceholder="Act I: city lights"
      descriptionPlaceholder="Built to play like a release, not a loose queue."
      coverLabel="Choose artwork"
      dialogTitle={dialogTitle}
      dialogDescription="Set the release identity and then shape the final order in the detail view."
      submitLabel={submitLabel}
      nameDraft={titleDraft}
      descriptionDraft={descriptionDraft}
      selectedArtworkPath={artworkPath}
      onClose={onClose}
      onNameDraftChange={onTitleChange}
      onDescriptionDraftChange={onDescriptionChange}
      onSelectedArtworkPathChange={onArtworkChange}
      onSubmit={onSubmit}
      extraFields={
        <label className="grid gap-2 text-sm text-[#d7d7d7]">
          <span className="text-[11px] tracking-[0.08em] text-[#8f8f8f]">
            release artist
          </span>
          <input
            value={artistDraft}
            onChange={(event) => onArtistChange(event.target.value)}
            placeholder="North"
            className="w-full rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-[#f2f2f2] outline-none placeholder:text-[#6f6f6f]"
          />
        </label>
      }
    />
  );
}
