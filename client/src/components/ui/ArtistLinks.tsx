import { Link } from "react-router-dom";
import type { MouseEvent } from "react";

import { artistRoute } from "../../constants/routes";

// Splits on ", " / " feat. " / " ft. " / " & " / " x " / " / "
// Capturing group keeps the separators in the result array (odd indices).
const SEP_RE = /(,\s+|\s+feat\.\s+|\s+feat\s+|\s+ft\.\s+|\s+ft\s+|\s+&\s+|\s+x\s+|\s+\/\s+)/gi;

export function ArtistLinks({
  artist,
  linkClassName,
  separatorClassName,
  unknownClassName,
  onClick,
}: {
  artist: string | null | undefined;
  linkClassName: string;
  separatorClassName?: string;
  unknownClassName?: string;
  onClick?: (e: MouseEvent) => void;
}) {
  if (!artist) {
    return <span className={unknownClassName ?? linkClassName}>unknown artist</span>;
  }

  const parts = artist.split(SEP_RE);

  return (
    <span className="min-w-0 truncate">
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <span key={i} className={separatorClassName ?? linkClassName}>
              {part}
            </span>
          );
        }
        const name = part.trim();
        if (!name) return null;
        return (
          <Link key={i} to={artistRoute(name)} className={linkClassName} onClick={onClick}>
            {name}
          </Link>
        );
      })}
    </span>
  );
}
