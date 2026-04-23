import { useState } from "react";

import {
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylists,
  movePlaylistEntry,
  removePlaylistEntry,
  replacePlaylistEntries,
  turnPlaylistToMixtape,
  updatePlaylist,
  type PlaylistEntryInput,
  type TrackListItem,
} from "../../desktop";
import type { PlaylistsState } from "../../types/app";
import { existingQueueSnapshot } from "../appShellShared";
import { toAsyncErrorMessage, withActivePlaylistDetail } from "./shellQueryShared";

export function usePlaylistQueries() {
  const [playlistsState, setPlaylistsState] = useState<PlaylistsState>({
    status: "loading",
    items: [],
    activePlaylistId: null,
    activePlaylist: null,
    playbackQueue: null,
  });

  const refreshPlaylists = (
    nextActivePlaylistId?: string | null,
    options?: { preserveSelection?: boolean },
  ) => {
    setPlaylistsState((existing) => ({
      ...existing,
      status: "loading",
    }));

    void listPlaylists()
      .then(async (playlists) => {
        const fallbackActivePlaylistId =
          options?.preserveSelection === false
            ? null
            : nextActivePlaylistId ?? playlistsState.activePlaylistId ?? playlists[0]?.id ?? null;
        const activePlaylist =
          fallbackActivePlaylistId != null
            ? await getPlaylist(fallbackActivePlaylistId)
            : null;

        setPlaylistsState({
          status: "ready",
          items: playlists,
          activePlaylistId: activePlaylist?.playlist.id ?? fallbackActivePlaylistId,
          activePlaylist,
          playbackQueue: existingQueueSnapshot(playlistsState),
        });
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to load playlists."),
        }));
      });
  };

  const handlePlaylistSelection = (playlistId: string) => {
    setPlaylistsState((existing) => ({
      ...existing,
      status: "loading",
      activePlaylistId: playlistId,
    }));

    void Promise.all([listPlaylists(), getPlaylist(playlistId)])
      .then(([playlists, activePlaylist]) => {
        setPlaylistsState({
          status: "ready",
          items: playlists,
          activePlaylistId: playlistId,
          activePlaylist,
          playbackQueue: existingQueueSnapshot(playlistsState),
        });
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to load playlist."),
        }));
      });
  };

  const handlePlaylistCreate = async (
    name: string,
    description?: string | null,
    artworkPath?: string | null,
  ) => {
    try {
      const playlist = await createPlaylist(
        name,
        description?.trim() ? description.trim() : null,
        artworkPath,
      );
      refreshPlaylists(playlist.id);
      return playlist.id;
    } catch (error: unknown) {
      setPlaylistsState((existing) => ({
        ...existing,
        status: "error",
        message: toAsyncErrorMessage(error, "Failed to create playlist."),
      }));
      return null;
    }
  };

  const handlePlaylistRename = (
    playlistId: string,
    name: string,
    description?: string | null,
    artworkPath?: string | null,
  ) => {
    void updatePlaylist(
      playlistId,
      name,
      description?.trim() ? description.trim() : null,
      artworkPath ?? null,
    )
      .then((playlist) => {
        refreshPlaylists(playlist.id);
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to update playlist."),
        }));
      });
  };

  const handlePlaylistArtworkChange = (playlistId: string, artworkPath: string) => {
    const playlistSummary = playlistsState.items.find((item) => item.id === playlistId);
    if (!playlistSummary) {
      return;
    }

    void updatePlaylist(
      playlistId,
      playlistSummary.name,
      playlistSummary.description ?? null,
      artworkPath,
    )
      .then((playlist) => {
        refreshPlaylists(playlist.id);
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to update playlist artwork."),
        }));
      });
  };

  const handlePlaylistDelete = (playlistId: string) => {
    void deletePlaylist(playlistId)
      .then(() => {
        const remainingPlaylists = playlistsState.items.filter((item) => item.id !== playlistId);
        refreshPlaylists(remainingPlaylists[0]?.id ?? null, { preserveSelection: false });
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to delete playlist."),
        }));
      });
  };

  const handlePlaylistTrackAdd = (playlistId: string, track: TrackListItem) => {
    void addTrackToPlaylist(playlistId, track)
      .then((detail) => {
        setPlaylistsState((existing) => withActivePlaylistDetail(existing, detail));
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to add track to playlist."),
        }));
      });
  };

  const handlePlaylistEntryMove = (
    playlistId: string,
    entryId: string,
    targetPosition: number,
  ) => {
    void movePlaylistEntry(playlistId, entryId, targetPosition)
      .then((detail) => {
        setPlaylistsState((existing) => withActivePlaylistDetail(existing, detail));
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to reorder playlist."),
        }));
      });
  };

  const handlePlaylistEntriesReplace = (
    playlistId: string,
    entries: PlaylistEntryInput[],
  ) => {
    void replacePlaylistEntries(playlistId, entries)
      .then((detail) => {
        setPlaylistsState((existing) => withActivePlaylistDetail(existing, detail));
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to reorder playlist."),
        }));
      });
  };

  const handlePlaylistEntryRemove = (playlistId: string, entryId: string) => {
    void removePlaylistEntry(playlistId, entryId)
      .then((detail) => {
        setPlaylistsState((existing) => withActivePlaylistDetail(existing, detail));
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to remove playlist entry."),
        }));
      });
  };

  const handlePlaylistTurnToMixtape = (playlistId: string) => {
    void turnPlaylistToMixtape(playlistId)
      .then(() => {
        refreshPlaylists(playlistId);
      })
      .catch((error: unknown) => {
        setPlaylistsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to lock playlist into a mixtape."),
        }));
      });
  };

  return {
    playlistsState,
    setPlaylistsState,
    refreshPlaylists,
    handlePlaylistSelection,
    handlePlaylistCreate,
    handlePlaylistRename,
    handlePlaylistArtworkChange,
    handlePlaylistDelete,
    handlePlaylistTrackAdd,
    handlePlaylistEntryMove,
    handlePlaylistEntriesReplace,
    handlePlaylistEntryRemove,
    handlePlaylistTurnToMixtape,
  };
}
