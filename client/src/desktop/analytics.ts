import { open } from "@tauri-apps/plugin-dialog";

import { invokeWithPreviewFallback } from "./runtime";
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

export async function importSpotifyHistoryFile(
  jsonPath: string,
  minMsPlayed?: number,
): Promise<SpotifyImportResult> {
  return invokeWithPreviewFallback(
    "import_spotify_history_file",
    { jsonPath, minMsPlayed: minMsPlayed ?? null },
    () => ({ matched: 0, skippedShort: 0, skippedNoMatch: 0, skippedDuplicate: 0 }),
  );
}
