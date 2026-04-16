import type { ShellState, TracksState } from "../../types/app";
import {
  selectIsRustOutputPlayback as selectShellIsRustOutputPlayback,
  selectPlaybackDurationSeconds as selectShellPlaybackDurationSeconds,
} from "../appShellSelectors";

export function selectIsRustOutputPlayback(shellState: ShellState | null) {
  return selectShellIsRustOutputPlayback(shellState);
}

export function selectPlaybackDurationSeconds(shellState: ShellState | null) {
  return selectShellPlaybackDurationSeconds(shellState);
}

export function selectActivePlaybackTrackId(
  shellState: ShellState | null,
  tracksState: TracksState,
) {
  return shellState?.playback.trackId ?? tracksState.selectedTrackId;
}

export function selectCurrentPlaybackProgressSeconds(
  shellState: ShellState | null,
  audioCurrentTime: number,
) {
  return selectIsRustOutputPlayback(shellState)
    ? shellState?.playback.progressSeconds ?? 0
    : audioCurrentTime;
}