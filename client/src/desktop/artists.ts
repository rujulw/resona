import { invokeDesktop, invokeWithPreviewFallback } from "./runtime";
import type { ArtistDetail, ArtistImageConfig, ArtistListItem } from "./types";

export async function listArtists(search?: string | null): Promise<ArtistListItem[]> {
  return invokeWithPreviewFallback("list_artists", { search: search ?? null }, () => []);
}

export async function getArtistDetail(artistName: string): Promise<ArtistDetail | null> {
  return invokeWithPreviewFallback("get_artist_detail", { artistName }, () => null);
}

export async function getArtistImageConfig(
  artistName: string,
): Promise<ArtistImageConfig | null> {
  return invokeWithPreviewFallback("get_artist_image_config", { artistName }, () => null);
}

export async function setArtistImageConfig(
  artistName: string,
  localImagePath: string,
): Promise<void> {
  await invokeDesktop("set_artist_image_config", { artistName, localImagePath });
}
