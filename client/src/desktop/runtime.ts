import { invoke } from "@tauri-apps/api/core";

export function isBrowserPreviewRuntime(): boolean {
  if (typeof globalThis === "undefined") {
    return true;
  }

  return !("__TAURI_INTERNALS__" in globalThis) && !("__TAURI__" in globalThis);
}

export function rethrowInDesktopRuntime(error: unknown): never {
  throw error;
}

export async function invokeDesktop<TResponse, TPayload = undefined>(
  commandName: string,
  payload?: TPayload,
): Promise<TResponse> {
  if (payload === undefined) {
    return invoke<TResponse>(commandName);
  }

  return invoke<TResponse>(commandName, payload as Record<string, unknown>);
}

export async function invokeWithPreviewFallback<TResponse, TPayload = undefined>(
  commandName: string,
  payload: TPayload | undefined,
  fallback: () => TResponse | Promise<TResponse>,
): Promise<TResponse> {
  try {
    return await invokeDesktop<TResponse, TPayload>(commandName, payload);
  } catch (error) {
    if (!isBrowserPreviewRuntime()) {
      rethrowInDesktopRuntime(error);
    }

    return await fallback();
  }
}

export function normalizeOptionalText(value?: string | null): string | null {
  return value?.trim() ? value.trim() : null;
}

export function normalizeOptionalNumber(value?: number | null): number | null {
  return value ?? null;
}

export function normalizePlaylistMutationPayload(
  name: string,
  description?: string | null,
  artworkPath?: string | null,
): {
  name: string;
  description: string | null;
  artworkPath: string | null;
} {
  return {
    name,
    description: normalizeOptionalText(description),
    artworkPath: normalizeOptionalText(artworkPath),
  };
}

export function normalizeConceptAlbumMutationPayload(
  title: string,
  artist?: string | null,
  description?: string | null,
  artworkPath?: string | null,
): {
  title: string;
  artist: string | null;
  description: string | null;
  artworkPath: string | null;
} {
  return {
    title,
    artist: normalizeOptionalText(artist),
    description: normalizeOptionalText(description),
    artworkPath: normalizeOptionalText(artworkPath),
  };
}

export function normalizeTimingPayload(
  progressSeconds?: number,
  durationSeconds?: number,
): {
  progressSeconds: number | null;
  durationSeconds: number | null;
} {
  return {
    progressSeconds: normalizeOptionalNumber(progressSeconds),
    durationSeconds: normalizeOptionalNumber(durationSeconds),
  };
}

export function normalizePlaybackErrorPayload(transportLabel?: string): {
  transportLabel: string | null;
} {
  return {
    transportLabel: normalizeOptionalText(transportLabel),
  };
}
