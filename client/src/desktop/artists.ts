import { invokeDesktop, invokeWithPreviewFallback } from "./runtime";
import type { ArtistDetail, ArtistListItem } from "./types";

export async function listArtists(search?: string | null): Promise<ArtistListItem[]> {
  return invokeWithPreviewFallback("list_artists", { search: search ?? null }, () => []);
}

export async function getArtistDetail(artistName: string): Promise<ArtistDetail | null> {
  return invokeWithPreviewFallback("get_artist_detail", { artistName }, () => null);
}

export async function getArtistsImagesDir(): Promise<string | null> {
  return invokeWithPreviewFallback("get_artists_images_dir", {}, () => null);
}

export async function setArtistsImagesDir(dirPath: string): Promise<void> {
  await invokeDesktop("set_artists_images_dir", { dirPath });
}
