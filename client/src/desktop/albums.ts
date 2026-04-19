import { invokeWithPreviewFallback, normalizeOptionalText } from "./runtime";
import type { AlbumDetail, AlbumSummary } from "./types";

export async function listAlbums(search?: string | null): Promise<AlbumSummary[]> {
  return invokeWithPreviewFallback(
    "list_albums",
    {
      search: normalizeOptionalText(search),
    },
    () => [],
  );
}

export async function getAlbum(albumId: string): Promise<AlbumDetail | null> {
  return invokeWithPreviewFallback(
    "get_album",
    {
      albumId,
    },
    () => null,
  );
}
