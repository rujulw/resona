import { useState } from "react";
import { ColorExtractor } from "react-color-extractor";

export function VinylDisc({
  artworkUrl,
  title,
  isPlaying,
  onColorExtracted,
}: {
  artworkUrl: string | null;
  title: string;
  isPlaying: boolean;
  onColorExtracted?: (color: string) => void;
}) {
  const [extractedColor, setExtractedColor] = useState("#282828");

  const handleColors = (detectedColors: string[]) => {
    if (detectedColors?.length > 0) {
      setExtractedColor(detectedColors[0]);
      onColorExtracted?.(detectedColors[0]);
    } else {
      setExtractedColor("#282828");
      onColorExtracted?.("#282828");
    }
  };

  const dominantColor = artworkUrl ? extractedColor : "#282828";

  return (
    <div aria-label={title} className="relative flex w-[min(92%,68vh)] max-w-[46rem] scale-[1.08] items-center justify-center">
      {artworkUrl ? <ColorExtractor key={artworkUrl} src={artworkUrl} getColors={handleColors} /> : null}

      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-full border border-white/5 bg-[#050505] shadow-[0_0_100px_rgba(0,0,0,0.8)]">
        <div className={`animate-vinyl absolute inset-0 h-full w-full${!isPlaying ? " pause-vinyl" : ""}`}>
          <div
            className="absolute inset-0 rounded-full opacity-40"
            style={{ background: "repeating-radial-gradient(circle, #1a1a1a 0, #000 2px, #1a1a1a 4px)" }}
          />

          <div
            className="absolute inset-0 rounded-full opacity-30"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.1) 15%, transparent 30%, transparent 50%, rgba(255,255,255,0.1) 65%, transparent 80%)",
            }}
          />

          <div
            className="absolute inset-0 z-10 m-auto flex aspect-square w-[30%] items-center justify-center overflow-hidden rounded-full border-[6px] border-black shadow-inner transition-colors duration-1000 isolate"
            style={{ backgroundColor: dominantColor }}
          >
            <div className="h-[80%] w-[80%] rounded-full border border-black/10" />
          </div>
        </div>

        <div className="bg-linear-to-tr pointer-events-none absolute inset-0 z-20 rounded-full from-transparent via-white/5 to-transparent" />

        <div className="absolute z-30 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-[#111] shadow-inner">
          <div className="h-1 w-1 rounded-full bg-white/20" />
        </div>
      </div>

      <div
        className="pointer-events-none absolute -right-[clamp(2.75rem,4vw,5rem)] -top-[clamp(2.75rem,4vw,5rem)] z-40 h-[clamp(14rem,26vw,24rem)] w-[clamp(12rem,22vw,20rem)] transition-transform duration-1000 ease-in-out"
        style={{ transform: isPlaying ? "rotate(18deg)" : "rotate(0deg)", transformOrigin: "top right" }}
      >
        <div className="absolute right-10 top-0 h-full w-4 rounded-full bg-linear-to-b from-zinc-400 to-zinc-800 shadow-2xl">
          <div className="absolute -left-6 bottom-0 h-16 w-12 -rotate-12 transform rounded-lg border-t border-white/20 bg-zinc-800 shadow-xl">
            <div className="mx-auto mt-2 h-4 w-1 rounded-full bg-zinc-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
