import { useState } from "react";

import type { ConceptAlbumDetail } from "../../desktop";

type UseConceptAlbumDialogsArgs = {
  activeConceptAlbum: ConceptAlbumDetail | null;
  onCreateConceptAlbum: (
    title: string,
    artist?: string | null,
    description?: string | null,
    artworkPath?: string | null,
  ) => Promise<string | null>;
  onConceptAlbumRename: (
    conceptAlbumId: string,
    title: string,
    artist?: string | null,
    description?: string | null,
    artworkPath?: string | null,
  ) => void;
  onCreatedConceptAlbumNavigate: (conceptAlbumId: string) => void;
};

export function useConceptAlbumDialogs({
  activeConceptAlbum,
  onCreateConceptAlbum,
  onConceptAlbumRename,
  onCreatedConceptAlbumNavigate,
}: UseConceptAlbumDialogsArgs) {
  const [createTitleDraft, setCreateTitleDraft] = useState("");
  const [createArtistDraft, setCreateArtistDraft] = useState("");
  const [createDescriptionDraft, setCreateDescriptionDraft] = useState("");
  const [createArtworkPath, setCreateArtworkPath] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingConceptAlbum, setIsCreatingConceptAlbum] = useState(false);

  const [editTitleDraft, setEditTitleDraft] = useState("");
  const [editArtistDraft, setEditArtistDraft] = useState("");
  const [editDescriptionDraft, setEditDescriptionDraft] = useState("");
  const [editArtworkPath, setEditArtworkPath] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const openCreateDialog = () => {
    setIsCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    setCreateTitleDraft("");
    setCreateArtistDraft("");
    setCreateDescriptionDraft("");
    setCreateArtworkPath(null);
    setIsCreateDialogOpen(false);
    setIsCreatingConceptAlbum(false);
  };

  const openEditDialog = () => {
    if (!activeConceptAlbum) {
      return;
    }

    setEditTitleDraft(activeConceptAlbum.conceptAlbum.title);
    setEditArtistDraft(activeConceptAlbum.conceptAlbum.artist ?? "");
    setEditDescriptionDraft(activeConceptAlbum.conceptAlbum.description ?? "");
    setEditArtworkPath(activeConceptAlbum.conceptAlbum.artworkKey ?? null);
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditTitleDraft("");
    setEditArtistDraft("");
    setEditDescriptionDraft("");
    setEditArtworkPath(null);
    setIsEditDialogOpen(false);
  };

  const handleCreateSubmit = () => {
    const nextTitle = createTitleDraft.trim();
    if (!nextTitle || isCreatingConceptAlbum) {
      return;
    }

    setIsCreatingConceptAlbum(true);
    void onCreateConceptAlbum(
      nextTitle,
      createArtistDraft,
      createDescriptionDraft,
      createArtworkPath,
    ).then((createdConceptAlbumId) => {
      setIsCreatingConceptAlbum(false);
      if (createdConceptAlbumId) {
        closeCreateDialog();
        onCreatedConceptAlbumNavigate(createdConceptAlbumId);
      }
    });
  };

  const handleEditSubmit = () => {
    if (!activeConceptAlbum || !editTitleDraft.trim()) {
      return;
    }

    onConceptAlbumRename(
      activeConceptAlbum.conceptAlbum.id,
      editTitleDraft,
      editArtistDraft,
      editDescriptionDraft,
      editArtworkPath,
    );
    closeEditDialog();
  };

  return {
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
  };
}
