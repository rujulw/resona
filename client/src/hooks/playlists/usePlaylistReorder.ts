import {
  type DragEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PlaylistEntryInput, PlaylistEntryItem } from "../../desktop";
import type { PlaylistsState } from "../../types/app";

type UsePlaylistReorderArgs = {
  activePlaylistId: string | null;
  activePlaylistEntries: PlaylistEntryItem[];
  activePlaylistUpdatedAt?: string;
  playlistsStatus: PlaylistsState["status"];
  onPlaylistEntriesReplace: (
    playlistId: string,
    entries: PlaylistEntryInput[],
  ) => void;
};

export function usePlaylistReorder({
  activePlaylistId,
  activePlaylistEntries,
  activePlaylistUpdatedAt,
  playlistsStatus,
  onPlaylistEntriesReplace,
}: UsePlaylistReorderArgs) {
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [optimisticEntries, setOptimisticEntries] = useState<
    PlaylistEntryItem[] | null
  >(null);
  const draggedEntryIdRef = useRef<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    entryId: string;
    placement: "before" | "after";
  } | null>(null);

  useEffect(() => {
    setOptimisticEntries(null);
  }, [activePlaylistId, activePlaylistUpdatedAt, activePlaylistEntries]);

  useEffect(() => {
    if (playlistsStatus === "error") {
      setOptimisticEntries(null);
    }
  }, [playlistsStatus]);

  const persistedOrderedPlaylistEntries = useMemo(
    () =>
      [...activePlaylistEntries].sort(
        (left, right) => left.position - right.position,
      ),
    [activePlaylistEntries],
  );

  const orderedPlaylistEntries =
    optimisticEntries ?? persistedOrderedPlaylistEntries;

  const resolveDragPlacement = (
    event: DragEvent<HTMLElement>,
    entryId: string,
  ): { entryId: string; placement: "before" | "after" } => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const midpoint = bounds.top + bounds.height / 2;
    const placement =
      bounds.height <= 1
        ? event.clientY > bounds.top
          ? "after"
          : "before"
        : event.clientY >= midpoint
          ? "after"
          : "before";

    return { entryId, placement };
  };

  const reorderEntries = (
    entries: PlaylistEntryItem[],
    movingEntryId: string,
    targetEntryId: string,
    placement: "before" | "after",
  ): PlaylistEntryItem[] | null => {
    const nextEntries = [...entries];
    const movingIndex = nextEntries.findIndex(
      (entry) => entry.entryId === movingEntryId,
    );
    const targetIndex = nextEntries.findIndex(
      (entry) => entry.entryId === targetEntryId,
    );

    if (movingIndex < 0 || targetIndex < 0) {
      return null;
    }

    const [movingEntry] = nextEntries.splice(movingIndex, 1);
    const insertIndex = nextEntries.findIndex(
      (entry) => entry.entryId === targetEntryId,
    );
    const boundedIndex = placement === "after" ? insertIndex + 1 : insertIndex;
    nextEntries.splice(boundedIndex, 0, movingEntry);

    if (
      nextEntries.every(
        (entry, index) => entry.entryId === entries[index]?.entryId,
      )
    ) {
      return null;
    }

    return nextEntries.map((entry, index) => ({
      ...entry,
      position: index,
    }));
  };

  const clearDropIndicator = (entryId?: string) => {
    setDropIndicator((existing) => {
      if (!existing) {
        return null;
      }

      if (entryId && existing.entryId !== entryId) {
        return existing;
      }

      return null;
    });
  };

  const resolveActiveDragEntryId = (
    event: DragEvent<HTMLElement>,
    selectedEntryId: string | null,
  ) =>
    draggedEntryIdRef.current ||
    draggedEntryId ||
    event.dataTransfer.getData("text/plain") ||
    selectedEntryId;

  const setResolvedDropIndicator = (
    entryId: string,
    placement: "before" | "after",
  ) => {
    setDropIndicator((existing) =>
      existing?.entryId === entryId && existing.placement === placement
        ? existing
        : { entryId, placement },
    );
  };
  
  const updateDropIndicatorFromPointer = (
    event: MouseEvent<HTMLElement>,
    entryId: string,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const midpoint = bounds.top + bounds.height / 2;
    const placement = event.clientY >= midpoint ? "after" : "before";
    setDropIndicator((existing) =>
      existing?.entryId === entryId && existing.placement === placement
        ? existing
        : { entryId, placement },
    );
  };

  const commitReorder = (
    movingEntryId: string,
    targetEntryId: string,
    placement: "before" | "after",
  ) => {
    if (!activePlaylistId || movingEntryId === targetEntryId) {
      draggedEntryIdRef.current = null;
      setDraggedEntryId(null);
      clearDropIndicator();
      return;
    }

    const nextEntries = reorderEntries(
      orderedPlaylistEntries,
      movingEntryId,
      targetEntryId,
      placement,
    );
    if (nextEntries) {
      setOptimisticEntries(nextEntries);
      onPlaylistEntriesReplace(
        activePlaylistId,
        nextEntries.map((nextEntry) => ({
          entryId: nextEntry.entryId,
          trackId: nextEntry.trackId,
          position: nextEntry.position,
        })),
      );
    }
    draggedEntryIdRef.current = null;
    setDraggedEntryId(null);
    clearDropIndicator();
  };

  useEffect(() => {
    if (!draggedEntryId) {
      return;
    }

    const clearDrag = () => {
      draggedEntryIdRef.current = null;
      setDraggedEntryId(null);
      clearDropIndicator();
    };

    window.addEventListener("mouseup", clearDrag);
    return () => {
      window.removeEventListener("mouseup", clearDrag);
    };
  }, [draggedEntryId]);

  return {
    draggedEntryId,
    setDraggedEntryId,
    draggedEntryIdRef,
    dropIndicator,
    orderedPlaylistEntries,
    resolveDragPlacement,
    clearDropIndicator,
    resolveActiveDragEntryId,
    updateDropIndicatorFromPointer,
    setResolvedDropIndicator,
    commitReorder,
  };
}
