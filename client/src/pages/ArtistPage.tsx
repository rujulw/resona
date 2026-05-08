import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getArtistDetail } from "../desktop";
import type { ArtistDetail } from "../desktop";
import { ArtistDetailPanel } from "../components/ui/ArtistDetailPanel";

export function ArtistPage({ onPlayAlbum }: { onPlayAlbum?: (albumId: string) => Promise<void> }) {
  const { artistName } = useParams<{ artistName: string }>();
  const [detail, setDetail] = useState<ArtistDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const decodedName = artistName ? decodeURIComponent(artistName) : null;

  useEffect(() => {
    if (!decodedName) {
      setStatus("error");
      return;
    }

    setStatus("loading");
    void getArtistDetail(decodedName)
      .then((result) => {
        setDetail(result);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [decodedName]);

  if (status === "loading") {
    return (
      <div className="grid h-full place-items-center bg-black">
        <p className="text-sm text-[#8f8f8f]">Loading...</p>
      </div>
    );
  }

  if (status === "error" || !detail) {
    return (
      <div className="grid h-full place-items-center bg-black">
        <div className="grid gap-2 text-center">
          <p className="text-sm text-[#f2f2f2]">Artist not found.</p>
          <p className="text-sm text-[#8f8f8f]">{decodedName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0">
      <ArtistDetailPanel artistDetail={detail} onPlayAlbum={onPlayAlbum} />
    </div>
  );
}
