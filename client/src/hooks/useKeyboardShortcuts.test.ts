// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

function fireKey(key: string, targetOverride?: EventTarget) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true });
  if (targetOverride) {
    Object.defineProperty(event, "target", { value: targetOverride, writable: false });
  }
  document.dispatchEvent(event);
  return event;
}

describe("useKeyboardShortcuts", () => {
  let onPlayPause: ReturnType<typeof vi.fn>;
  let onPrevTrack: ReturnType<typeof vi.fn>;
  let onNextTrack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPlayPause = vi.fn();
    onPrevTrack = vi.fn();
    onNextTrack = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Space calls onPlayPause", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    fireKey(" ");
    expect(onPlayPause).toHaveBeenCalledOnce();
  });

  it("Comma calls onPrevTrack", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    fireKey(",");
    expect(onPrevTrack).toHaveBeenCalledOnce();
  });

  it("Period calls onNextTrack", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    fireKey(".");
    expect(onNextTrack).toHaveBeenCalledOnce();
  });

  it("F7 calls onPrevTrack", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    fireKey("F7");
    expect(onPrevTrack).toHaveBeenCalledOnce();
  });

  it("MediaTrackPrevious calls onPrevTrack", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    fireKey("MediaTrackPrevious");
    expect(onPrevTrack).toHaveBeenCalledOnce();
  });

  it("MediaPreviousTrack calls onPrevTrack", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    fireKey("MediaPreviousTrack");
    expect(onPrevTrack).toHaveBeenCalledOnce();
  });

  it("F9 calls onNextTrack", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    fireKey("F9");
    expect(onNextTrack).toHaveBeenCalledOnce();
  });

  it("MediaTrackNext calls onNextTrack", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    fireKey("MediaTrackNext");
    expect(onNextTrack).toHaveBeenCalledOnce();
  });

  it("MediaNextTrack calls onNextTrack", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    fireKey("MediaNextTrack");
    expect(onNextTrack).toHaveBeenCalledOnce();
  });

  it("Space is ignored when target is an INPUT element", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    const input = document.createElement("input");
    fireKey(" ", input);
    expect(onPlayPause).not.toHaveBeenCalled();
  });

  it("Comma is ignored when target is a TEXTAREA element", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    const textarea = document.createElement("textarea");
    fireKey(",", textarea);
    expect(onPrevTrack).not.toHaveBeenCalled();
  });

  it("Period is ignored when target is a SELECT element", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    const select = document.createElement("select");
    fireKey(".", select);
    expect(onNextTrack).not.toHaveBeenCalled();
  });

  it("Space is ignored when target has contenteditable=true", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }));
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    fireKey(" ", div);
    expect(onPlayPause).not.toHaveBeenCalled();
  });

  it("removes listener on unmount — no callbacks fired after", () => {
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ onPlayPause, onPrevTrack, onNextTrack }),
    );
    unmount();
    fireKey(" ");
    expect(onPlayPause).not.toHaveBeenCalled();
  });

  it("works with only some callbacks provided (optional props)", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause }));
    expect(() => fireKey(",")).not.toThrow();
    fireKey(" ");
    expect(onPlayPause).toHaveBeenCalledOnce();
  });
});
