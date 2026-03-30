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

export type ImportSummary = {
  libraryRootId: string;
  libraryRootName: string;
  rootPath: string;
  discoveredTracks: number;
  insertedTracks: number;
  updatedTracks: number;
  removedTracks: number;
};

export type ScanState =
  | { status: "idle"; message: string; lastScan: ImportSummary | null }
  | { status: "running"; message: string; lastScan: ImportSummary | null }
  | { status: "success"; message: string; lastScan: ImportSummary | null }
  | { status: "error"; message: string; lastScan: ImportSummary | null };

export type QueueState = {
  activeTrack: TrackListItem | null;
  upcomingTracks: TrackListItem[];
  totalTracks: number;
};
