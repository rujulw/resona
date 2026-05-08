import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import {
  invokeDesktop,
  invokeWithPreviewFallback,
  normalizeOptionalText,
} from "./runtime";
import type { ArtworkSource, LibraryPagePayload, PlaybackSource, ScanSummary } from "./types";

export async function scanLocalLibrary(
  rootPath: string,
  displayName?: string,
): Promise<ScanSummary> {
  return invokeDesktop("scan_local_library", {
    rootPath,
    displayName: normalizeOptionalText(displayName),
  });
}

export async function queryLibrary(options?: {
  pageSize?: number;
  cursor?: string | null;
  search?: string | null;
  sortKey?: "title" | "artist" | "album" | "indexed_at";
  sortDirection?: "asc" | "desc";
}): Promise<LibraryPagePayload> {
  return invokeWithPreviewFallback(
    "query_library",
    {
      pageSize: options?.pageSize ?? 100,
      cursor: options?.cursor ?? null,
      search: options?.search ?? null,
      sortKey: options?.sortKey ?? "title",
      sortDirection: options?.sortDirection ?? "asc",
    },
    () => ({
      items: [],
      nextCursor: null,
      total: 0,
      pageSize: options?.pageSize ?? 100,
    }),
  );
}

export async function resolveTrackPlaybackSource(
  trackId: string,
): Promise<PlaybackSource | null> {
  return invokeWithPreviewFallback<
    { trackId: string; localPath: string; extension?: string } | null,
    { trackId: string }
  >("resolve_track_playback_source", { trackId }, () => null).then((payload) => {
    if (!payload) {
      return null;
    }

    return {
      trackId: payload.trackId,
      localPath: payload.localPath,
      extension: payload.extension,
      assetUrl: convertFileSrc(payload.localPath),
    };
  });
}

export async function resolveArtworkSource(
  artworkKey: string,
): Promise<ArtworkSource | null> {
  return invokeWithPreviewFallback<
    { artworkKey: string; localPath: string } | null,
    { artworkKey: string }
  >("resolve_artwork_source", { artworkKey }, () => null).then((payload) => {
    if (!payload) {
      return null;
    }

    return {
      artworkKey: payload.artworkKey,
      localPath: payload.localPath,
      assetUrl: convertFileSrc(payload.localPath),
    };
  });
}

export async function pickLibraryDirectory(
  defaultPath?: string | null,
): Promise<string | null> {
  const selected = await open({
    title: "Choose music folder",
    directory: true,
    multiple: false,
    recursive: true,
    defaultPath: defaultPath?.trim() ? defaultPath : undefined,
  });

  return typeof selected === "string" ? selected : null;
}

export async function pickArtistsImagesDir(
  defaultPath?: string | null,
): Promise<string | null> {
  const selected = await open({
    title: "Choose artist images folder",
    directory: true,
    multiple: false,
    recursive: false,
    defaultPath: defaultPath?.trim() ? defaultPath : undefined,
  });

  return typeof selected === "string" ? selected : null;
}

export async function pickPlaylistArtwork(
  defaultPath?: string | null,
): Promise<string | null> {
  const selected = await open({
    title: "Choose playlist cover",
    directory: false,
    multiple: false,
    recursive: false,
    defaultPath: defaultPath?.trim() ? defaultPath : undefined,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp"],
      },
    ],
  });

  return typeof selected === "string" ? selected : null;
}
