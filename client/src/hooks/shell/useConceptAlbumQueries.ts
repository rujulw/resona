import { useState } from "react";

import {
  addTrackToConceptAlbum,
  createConceptAlbum,
  deleteConceptAlbum,
  getConceptAlbum,
  listConceptAlbums,
  moveConceptAlbumEntry,
  type ConceptAlbumEntryInput,
  type TrackListItem,
  removeConceptAlbumEntry,
  replaceConceptAlbumEntries,
  updateConceptAlbum,
} from "../../desktop";
import type { ConceptAlbumsState } from "../../types/app";
import {
  toAsyncErrorMessage,
  withActiveConceptAlbumDetail,
} from "./shellQueryShared";

export function useConceptAlbumQueries() {
  const [conceptAlbumsState, setConceptAlbumsState] = useState<ConceptAlbumsState>({
    status: "loading",
    items: [],
    activeConceptAlbumId: null,
    activeConceptAlbum: null,
  });

  const refreshConceptAlbums = (
    nextActiveConceptAlbumId?: string | null,
    options?: { preserveSelection?: boolean },
  ) => {
    setConceptAlbumsState((existing) => ({
      ...existing,
      status: "loading",
    }));

    void listConceptAlbums()
      .then(async (conceptAlbums) => {
        const fallbackActiveConceptAlbumId =
          options?.preserveSelection === false
            ? null
            : nextActiveConceptAlbumId ??
              conceptAlbumsState.activeConceptAlbumId ??
              conceptAlbums[0]?.id ??
              null;
        const activeConceptAlbum =
          fallbackActiveConceptAlbumId != null
            ? await getConceptAlbum(fallbackActiveConceptAlbumId)
            : null;

        setConceptAlbumsState({
          status: "ready",
          items: conceptAlbums,
          activeConceptAlbumId:
            activeConceptAlbum?.conceptAlbum.id ?? fallbackActiveConceptAlbumId,
          activeConceptAlbum,
        });
      })
      .catch((error: unknown) => {
        setConceptAlbumsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to load concept albums."),
        }));
      });
  };

  const handleConceptAlbumSelection = (conceptAlbumId: string) => {
    setConceptAlbumsState((existing) => ({
      ...existing,
      status: "loading",
      activeConceptAlbumId: conceptAlbumId,
    }));

    void Promise.all([listConceptAlbums(), getConceptAlbum(conceptAlbumId)])
      .then(([conceptAlbums, activeConceptAlbum]) => {
        setConceptAlbumsState({
          status: "ready",
          items: conceptAlbums,
          activeConceptAlbumId: conceptAlbumId,
          activeConceptAlbum,
        });
      })
      .catch((error: unknown) => {
        setConceptAlbumsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to load concept album."),
        }));
      });
  };

  const handleConceptAlbumCreate = async (
    title: string,
    artist?: string | null,
    description?: string | null,
    artworkPath?: string | null,
  ) => {
    try {
      const conceptAlbum = await createConceptAlbum(
        title,
        artist?.trim() ? artist.trim() : null,
        description?.trim() ? description.trim() : null,
        artworkPath,
      );
      refreshConceptAlbums(conceptAlbum.id);
      return conceptAlbum.id;
    } catch (error: unknown) {
      setConceptAlbumsState((existing) => ({
        ...existing,
        status: "error",
        message: toAsyncErrorMessage(error, "Failed to create concept album."),
      }));
      return null;
    }
  };

  const handleConceptAlbumRename = (
    conceptAlbumId: string,
    title: string,
    artist?: string | null,
    description?: string | null,
    artworkPath?: string | null,
  ) => {
    void updateConceptAlbum(
      conceptAlbumId,
      title,
      artist?.trim() ? artist.trim() : null,
      description?.trim() ? description.trim() : null,
      artworkPath ?? null,
    )
      .then((conceptAlbum) => {
        refreshConceptAlbums(conceptAlbum.id);
      })
      .catch((error: unknown) => {
        setConceptAlbumsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to update concept album."),
        }));
      });
  };

  const handleConceptAlbumArtworkChange = (
    conceptAlbumId: string,
    artworkPath: string,
  ) => {
    const conceptAlbumSummary = conceptAlbumsState.items.find(
      (item) => item.id === conceptAlbumId,
    );
    if (!conceptAlbumSummary) {
      return;
    }

    void updateConceptAlbum(
      conceptAlbumId,
      conceptAlbumSummary.title,
      conceptAlbumSummary.artist,
      conceptAlbumSummary.description,
      artworkPath,
    )
      .then((conceptAlbum) => {
        refreshConceptAlbums(conceptAlbum.id);
      })
      .catch((error: unknown) => {
        setConceptAlbumsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to update concept album artwork."),
        }));
      });
  };

  const handleConceptAlbumDelete = (conceptAlbumId: string) => {
    void deleteConceptAlbum(conceptAlbumId)
      .then(() => {
        const remainingConceptAlbums = conceptAlbumsState.items.filter(
          (item) => item.id !== conceptAlbumId,
        );
        refreshConceptAlbums(remainingConceptAlbums[0]?.id ?? null, {
          preserveSelection: false,
        });
      })
      .catch((error: unknown) => {
        setConceptAlbumsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to delete concept album."),
        }));
      });
  };

  const handleConceptAlbumTrackAdd = (conceptAlbumId: string, track: TrackListItem) => {
    void addTrackToConceptAlbum(conceptAlbumId, track)
      .then((detail) => {
        setConceptAlbumsState((existing) =>
          withActiveConceptAlbumDetail(existing, detail),
        );
      })
      .catch((error: unknown) => {
        setConceptAlbumsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to add track to concept album."),
        }));
      });
  };

  const handleConceptAlbumEntryMove = (
    conceptAlbumId: string,
    entryId: string,
    targetPosition: number,
  ) => {
    void moveConceptAlbumEntry(conceptAlbumId, entryId, targetPosition)
      .then((detail) => {
        setConceptAlbumsState((existing) =>
          withActiveConceptAlbumDetail(existing, detail),
        );
      })
      .catch((error: unknown) => {
        setConceptAlbumsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to reorder concept album."),
        }));
      });
  };

  const handleConceptAlbumEntriesReplace = (
    conceptAlbumId: string,
    entries: ConceptAlbumEntryInput[],
  ) => {
    void replaceConceptAlbumEntries(conceptAlbumId, entries)
      .then((detail) => {
        setConceptAlbumsState((existing) =>
          withActiveConceptAlbumDetail(existing, detail),
        );
      })
      .catch((error: unknown) => {
        setConceptAlbumsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to update concept album order."),
        }));
      });
  };

  const handleConceptAlbumEntryRemove = (conceptAlbumId: string, entryId: string) => {
    void removeConceptAlbumEntry(conceptAlbumId, entryId)
      .then((detail) => {
        setConceptAlbumsState((existing) =>
          withActiveConceptAlbumDetail(existing, detail),
        );
      })
      .catch((error: unknown) => {
        setConceptAlbumsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to remove concept album track."),
        }));
      });
  };

  return {
    conceptAlbumsState,
    setConceptAlbumsState,
    refreshConceptAlbums,
    handleConceptAlbumSelection,
    handleConceptAlbumCreate,
    handleConceptAlbumRename,
    handleConceptAlbumArtworkChange,
    handleConceptAlbumDelete,
    handleConceptAlbumTrackAdd,
    handleConceptAlbumEntryMove,
    handleConceptAlbumEntriesReplace,
    handleConceptAlbumEntryRemove,
  };
}
