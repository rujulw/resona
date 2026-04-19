import { useState } from "react";

import { getAlbum, listAlbums } from "../../desktop";
import type { AlbumsState } from "../../types/app";
import { toAsyncErrorMessage } from "./shellQueryShared";

export function useAlbumQueries() {
  const [albumsState, setAlbumsState] = useState<AlbumsState>({
    status: "loading",
    items: [],
    activeAlbumId: null,
    activeAlbum: null,
  });

  const refreshAlbums = (nextActiveAlbumId?: string | null) => {
    setAlbumsState((existing) => ({
      ...existing,
      status: "loading",
    }));

    void listAlbums()
      .then(async (albums) => {
        const activeAlbumId = nextActiveAlbumId ?? albumsState.activeAlbumId;
        const activeAlbum = activeAlbumId ? await getAlbum(activeAlbumId) : null;

        setAlbumsState({
          status: "ready",
          items: albums,
          activeAlbumId,
          activeAlbum,
        });
      })
      .catch((error: unknown) => {
        setAlbumsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to load albums."),
        }));
      });
  };

  const handleAlbumSelection = (albumId: string) => {
    setAlbumsState((existing) => ({
      ...existing,
      status: "loading",
      activeAlbumId: albumId,
    }));

    void Promise.all([listAlbums(), getAlbum(albumId)])
      .then(([albums, activeAlbum]) => {
        setAlbumsState({
          status: "ready",
          items: albums,
          activeAlbumId: albumId,
          activeAlbum,
        });
      })
      .catch((error: unknown) => {
        setAlbumsState((existing) => ({
          ...existing,
          status: "error",
          message: toAsyncErrorMessage(error, "Failed to load album."),
        }));
      });
  };

  return {
    albumsState,
    setAlbumsState,
    refreshAlbums,
    handleAlbumSelection,
  };
}
