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

export type AlbumSummary = {
  id: string;
  title: string;
  artist: string | null;
  trackCount: number;
  totalDurationSeconds: number | null;
  artworkKey: string | null;
};

export type AlbumTrackItem = {
  id: string;
  title: string;
  artist: string | null;
  advisory?: boolean | null;
  durationSeconds: number | null;
  artworkKey: string | null;
  extension?: string;
  trackNumber: number | null;
  discNumber: number | null;
};

export type AlbumDetail = {
  album: AlbumSummary;
  tracks: AlbumTrackItem[];
};

export type ArtistListItem = {
  name: string;
  albumCount: number;
  trackCount: number;
};

export type DiscographyAlbum = {
  id: string;
  title: string;
  year: number | null;
  artworkKey: string | null;
  trackCount: number;
  kind: "album" | "concept_album";
};

export type ArtistPlaylistItem = {
  id: string;
  title: string;
  artworkKey: string | null;
};

export type ArtistDetail = {
  name: string;
  albums: DiscographyAlbum[];
  features: DiscographyAlbum[];
  playlists: ArtistPlaylistItem[];
  trackCount: number;
  imageConfig: ArtistImageConfig | null;
};

export type ArtistImageConfig = {
  localImagePath: string;
};

export type ConceptAlbumSummary = {
  artworkPath: string | null;
  id: string;
  title: string;
  artist: string | null;
  description: string | null;
  artworkKey: string | null;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ConceptAlbumEntryItem = {
  entryId: string;
  conceptAlbumId: string;
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
  trackNumber: number | null;
  discNumber: number | null;
};

export type ConceptAlbumDetail = {
  conceptAlbum: ConceptAlbumSummary;
  entries: ConceptAlbumEntryItem[];
};

export type ConceptAlbumEntryInput = {
  entryId?: string;
  trackId: string;
  position: number;
};

export type PlaylistSummary = {
  artworkPath: string | null;
  id: string;
  name: string;
  description: string | null;
  artworkKey: string | null;
  entryCount: number;
  isMixtape: boolean;
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

export type ScorePartSummary = {
  id: string;
  name: string;
  measureCount: number;
  staffCount: number;
};

export type ScoreNoteEvent = {
  id: string;
  partId: string;
  partName: string;
  measureNumber: number;
  staff: number;
  voice: string;
  midi: number;
  noteName: string;
  startBeats: number;
  durationBeats: number;
  startSeconds: number | null;
  durationSeconds: number | null;
  isChordTone: boolean;
};

export type ScoreDetailPayload = {
  sourcePath: string;
  sourceName: string;
  sourceFormat: string;
  title: string;
  composer: string | null;
  tempoBpm: number | null;
  timeSignature: string | null;
  keySignature: string | null;
  totalBeats: number;
  totalSeconds: number | null;
  partCount: number;
  measureCount: number;
  noteCount: number;
  parts: ScorePartSummary[];
  events: ScoreNoteEvent[];
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
