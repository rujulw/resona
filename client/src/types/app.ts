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
  | { status: "loading"; items: TrackListItem[]; total: number; selectedTrackId: string | null }
  | { status: "ready"; items: TrackListItem[]; total: number; selectedTrackId: string | null }
  | {
      status: "error";
      items: TrackListItem[];
      total: number;
      selectedTrackId: string | null;
      message: string;
    };

export type ScanState =
  | { status: "idle"; message: string }
  | { status: "running"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };
