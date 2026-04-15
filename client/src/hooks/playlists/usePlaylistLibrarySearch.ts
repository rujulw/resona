import { useMemo, useState } from "react";
import { TracksState } from "../../types/app";

export function usePlaylistLibrarySearch(tracksState: TracksState) {
  const [librarySearchDraft, setLibrarySearchDraft] = useState("");

  const visibleLibraryTracks = useMemo(() => {
    const normalizedLibrarySearch = librarySearchDraft.trim().toLowerCase();

    return tracksState.items.filter((track) => {
      if (!normalizedLibrarySearch) {
        return true;
      }

      return [track.title, track.artist, track.album]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedLibrarySearch));
    });
  }, [librarySearchDraft, tracksState.items]);

  return {
    librarySearchDraft,
    setLibrarySearchDraft,
    visibleLibraryTracks,
  };
}
