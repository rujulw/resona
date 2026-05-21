import { useEffect } from "react";

export type KeyboardShortcutHandlers = {
  onPlayPause?: () => void;
  onSeekBack?: () => void;
  onSeekForward?: () => void;
  onPrevTrack?: () => void;
  onNextTrack?: () => void;
};

function isInputTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) {
    return false;
  }

  const tag = target.tagName.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }

  return target.getAttribute("contenteditable") === "true";
}

export function useKeyboardShortcuts({
  onPlayPause,
  onSeekBack,
  onSeekForward,
  onPrevTrack,
  onNextTrack,
}: KeyboardShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInputTarget(event.target)) {
        return;
      }

      switch (event.key) {
        case " ":
          event.preventDefault();
          onPlayPause?.();
          break;
        case "ArrowLeft":
          event.preventDefault();
          onSeekBack?.();
          break;
        case "ArrowRight":
          event.preventDefault();
          onSeekForward?.();
          break;
        case ",":
          event.preventDefault();
          onPrevTrack?.();
          break;
        case ".":
          event.preventDefault();
          onNextTrack?.();
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onPlayPause, onSeekBack, onSeekForward, onPrevTrack, onNextTrack]);
}
