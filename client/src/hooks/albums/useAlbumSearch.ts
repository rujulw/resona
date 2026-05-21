import { useMemo, useState } from "react";

import type { AlbumSummary } from "../../desktop";

export function useAlbumSearch(albums: AlbumSummary[]) {
  const [searchDraft, setSearchDraft] = useState("");

  const visibleAlbums = useMemo(() => {
    const normalizedSearch = searchDraft.trim().toLowerCase();
    if (!normalizedSearch) {
      return albums;
    }

    return albums.filter((album) =>
      `${album.title} ${album.artist ?? ""}`.toLowerCase().includes(normalizedSearch),
    );
  }, [albums, searchDraft]);

  return {
    searchDraft,
    setSearchDraft,
    visibleAlbums,
  };
}
