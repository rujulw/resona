import { useEffect, useState } from "react";
import type { PlaylistDetail } from "../../desktop";

export function usePlaylistEntrySelection(activePlaylist: PlaylistDetail | null) {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedEntryId) {
      return;
    }

    if (activePlaylist?.entries.some((entry) => entry.entryId === selectedEntryId)) {
      return;
    }

    setSelectedEntryId(null);
  }, [activePlaylist, selectedEntryId]);

  return {
    selectedEntryId,
    setSelectedEntryId,
  };
}
