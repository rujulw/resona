import { convertFileSrc } from "@tauri-apps/api/core";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import type { ScoreDetailPayload } from "../../../desktop";

type OsmdModule = typeof import("opensheetmusicdisplay");
const STAFF_ZOOM = 0.72;

function getCurrentMeasureNumber(score: ScoreDetailPayload, playheadBeats: number) {
  let currentMeasure = 1;
  for (const event of score.events) {
    if (event.startBeats <= playheadBeats) currentMeasure = event.measureNumber;
    else break;
  }
  return Math.min(Math.max(currentMeasure, 1), Math.max(score.measureCount, 1));
}

export const ScoreStaff = memo(function ScoreStaff({
  score,
  playheadBeats,
}: {
  score: ScoreDetailPayload;
  playheadBeats: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const osmdRef = useRef<InstanceType<OsmdModule["OpenSheetMusicDisplay"]> | null>(null);
  const loadedUrlRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sourceUrl = useMemo(() => convertFileSrc(score.sourcePath), [score.sourcePath]);
  const currentMeasure = useMemo(
    () => getCurrentMeasureNumber(score, playheadBeats),
    [playheadBeats, score],
  );

  useEffect(() => {
    let cancelled = false;

    async function renderScore() {
      try {
        if (!containerRef.current) return;
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
        if (cancelled || !containerRef.current) return;

        setLoadError(null);

        if (!osmdRef.current) {
          osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
            backend: "svg",
            drawTitle: false,
            autoResize: false,
            followCursor: false,
            useXMLMeasureNumbers: true,
          });
        }

        const osmd = osmdRef.current;
        const drawUpToMeasureNumber = Math.min(currentMeasure + 1, Math.max(score.measureCount, 1));

        osmd.setOptions({
          drawFromMeasureNumber: currentMeasure,
          drawUpToMeasureNumber,
        });
        osmd.zoom = STAFF_ZOOM;

        if (loadedUrlRef.current !== sourceUrl) {
          await osmd.load(sourceUrl);
          loadedUrlRef.current = sourceUrl;
        }

        osmd.render();

        if (!cancelled) setIsReady(true);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to render score");
          setIsReady(false);
        }
      }
    }

    setIsReady(false);
    void renderScore();

    return () => {
      cancelled = true;
    };
  }, [currentMeasure, score.measureCount, sourceUrl]);

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.06] bg-[#111111] p-4">
      <div className="pointer-events-none absolute left-5 top-4 text-[10px] font-medium uppercase tracking-[0.28em] text-white/24">
        measure {currentMeasure}
      </div>
      <div className="pointer-events-none absolute right-5 top-4 text-[10px] font-medium uppercase tracking-[0.24em] text-white/20">
        {score.parts[0]?.name ?? "score"}
      </div>

      <div className="relative h-[18.5rem] overflow-hidden rounded-[1.35rem] bg-[#f6f1e7]">
        {!isReady && !loadError && (
          <div className="absolute inset-0 grid place-items-center text-sm text-[#8a7a5b]">
            rendering score…
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-[#8a4f4f]">
            {loadError}
          </div>
        )}
        <div className="absolute inset-0 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            ref={containerRef}
            className="mx-auto min-w-max p-5 [&_.cursor]:hidden [&_.osmdCanvasPage]:!m-0 [&_.osmdPage]:!m-0 [&_svg]:block [&_svg]:!h-auto [&_svg]:!max-w-none"
          />
        </div>
      </div>
    </div>
  );
});
