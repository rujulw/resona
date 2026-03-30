import type {
  BootstrapPayload,
  LibraryRow,
  PlaybackShellState,
  TrackListItem,
} from "../desktop";

export type BootstrapState =
  | { status: "loading" }
  | { status: "ready"; payload: BootstrapPayload }
  | { status: "error"; message: string };

export type ShellState = {
  libraryRows: LibraryRow[];
  playback: PlaybackShellState;
};

export type TracksState =
  | { status: "loading"; items: TrackListItem[]; total: number }
  | { status: "ready"; items: TrackListItem[]; total: number }
  | { status: "error"; items: TrackListItem[]; total: number; message: string };

export type ScanState =
  | { status: "idle"; message: string }
  | { status: "running"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };
