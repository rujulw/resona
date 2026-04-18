import { useEffect } from "react";

export function useAlbumRouteSelection({
  albumId,
  activeAlbumId,
  albumsStatus,
  onAlbumSelect,
}: {
  albumId: string | undefined;
  activeAlbumId: string | null;
  albumsStatus: "loading" | "ready" | "error";
  onAlbumSelect: (albumId: string) => void;
}) {
  useEffect(() => {
    if (albumId && albumId !== activeAlbumId && albumsStatus !== "loading") {
      onAlbumSelect(albumId);
    }
  }, [activeAlbumId, albumId, albumsStatus, onAlbumSelect]);
}
