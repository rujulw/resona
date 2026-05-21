import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import { listen } from "@tauri-apps/api/event";

import { subscribePlaybackState } from "../../desktop";
import type { ShellState } from "../../types/app";

export type MediaKeyHandlers = {
  onPlayPause: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
};

export function usePlaybackRuntimeBridge({
  setShellState,
  mediaKeys,
}: {
  setShellState: Dispatch<SetStateAction<ShellState | null>>;
  mediaKeys: MediaKeyHandlers;
}) {
  useEffect(() => {
    let detached = false;
    let unlisten: (() => void) | undefined;

    void subscribePlaybackState((playback) => {
      if (detached) {
        return;
      }

      setShellState((existing) => {
        if (!existing) {
          return existing;
        }

        return {
          ...existing,
          playback: {
            ...existing.playback,
            ...playback,
            isPlaying: playback.isPlaying ?? existing.playback.isPlaying ?? false,
            trackId: playback.trackId ?? existing.playback.trackId ?? null,
            trackTitle: playback.trackTitle ?? existing.playback.trackTitle ?? null,
            trackArtist: playback.trackArtist ?? existing.playback.trackArtist ?? null,
            trackAlbum: playback.trackAlbum ?? existing.playback.trackAlbum ?? null,
            trackAdvisory:
              playback.trackAdvisory ?? existing.playback.trackAdvisory ?? null,
          },
        };
      });
    }).then((dispose) => {
      if (detached) {
        dispose();
        return;
      }

      unlisten = dispose;
    });

    return () => {
      detached = true;
      unlisten?.();
    };
  }, [setShellState]);

  useEffect(() => {
    let detached = false;
    const unlisteners: Array<() => void> = [];

    void Promise.all([
      listen("media-play-pause", () => {
        if (!detached) mediaKeys.onPlayPause();
      }),
      listen("media-next-track", () => {
        if (!detached) mediaKeys.onNextTrack();
      }),
      listen("media-prev-track", () => {
        if (!detached) mediaKeys.onPrevTrack();
      }),
    ]).then((disposes) => {
      if (detached) {
        disposes.forEach((d) => d());
        return;
      }
      unlisteners.push(...disposes);
    });

    return () => {
      detached = true;
      unlisteners.forEach((d) => d());
    };
    // mediaKeys object identity changes each render — destructure stable refs instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaKeys.onPlayPause, mediaKeys.onNextTrack, mediaKeys.onPrevTrack]);
}
