import { useEffect } from "react";

export type KeyboardShortcutHandlers = {
  onPlayPause?: () => void;
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
        case ",":
        case "F7":
        case "MediaPreviousTrack":
        case "MediaTrackPrevious":
          event.preventDefault();
          onPrevTrack?.();
          break;
        case ".":
        case "F9":
        case "MediaNextTrack":
        case "MediaTrackNext":
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
  }, [onPlayPause, onPrevTrack, onNextTrack]);
}
