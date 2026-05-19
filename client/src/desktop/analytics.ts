import { open } from "@tauri-apps/plugin-dialog";

import { invokeDesktop, invokeWithPreviewFallback } from "./runtime";
import type {
  SpotifyImportResult,
  TopArtistEntry,
  TopTrackEntry,
  TrackPlayStats,
} from "./types";

export async function queryTopTracks(
  windowDays?: number,
  limit?: number,
): Promise<TopTrackEntry[]> {
  return invokeWithPreviewFallback(
    "query_top_tracks",
    { windowDays: windowDays ?? null, limit: limit ?? null },
    () => [],
  );
}

export async function queryTopArtists(
  windowDays?: number,
  limit?: number,
): Promise<TopArtistEntry[]> {
  return invokeWithPreviewFallback(
    "query_top_artists",
    { windowDays: windowDays ?? null, limit: limit ?? null },
    () => [],
  );
}

export async function queryTrackPlayStats(
  trackId: string,
): Promise<TrackPlayStats | null> {
  return invokeWithPreviewFallback(
    "query_track_play_stats",
    { trackId },
    () => null,
  );
}

export async function pickSpotifyExportFile(): Promise<string | null> {
  const selected = await open({
    title: "Choose Spotify StreamingHistory file",
    directory: false,
    multiple: false,
    recursive: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export async function pickSpotifyExportFolder(): Promise<string | null> {
  const selected = await open({
    title: "Choose Spotify export folder (containing Streaming_History_Audio_*.json files)",
    directory: true,
    multiple: false,
    recursive: false,
  });
  return typeof selected === "string" ? selected : null;
}

export async function importSpotifyHistoryFile(
  jsonPath: string,
  minMsPlayed?: number,
): Promise<SpotifyImportResult> {
  return invokeDesktop("import_spotify_history_file", {
    jsonPath,
    minMsPlayed: minMsPlayed ?? null,
  });
}

export async function importSpotifyHistoryFolder(
  folderPath: string,
  minMsPlayed?: number,
): Promise<SpotifyImportResult> {
  return invokeDesktop("import_spotify_history_folder", {
    folderPath,
    minMsPlayed: minMsPlayed ?? null,
  });
}
