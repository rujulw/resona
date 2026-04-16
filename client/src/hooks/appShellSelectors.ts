import type { ShellState } from "../types/app";

export function selectIsRustOutputPlayback(shellState: ShellState | null) {
  return shellState?.playback.outputOwner === "rust";
}

export function selectPlaybackDurationSeconds(shellState: ShellState | null) {
  return shellState?.playback.durationSeconds ?? 0;
}
