
import type {
  ConceptAlbumsState,
  PlaylistsState,
  ShellState,
  TracksState,
} from "../../types/app";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { TrackListItem } from "../../desktop";

export type PlaybackAction = "previous" | "toggle" | "next";

export type PlaybackCoordinatorParams = {
  shellState: ShellState | null;
  tracksState: TracksState;
  playlistsState: PlaylistsState;
  conceptAlbumsState: ConceptAlbumsState;
  trackCatalogRef: MutableRefObject<Map<string, TrackListItem>>;
  setShellState: Dispatch<SetStateAction<ShellState | null>>;
  setTracksState: Dispatch<SetStateAction<TracksState>>;
  setPlaylistsState: Dispatch<SetStateAction<PlaylistsState>>;
};
