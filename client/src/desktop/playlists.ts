import { browserShellStatePayload } from "./shell";
import {
  invokeWithPreviewFallback,
  normalizeOptionalText,
  normalizePlaylistMutationPayload,
} from "./runtime";
import type {
  PlaylistDetail,
  PlaylistEntryInput,
  PlaylistPlaybackHandoffPayload,
  PlaylistSummary,
  TrackListItem,
} from "./types";

let browserPlaylistCounter = 0;
let browserPlaylistEntryCounter = 0;
const browserPlaylists = new Map<string, PlaylistDetail>();

export async function listPlaylists(): Promise<PlaylistSummary[]> {
  return invokeWithPreviewFallback("list_playlists", undefined, () =>
    Array.from(browserPlaylists.values())
      .map((detail) => detail.playlist)
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
}

export async function getPlaylist(playlistId: string): Promise<PlaylistDetail | null> {
  return invokeWithPreviewFallback("get_playlist", { playlistId }, () =>
    browserPlaylists.get(playlistId) ?? null,
  );
}

export async function createPlaylist(
  name: string,
  description?: string | null,
  artworkPath?: string | null,
): Promise<PlaylistSummary> {
  return invokeWithPreviewFallback(
    "create_playlist",
    normalizePlaylistMutationPayload(name, description, artworkPath),
    () => {
      browserPlaylistCounter += 1;
      const now = `${Date.now()}`;
      const normalizedDescription = normalizeOptionalText(description);
      const normalizedArtworkPath = normalizeOptionalText(artworkPath);

      const playlist: PlaylistSummary = {
        id: `browser-playlist-${browserPlaylistCounter}`,
        name: name.trim(),
        description: normalizedDescription,
        artworkKey: normalizedArtworkPath
          ? `browser-playlist-artwork-${browserPlaylistCounter}`
          : null,
        entryCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      browserPlaylists.set(playlist.id, {
        playlist,
        entries: [],
      });

      return playlist;
    },
  );
}

export async function updatePlaylist(
  playlistId: string,
  name: string,
  description?: string | null,
  artworkPath?: string | null,
): Promise<PlaylistSummary> {
  return invokeWithPreviewFallback(
    "update_playlist",
    {
      playlistId,
      ...normalizePlaylistMutationPayload(name, description, artworkPath),
    },
    () => {
      const existing = browserPlaylists.get(playlistId);
      if (!existing) {
        throw new Error(`playlist ${playlistId} was not found`);
      }

      const normalizedDescription = normalizeOptionalText(description);
      const normalizedArtworkPath = normalizeOptionalText(artworkPath);

      const updatedSummary: PlaylistSummary = {
        ...existing.playlist,
        name: name.trim(),
        description: normalizedDescription,
        artworkKey: normalizedArtworkPath
          ? `browser-playlist-artwork-${playlistId}`
          : existing.playlist.artworkKey,
        updatedAt: `${Date.now()}`,
      };

      browserPlaylists.set(playlistId, {
        ...existing,
        playlist: updatedSummary,
      });

      return updatedSummary;
    },
  );
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  return invokeWithPreviewFallback("delete_playlist", { playlistId }, () => {
    browserPlaylists.delete(playlistId);
  });
}

export async function addTrackToPlaylist(
  playlistId: string,
  track: TrackListItem,
): Promise<PlaylistDetail> {
  return invokeWithPreviewFallback(
    "add_track_to_playlist",
    {
      playlistId,
      trackId: track.id,
    },
    () => {
      const existing = browserPlaylists.get(playlistId);
      if (!existing) {
        throw new Error(`playlist ${playlistId} was not found`);
      }

      browserPlaylistEntryCounter += 1;
      const nextEntry = {
        entryId: `browser-playlist-entry-${browserPlaylistEntryCounter}`,
        playlistId,
        trackId: track.id,
        position: existing.entries.length,
        addedAt: `${Date.now()}`,
        updatedAt: `${Date.now()}`,
        title: track.title,
        artist: track.artist,
        album: track.album,
        advisory: track.advisory ?? null,
        artworkKey: track.artworkKey,
        extension: track.extension,
        durationSeconds: track.durationSeconds,
      };

      const detail: PlaylistDetail = {
        playlist: {
          ...existing.playlist,
          entryCount: existing.entries.length + 1,
          updatedAt: `${Date.now()}`,
        },
        entries: [...existing.entries, nextEntry],
      };

      browserPlaylists.set(playlistId, detail);
      return detail;
    },
  );
}

export async function movePlaylistEntry(
  playlistId: string,
  entryId: string,
  targetPosition: number,
): Promise<PlaylistDetail> {
  return invokeWithPreviewFallback(
    "move_playlist_entry",
    {
      playlistId,
      entryId,
      targetPosition,
    },
    () => {
      const existing = browserPlaylists.get(playlistId);
      if (!existing) {
        throw new Error(`playlist ${playlistId} was not found`);
      }

      const nextEntries = [...existing.entries];
      const currentIndex = nextEntries.findIndex((entry) => entry.entryId === entryId);
      if (currentIndex < 0) {
        throw new Error(`playlist entry ${entryId} was not found`);
      }

      const [movedEntry] = nextEntries.splice(currentIndex, 1);
      const boundedTarget = Math.max(0, Math.min(targetPosition, nextEntries.length));
      nextEntries.splice(boundedTarget, 0, movedEntry);

      const detail: PlaylistDetail = {
        playlist: {
          ...existing.playlist,
          updatedAt: `${Date.now()}`,
        },
        entries: nextEntries.map((entry, index) => ({
          ...entry,
          position: index,
        })),
      };

      browserPlaylists.set(playlistId, detail);
      return detail;
    },
  );
}

export async function replacePlaylistEntries(
  playlistId: string,
  entries: PlaylistEntryInput[],
): Promise<PlaylistDetail> {
  return invokeWithPreviewFallback(
    "replace_playlist_entries",
    {
      playlistId,
      entries,
    },
    () => {
      const existing = browserPlaylists.get(playlistId);
      if (!existing) {
        throw new Error(`playlist ${playlistId} was not found`);
      }

      const trackByEntryId = new Map(existing.entries.map((entry) => [entry.entryId, entry]));
      const now = `${Date.now()}`;

      const nextEntries = entries.map((entry, index) => {
        const existingEntry =
          entry.entryId != null ? trackByEntryId.get(entry.entryId) : undefined;

        if (existingEntry) {
          return {
            ...existingEntry,
            position: index,
            updatedAt: now,
          };
        }

        browserPlaylistEntryCounter += 1;
        return {
          entryId: `browser-playlist-entry-${browserPlaylistEntryCounter}`,
          playlistId,
          trackId: entry.trackId,
          position: index,
          addedAt: now,
          updatedAt: now,
          title: entry.trackId,
          artist: null,
          album: null,
          advisory: null,
          artworkKey: null,
          extension: "mp3",
          durationSeconds: null,
        };
      });

      const detail: PlaylistDetail = {
        playlist: {
          ...existing.playlist,
          entryCount: nextEntries.length,
          updatedAt: now,
        },
        entries: nextEntries,
      };

      browserPlaylists.set(playlistId, detail);
      return detail;
    },
  );
}

export async function removePlaylistEntry(
  playlistId: string,
  entryId: string,
): Promise<PlaylistDetail> {
  return invokeWithPreviewFallback(
    "remove_playlist_entry",
    {
      playlistId,
      entryId,
    },
    () => {
      const existing = browserPlaylists.get(playlistId);
      if (!existing) {
        throw new Error(`playlist ${playlistId} was not found`);
      }

      const nextEntries = existing.entries.filter((entry) => entry.entryId !== entryId);
      if (nextEntries.length === existing.entries.length) {
        throw new Error(`playlist entry ${entryId} was not found`);
      }

      const detail: PlaylistDetail = {
        playlist: {
          ...existing.playlist,
          entryCount: nextEntries.length,
          updatedAt: `${Date.now()}`,
        },
        entries: nextEntries.map((entry, index) => ({
          ...entry,
          position: index,
        })),
      };

      browserPlaylists.set(playlistId, detail);
      return detail;
    },
  );
}

export async function handoffPlaylistToQueue(
  playlistId: string,
  startEntryId?: string | null,
): Promise<PlaylistPlaybackHandoffPayload> {
  return invokeWithPreviewFallback(
    "handoff_playlist_to_queue",
    {
      playlistId,
      startEntryId: startEntryId ?? null,
    },
    () => {
      const detail = browserPlaylists.get(playlistId);
      if (!detail || detail.entries.length === 0) {
        throw new Error(`playlist ${playlistId} was not found`);
      }

      const activeEntry =
        detail.entries.find((entry) => entry.entryId === (startEntryId ?? "")) ??
        detail.entries[0];

      return {
        playback: {
          ...browserShellStatePayload.playback,
          statusLabel: "Ready",
          transportLabel: "Ready",
          outputOwner: "frontend",
          trackId: activeEntry.trackId,
          trackTitle: activeEntry.title,
          trackArtist: activeEntry.artist,
          trackAlbum: activeEntry.album,
          trackAdvisory: activeEntry.advisory ?? null,
          durationSeconds: activeEntry.durationSeconds
            ? Math.round(activeEntry.durationSeconds)
            : 0,
        },
        queue: {
          trackIds: detail.entries.map((entry) => entry.trackId),
          activeTrackId: activeEntry.trackId,
          sourceLabel: "playlist-handoff",
        },
        playlistId,
        activeEntryId: activeEntry.entryId,
      };
    },
  );
}
