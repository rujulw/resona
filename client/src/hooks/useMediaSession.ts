import { useEffect } from "react";

import { convertFileSrc } from "@tauri-apps/api/core";

import { updateNowPlaying } from "../desktop";

export type MediaSessionTrack = {
  title: string;
  artist: string | null;
  album: string | null;
  artworkKey: string | null;
  durationSecs: number | null;
  progressSecs: number | null;
};

export type MediaSessionHandlers = {
  onPlayPause: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSeekBackward: (offset?: number) => void;
  onSeekForward: (offset?: number) => void;
};

export function useMediaSession({
  track,
  isPlaying,
  handlers,
}: {
  track: MediaSessionTrack | null;
  isPlaying: boolean;
  handlers: MediaSessionHandlers;
}) {
  // Update metadata when track changes
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const artwork: MediaImage[] = [];
    if (track.artworkKey) {
      const src = convertFileSrc(track.artworkKey);
      artwork.push({ src, sizes: "512x512", type: "image/jpeg" });
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist ?? undefined,
      album: track.album ?? undefined,
      artwork,
    });

    void updateNowPlaying({
      title: track.title,
      artist: track.artist ?? "",
      album: track.album ?? null,
      artworkUrl: track.artworkKey ? convertFileSrc(track.artworkKey) : null,
      durationSecs: track.durationSecs,
      positionSecs: track.progressSecs,
      isPlaying,
    });
    // isPlaying intentionally excluded — nowPlaying track-change fires once per track load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.title, track?.artist, track?.album, track?.artworkKey]);

  // Sync playback state
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // Register action handlers — stable across renders via the effect cleanup pattern
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => handlers.onPlayPause());
    navigator.mediaSession.setActionHandler("pause", () => handlers.onPlayPause());
    navigator.mediaSession.setActionHandler("nexttrack", () => handlers.onNextTrack());
    navigator.mediaSession.setActionHandler("previoustrack", () => handlers.onPrevTrack());
    navigator.mediaSession.setActionHandler("seekbackward", (details) =>
      handlers.onSeekBackward(details.seekOffset),
    );
    navigator.mediaSession.setActionHandler("seekforward", (details) =>
      handlers.onSeekForward(details.seekOffset),
    );

    return () => {
      if (!("mediaSession" in navigator)) return;
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers.onPlayPause, handlers.onNextTrack, handlers.onPrevTrack, handlers.onSeekBackward, handlers.onSeekForward]);
}
