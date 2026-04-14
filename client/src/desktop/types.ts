export type BootstrapPayload = {
  appName: string;
  appVersion: string;
  windowTitle: string;
  platform: string;
  runtime: {
    desktopShell: string;
    frontend: string;
    core: string;
  };
};

export type NavSection = {
  id: string;
  label: string;
};

export type LibraryRow = {
  title: string;
  detail: string;
  state: string;
};

export type PlaybackShellState = {
  statusLabel: string;
  transportLabel: string;
  outputOwner?: string;
  progressSeconds: number;
  durationSeconds: number;
  isPlaying?: boolean;
  trackId?: string | null;
  trackTitle?: string | null;
  trackArtist?: string | null;
  trackAlbum?: string | null;
  trackAdvisory?: boolean | null;
};

export type PlaybackCommandContract = {
  name: string;
  summary: string;
  requestShape: string;
  responseShape: string;
  authority: string;
};

export type PlaybackEventContract = {
  name: string;
  summary: string;
  payloadShape: string;
  delivery: string;
};

export type PlaybackContractPayload = {
  currentOwner: string;
  migrationTarget: string;
  runtimeBoundary: string;
  sourceResolutionOrder: string[];
  commands: PlaybackCommandContract[];
  events: PlaybackEventContract[];
  guarantees: string[];
};

export type PlaybackSource = {
  trackId: string;
  localPath: string;
  extension?: string;
  assetUrl: string;
};

export type LoadedPlaybackTrackPayload = {
  playback: PlaybackShellState;
  source: PlaybackSource;
};

export type UnlistenPlaybackState = () => void;

export type ArtworkSource = {
  artworkKey: string;
  localPath: string;
  assetUrl: string;
};

export type ShellStatePayload = {
  navSections: NavSection[];
  libraryRows: LibraryRow[];
  playback: PlaybackShellState;
};

export type ScanSummary = {
  libraryRootId: string;
  libraryRootName: string;
  rootPath: string;
  discoveredTracks: number;
  insertedTracks: number;
  updatedTracks: number;
  removedTracks: number;
};

export type TrackListItem = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  advisory?: boolean | null;
  durationSeconds: number | null;
  artworkKey: string | null;
  relativePath: string;
  extension?: string;
  sourceStatus: string;
  cacheState: string;
  analysisStatus: string;
  indexedAt: string;
};

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  artworkKey: string | null;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PlaylistEntryItem = {
  entryId: string;
  playlistId: string;
  trackId: string;
  position: number;
  addedAt: string;
  updatedAt: string;
  title: string;
  artist: string | null;
  album: string | null;
  advisory?: boolean | null;
  artworkKey: string | null;
  extension?: string;
  durationSeconds: number | null;
};

export type PlaylistDetail = {
  playlist: PlaylistSummary;
  entries: PlaylistEntryItem[];
};

export type PlaylistEntryInput = {
  entryId?: string;
  trackId: string;
  position: number;
};

export type PlaybackQueueSnapshot = {
  trackIds: string[];
  activeTrackId: string | null;
  sourceLabel: string;
};

export type PlaylistPlaybackHandoffPayload = {
  playback: PlaybackShellState;
  queue: PlaybackQueueSnapshot;
  playlistId: string;
  activeEntryId: string;
};

export type LibraryPagePayload = {
  items: TrackListItem[];
  nextCursor: string | null;
  total: number;
  pageSize: number;
};