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
  let onSeekBack: ReturnType<typeof vi.fn>;
  let onSeekForward: ReturnType<typeof vi.fn>;
  let onPrevTrack: ReturnType<typeof vi.fn>;
  let onNextTrack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPlayPause = vi.fn();
    onSeekBack = vi.fn();
    onSeekForward = vi.fn();
    onPrevTrack = vi.fn();
    onNextTrack = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Space calls onPlayPause", () => {
    renderHook(() =>
      useKeyboardShortcuts({ onPlayPause, onSeekBack, onSeekForward, onPrevTrack, onNextTrack }),
    );
    fireKey(" ");
    expect(onPlayPause).toHaveBeenCalledOnce();
  });

  it("ArrowLeft calls onSeekBack", () => {
    renderHook(() =>
      useKeyboardShortcuts({ onPlayPause, onSeekBack, onSeekForward, onPrevTrack, onNextTrack }),
    );
    fireKey("ArrowLeft");
    expect(onSeekBack).toHaveBeenCalledOnce();
  });

  it("ArrowRight calls onSeekForward", () => {
    renderHook(() =>
      useKeyboardShortcuts({ onPlayPause, onSeekBack, onSeekForward, onPrevTrack, onNextTrack }),
    );
    fireKey("ArrowRight");
    expect(onSeekForward).toHaveBeenCalledOnce();
  });

  it("Comma calls onPrevTrack", () => {
    renderHook(() =>
      useKeyboardShortcuts({ onPlayPause, onSeekBack, onSeekForward, onPrevTrack, onNextTrack }),
    );
    fireKey(",");
    expect(onPrevTrack).toHaveBeenCalledOnce();
  });

  it("Period calls onNextTrack", () => {
    renderHook(() =>
      useKeyboardShortcuts({ onPlayPause, onSeekBack, onSeekForward, onPrevTrack, onNextTrack }),
    );
    fireKey(".");
    expect(onNextTrack).toHaveBeenCalledOnce();
  });

  it("Space is ignored when target is an INPUT element", () => {
    renderHook(() =>
      useKeyboardShortcuts({ onPlayPause, onSeekBack, onSeekForward, onPrevTrack, onNextTrack }),
    );
    const input = document.createElement("input");
    fireKey(" ", input);
    expect(onPlayPause).not.toHaveBeenCalled();
  });

  it("ArrowLeft is ignored when target is a TEXTAREA element", () => {
    renderHook(() =>
      useKeyboardShortcuts({ onPlayPause, onSeekBack, onSeekForward, onPrevTrack, onNextTrack }),
    );
    const textarea = document.createElement("textarea");
    fireKey("ArrowLeft", textarea);
    expect(onSeekBack).not.toHaveBeenCalled();
  });

  it("ArrowRight is ignored when target is a SELECT element", () => {
    renderHook(() =>
      useKeyboardShortcuts({ onPlayPause, onSeekBack, onSeekForward, onPrevTrack, onNextTrack }),
    );
    const select = document.createElement("select");
    fireKey("ArrowRight", select);
    expect(onSeekForward).not.toHaveBeenCalled();
  });

  it("Space is ignored when target has contenteditable=true", () => {
    renderHook(() =>
      useKeyboardShortcuts({ onPlayPause, onSeekBack, onSeekForward, onPrevTrack, onNextTrack }),
    );
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    fireKey(" ", div);
    expect(onPlayPause).not.toHaveBeenCalled();
  });

  it("removes listener on unmount — no callbacks fired after", () => {
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ onPlayPause, onSeekBack, onSeekForward, onPrevTrack, onNextTrack }),
    );
    unmount();
    fireKey(" ");
    expect(onPlayPause).not.toHaveBeenCalled();
  });

  it("works with only some callbacks provided (optional props)", () => {
    renderHook(() => useKeyboardShortcuts({ onPlayPause }));
    // ArrowLeft has no handler — should not throw
    expect(() => fireKey("ArrowLeft")).not.toThrow();
    fireKey(" ");
    expect(onPlayPause).toHaveBeenCalledOnce();
  });
});
