import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe("desktop runtime helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    delete (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    delete (globalThis as typeof globalThis & { __TAURI__?: unknown }).__TAURI__;
  });

  it("calls invokeDesktop without a payload", async () => {
    invokeMock.mockResolvedValueOnce({ ok: true });

    const { invokeDesktop } = await import("./runtime");
    const payload = await invokeDesktop<{ ok: boolean }>("bootstrap_app");

    expect(invokeMock).toHaveBeenCalledWith("bootstrap_app");
    expect(payload).toEqual({ ok: true });
  });

  it("calls invokeDesktop with a payload", async () => {
    invokeMock.mockResolvedValueOnce({ ok: true });

    const { invokeDesktop } = await import("./runtime");
    const payload = await invokeDesktop<{ ok: boolean }, { trackId: string }>(
      "load_playback_track",
      {
        trackId: "track-1",
      },
    );

    expect(invokeMock).toHaveBeenCalledWith("load_playback_track", {
      trackId: "track-1",
    });
    expect(payload).toEqual({ ok: true });
  });

  it("returns invoke results when the bridge succeeds", async () => {
    invokeMock.mockResolvedValueOnce("ok");

    const { invokeWithPreviewFallback } = await import("./runtime");
    const payload = await invokeWithPreviewFallback("test_command", undefined, () => "fallback");

    expect(payload).toBe("ok");
  });

  it("returns preview fallback results in browser preview runtime", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));

    const { invokeWithPreviewFallback } = await import("./runtime");
    const payload = await invokeWithPreviewFallback("test_command", undefined, () => "fallback");

    expect(payload).toBe("fallback");
  });

  it("rethrows bridge failures in desktop runtime", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));
    (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ =
      {};

    const { invokeWithPreviewFallback } = await import("./runtime");

    await expect(
      invokeWithPreviewFallback("test_command", undefined, () => "fallback"),
    ).rejects.toThrow("bridge unavailable");
  });

  it("normalizes optional payload values in one place", async () => {
    const {
      normalizeOptionalText,
      normalizeOptionalNumber,
      normalizePlaylistMutationPayload,
      normalizeTimingPayload,
      normalizePlaybackErrorPayload,
    } = await import("./runtime");

    expect(normalizeOptionalText("  hello  ")).toBe("hello");
    expect(normalizeOptionalText("   ")).toBeNull();
    expect(normalizeOptionalNumber(0)).toBe(0);
    expect(normalizeOptionalNumber(undefined)).toBeNull();
    expect(normalizePlaylistMutationPayload("Desk Set", "  focused hours  ", "   ")).toEqual({
      name: "Desk Set",
      description: "focused hours",
      artworkPath: null,
    });
    expect(normalizeTimingPayload(undefined, 182)).toEqual({
      progressSeconds: null,
      durationSeconds: 182,
    });
    expect(normalizePlaybackErrorPayload("   ")).toEqual({
      transportLabel: null,
    });
  });
});
