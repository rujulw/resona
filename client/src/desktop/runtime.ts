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