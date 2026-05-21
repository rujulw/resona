import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import { subscribePlaybackState } from "../../desktop";
import type { ShellState } from "../../types/app";

export function usePlaybackRuntimeBridge({
  setShellState,
}: {
  setShellState: Dispatch<SetStateAction<ShellState | null>>;
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
}
