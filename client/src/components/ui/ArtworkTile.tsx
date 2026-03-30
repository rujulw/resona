import { useEffect, useState } from "react";

import { resolveArtworkSource } from "../../desktop";

export function ArtworkTile({
  artworkKey,
  title,
  sizeClassName,
  roundedClassName = "rounded-md",
}: {
  artworkKey: string | null | undefined;
  title: string;
  sizeClassName: string;
  roundedClassName?: string;
}) {
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!artworkKey) {
      setArtworkUrl(null);
      return () => {
        cancelled = true;
      };
    }

    void resolveArtworkSource(artworkKey).then((source) => {
      if (cancelled) {
        return;
      }

      setArtworkUrl(source?.assetUrl ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [artworkKey]);

  return artworkUrl ? (
    <img
      className={`${sizeClassName} ${roundedClassName} shrink-0 border border-white/8 object-cover`}
      src={artworkUrl}
      alt={`${title} artwork`}
    />
  ) : (
    <div
      className={`${sizeClassName} ${roundedClassName} shrink-0 border border-white/8 bg-gradient-to-br from-white/12 to-transparent`}
      aria-hidden="true"
    />
  );
}
