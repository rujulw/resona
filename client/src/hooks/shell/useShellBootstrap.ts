

import { useRef, useState } from "react";

import type { TrackListItem } from "../../desktop";
import type { TracksQueryState, TracksState } from "../../types/app";
import { existingSelectedTrackId, fetchAllTracks, mergeTrackCatalog } from "../appShellShared";
import { getNextTracksAlbumHeaderSort, getNextTracksTitleHeaderSort, toAsyncErrorMessage } from "./shellQueryShared";

type UseTracksQueryArgs = {
  trackCatalogRef: React.MutableRefObject<Map<string, TrackListItem>>;
};

export function useTracksQuery({ trackCatalogRef }: UseTracksQueryArgs) {
  const tracksRequestIdRef = useRef(0);
  const [tracksState, setTracksState] = useState<TracksState>({
    status: "loading",
    items: [],
    total: 0,
    selectedTrackId: null,
  });
  const [tracksQueryState, setTracksQueryState] = useState<TracksQueryState>({
    searchDraft: "",
    search: "",
    sortKey: "title",
    sortDirection: "asc",
  });

  const refreshTracks = (overrides?: Partial<TracksQueryState>) => {
    const effectiveQuery = {
      ...tracksQueryState,
      ...overrides,
    };
    const requestId = tracksRequestIdRef.current + 1;
    tracksRequestIdRef.current = requestId;

    setTracksState((existing) => ({
      ...existing,
      status: "loading",
    }));

    void fetchAllTracks({
      search: effectiveQuery.search || null,
      sortKey: effectiveQuery.sortKey,
      sortDirection: effectiveQuery.sortDirection,
    })
      .then((libraryPage) => {
        if (tracksRequestIdRef.current !== requestId) {
          return;
        }

        mergeTrackCatalog(trackCatalogRef.current, libraryPage.items);
        setTracksState((existing) => ({
          status: "ready",
          items: libraryPage.items,
          total: libraryPage.total,
          selectedTrackId: existingSelectedTrackId(
            libraryPage.items,
            existing.selectedTrackId,
          ),
        }));
        setTracksQueryState((existing) => ({
          ...existing,
          ...overrides,
        }));
      })
      .catch((error: unknown) => {
        if (tracksRequestIdRef.current !== requestId) {
          return;
        }

        setTracksState({
          status: "error",
          items: [],
          total: 0,
          selectedTrackId: null,
          message: toAsyncErrorMessage(error, "Failed to load track library."),
        });
        setTracksQueryState((existing) => ({
          ...existing,
          ...overrides,
        }));
      });
  };

  const handleTracksSearchDraftChange = (value: string) => {
    setTracksQueryState((existing) => ({
      ...existing,
      searchDraft: value,
    }));
  };

  const handleTracksSearchSubmit = () => {
    refreshTracks({
      search: tracksQueryState.searchDraft.trim(),
    });
  };

  const handleTracksTitleHeaderSort = () => {
    const nextSort = getNextTracksTitleHeaderSort(tracksQueryState);

    refreshTracks({
      ...nextSort,
    });
  };

  const handleTracksAlbumHeaderSort = () => {
    const nextSort = getNextTracksAlbumHeaderSort(tracksQueryState);

    refreshTracks({
      ...nextSort,
    });
  };

  return {
    tracksState,
    setTracksState,
    tracksQueryState,
    setTracksQueryState,
    refreshTracks,
    handleTracksSearchDraftChange,
    handleTracksSearchSubmit,
    handleTracksTitleHeaderSort,
    handleTracksAlbumHeaderSort,
  };
}