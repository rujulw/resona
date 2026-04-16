import { useState } from "react";

import type { PlaylistDetail } from "../../desktop";

type UsePlaylistDialogsArgs = {
  activePlaylist: PlaylistDetail | null;
  onCreatePlaylist: (
    name: string,
    description?: string | null,
    artworkPath?: string | null,
  ) => Promise<string | null>;
  onPlaylistRename: (
    playlistId: string,
    name: string,
    description?: string | null,
    artworkPath?: string | null,
  ) => void;
  onCreatedPlaylistNavigate: (playlistId: string) => void;
};

export function usePlaylistDialogs({
  activePlaylist,
  onCreatePlaylist,
  onPlaylistRename,
  onCreatedPlaylistNavigate,
}: UsePlaylistDialogsArgs) {
  const [createDraft, setCreateDraft] = useState("");
  const [createDescriptionDraft, setCreateDescriptionDraft] = useState("");
  const [createArtworkPath, setCreateArtworkPath] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

  const [editDraft, setEditDraft] = useState("");
  const [editDescriptionDraft, setEditDescriptionDraft] = useState("");
  const [editArtworkPath, setEditArtworkPath] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

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
          onCreatedPlaylistNavigate(createdPlaylistId);
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

  return {
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
  };
}