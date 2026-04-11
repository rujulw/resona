import type {
  BootstrapPayload,
  LibraryRow,
  PlaylistDetail,
  PlaylistSummary,
  PlaybackQueueSnapshot,
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
  sourceLabel?: string;
};

export type TracksQueryState = {
  searchDraft: string;
  search: string;
  sortKey: "title" | "artist" | "album" | "indexed_at";
  sortDirection: "asc" | "desc";
};

export type PlaylistsState =
  | {
      status: "loading";
      items: PlaylistSummary[];
      activePlaylistId: string | null;
      activePlaylist: PlaylistDetail | null;
      playbackQueue: PlaybackQueueSnapshot | null;
      message?: string;
    }
  | {
      status: "ready";
      items: PlaylistSummary[];
      activePlaylistId: string | null;
      activePlaylist: PlaylistDetail | null;
      playbackQueue: PlaybackQueueSnapshot | null;
      message?: string;
    }
  | {
      status: "error";
      items: PlaylistSummary[];
      activePlaylistId: string | null;
      activePlaylist: PlaylistDetail | null;
      playbackQueue: PlaybackQueueSnapshot | null;
      message: string;
    };
