import type {
  AlbumDetail,
  AlbumSummary,
  ArtistDetail,
  BootstrapPayload,
  ConceptAlbumDetail,
  ConceptAlbumSummary,
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

export type AlbumsState =
  | {
      status: "loading";
      items: AlbumSummary[];
      activeAlbumId: string | null;
      activeAlbum: AlbumDetail | null;
      message?: string;
    }
  | {
      status: "ready";
      items: AlbumSummary[];
      activeAlbumId: string | null;
      activeAlbum: AlbumDetail | null;
      message?: string;
    }
  | {
      status: "error";
      items: AlbumSummary[];
      activeAlbumId: string | null;
      activeAlbum: AlbumDetail | null;
      message: string;
    };

export type ConceptAlbumsState =
  | {
      status: "loading";
      items: ConceptAlbumSummary[];
      activeConceptAlbumId: string | null;
      activeConceptAlbum: ConceptAlbumDetail | null;
      message?: string;
    }
  | {
      status: "ready";
      items: ConceptAlbumSummary[];
      activeConceptAlbumId: string | null;
      activeConceptAlbum: ConceptAlbumDetail | null;
      message?: string;
    }
  | {
      status: "error";
      items: ConceptAlbumSummary[];
      activeConceptAlbumId: string | null;
      activeConceptAlbum: ConceptAlbumDetail | null;
      message: string;
    };

export type HomeRouteState = {
  tracksState: TracksState;
  albumsState: AlbumsState;
  playlistsState: PlaylistsState;
  conceptAlbumsState: ConceptAlbumsState;
};

export type TracksRouteState = {
  libraryPath: string;
  scanState: ScanState;
  tracksQueryState: TracksQueryState;
  tracksState: TracksState;
  albumsState: AlbumsState;
};

export type PlaylistsRouteState = {
  playlistsState: PlaylistsState;
  tracksState: TracksState;
  albumsState: AlbumsState;
};

export type QueueRouteState = {
  queueState: QueueState;
};

export type AlbumsRouteState = {
  albumsState: AlbumsState;
};

export type ArtistPageState =
  | { status: "loading" }
  | { status: "ready"; detail: ArtistDetail }
  | { status: "error"; message: string };

export type ConceptAlbumsRouteState = {
  conceptAlbumsState: ConceptAlbumsState;
  tracksState: TracksState;
  albumsState: AlbumsState;
};

export type SettingsRouteState = {
  libraryPath: string;
  platformLabel: string;
  appVersion: string;
  scanState: ScanState;
};

export type AppShellChromeState = {
  appName: string;
  runtimeLabel: string;
  playlists: PlaylistSummary[];
  conceptAlbums: ConceptAlbumSummary[];
  queueState: QueueState;
  playback: PlaybackShellState;
};

export type AppShellRoutesState = {
  home: HomeRouteState;
  tracks: TracksRouteState;
  playlists: PlaylistsRouteState;
  albums: AlbumsRouteState;
  conceptAlbums: ConceptAlbumsRouteState;
  queue: QueueRouteState;
  settings: SettingsRouteState;
};

export type PlaylistRouteActions = {
  onCreatePlaylist: (
    name: string,
    description?: string | null,
    artworkPath?: string | null,
  ) => Promise<string | null>;
  onPlaylistArtworkChange: (playlistId: string, artworkPath: string) => void;
  onPlaylistDelete: (playlistId: string) => void;
  onPlaylistEntryMove: (playlistId: string, entryId: string, targetPosition: number) => void;
  onPlaylistEntriesReplace: (
    playlistId: string,
    entries: Array<{ entryId?: string; trackId: string; position: number }>,
  ) => void;
  onPlaylistEntryRemove: (playlistId: string, entryId: string) => void;
  onPlaylistPlaybackHandoff: (playlistId: string, startEntryId?: string) => void;
  onPlaylistRename: (
    playlistId: string,
    name: string,
    description?: string | null,
    artworkPath?: string | null,
  ) => void;
  onPlaylistSelect: (playlistId: string) => void;
  onPlaylistTurnToMixtape: (playlistId: string) => void;
  onTrackAdd: (playlistId: string, track: TrackListItem) => void;
};

export type TracksRouteActions = {
  onTrackSelect: (track: TrackListItem) => void;
  onTracksSearchDraftChange: (value: string) => void;
  onTracksSearchSubmit: () => void;
  onTracksTitleHeaderSort: () => void;
  onTracksAlbumHeaderSort: () => void;
};

export type AlbumsRouteActions = {
  onAlbumSelect: (albumId: string) => void;
  onAlbumPlaybackHandoff: (albumId: string, startTrackId?: string) => void;
  onAlbumTrackSelect: (trackId: string) => void;
  onPlayAlbumById: (albumId: string) => Promise<void>;
};

export type ConceptAlbumsRouteActions = {
  onConceptAlbumCreate: (
    title: string,
    artist?: string | null,
    description?: string | null,
    artworkPath?: string | null,
  ) => Promise<string | null>;
  onConceptAlbumArtworkChange: (conceptAlbumId: string, artworkPath: string) => void;
  onConceptAlbumDelete: (conceptAlbumId: string) => void;
  onConceptAlbumEntryMove: (
    conceptAlbumId: string,
    entryId: string,
    targetPosition: number,
  ) => void;
  onConceptAlbumEntriesReplace: (
    conceptAlbumId: string,
    entries: Array<{ entryId?: string; trackId: string; position: number }>,
  ) => void;
  onConceptAlbumEntryRemove: (conceptAlbumId: string, entryId: string) => void;
  onConceptAlbumPlaybackHandoff: (
    conceptAlbumId: string,
    startEntryId?: string,
  ) => void;
  onConceptAlbumRename: (
    conceptAlbumId: string,
    title: string,
    artist?: string | null,
    description?: string | null,
    artworkPath?: string | null,
  ) => void;
  onConceptAlbumSelect: (conceptAlbumId: string) => void;
  onConceptAlbumTrackAdd: (conceptAlbumId: string, track: TrackListItem) => void;
};

export type SettingsRouteActions = {
  onPickLibraryDirectory: () => void;
  onScan: () => void;
};

export type PlaybackChromeActions = {
  onPlaybackAction: (action: "previous" | "toggle" | "next") => void;
  onPlaybackSeek: (positionSeconds: number) => void;
};

export type HomeRouteActions = {
  onTrackSelect: (track: TrackListItem) => void;
};

export type AppShellRouteActions = {
  home: HomeRouteActions;
  playlists: PlaylistRouteActions;
  tracks: TracksRouteActions;
  albums: AlbumsRouteActions;
  conceptAlbums: ConceptAlbumsRouteActions;
  settings: SettingsRouteActions;
};

export type AppShellViewModel = {
  chrome: AppShellChromeState;
  routes: AppShellRoutesState;
  actions: AppShellRouteActions;
  playback: PlaybackChromeActions;
};
