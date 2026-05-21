import { memo, useMemo } from "react";

import type { ScoreNoteEvent } from "../../../desktop";
import { buildKeys } from "./scoreVisuals";

function keyShadow(active: boolean, isBlack: boolean) {
  if (isBlack) {
    return active
      ? "inset -1px -1px 2px rgba(255,255,255,0.16), inset 0 -2px 2px 3px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.5)"
      : "inset -1px -1px 2px rgba(255,255,255,0.16), inset 0 -5px 2px 3px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.5)";
  }
  return active
    ? "2px 0 3px rgba(0,0,0,0.1) inset, -5px 5px 20px rgba(0,0,0,0.2) inset, 0 0 3px rgba(0,0,0,0.2)"
    : "-1px 0 0 rgba(255,255,255,0.8) inset, 0 0 5px #ccc inset, 0 0 3px rgba(0,0,0,0.2)";
}

export const ScorePiano = memo(function ScorePiano({
  activeEvents,
  scoreEvents,
  lo = 21,
  hi = 108,
}: {
  activeEvents: ScoreNoteEvent[];
  scoreEvents: ScoreNoteEvent[];
  lo?: number;
  hi?: number;
}) {
  const { whites, blacks, totalW } = useMemo(() => buildKeys(lo, hi), [lo, hi]);
  const blackWidth = totalW > 0 ? (9 / totalW) * 100 : 0;
  const scoreMidis = useMemo(() => new Set(scoreEvents.map((event) => event.midi)), [scoreEvents]);
  const activeMidis = useMemo(() => new Set(activeEvents.map((event) => event.midi)), [activeEvents]);

  return (
    <div className="relative overflow-hidden rounded-[1.4rem] border border-[#160801] bg-[linear-gradient(45deg,#222_0%,#555_100%)] px-2 pb-2 pt-2.5 shadow-[inset_0_0_50px_rgba(0,0,0,0.5),inset_0_1px_rgba(212,152,125,0.2),0_5px_15px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-linear-to-b from-white/6 to-transparent" />
      <div className="relative h-28 sm:h-32">
        <div className="absolute inset-x-2 bottom-0 top-1.5 flex overflow-hidden rounded-b-[0.55rem] rounded-t-[0.35rem] border border-black/12">
          {whites.map(({ midi }) => {
            const isActive = activeMidis.has(midi);
            const isInScore = scoreMidis.has(midi);

            return (
              <div
                key={midi}
                className="relative h-full flex-1 border-b border-l border-[#bbb] first:rounded-bl-[0.35rem] last:rounded-br-[0.35rem]"
                style={{
                  background: isActive
                    ? "linear-gradient(to bottom, #ffffff 0%, #d1d5db 100%)"
                    : isInScore
                      ? "linear-gradient(to bottom, #ffffff 50%, #ededed 100%)"
                      : "linear-gradient(to bottom, #eee 0%, #fff 100%)",
                  boxShadow: keyShadow(isActive || isInScore, false),
                  borderTop: isActive || isInScore ? "1px solid #777" : undefined,
                  borderLeftColor: isActive || isInScore ? "#999" : undefined,
                  borderBottomColor: isActive || isInScore ? "#999" : undefined,
                  transform: isActive ? "translateY(1px)" : "translateY(0)",
                  transition: "transform 120ms ease, background 120ms ease, box-shadow 120ms ease",
                }}
              />
            );
          })}
        </div>

        {blacks.map(({ midi, x }) => {
          const isActive = activeMidis.has(midi);
          const isInScore = scoreMidis.has(midi);

          return (
            <div
              key={midi}
              className="absolute top-1.5 z-10 rounded-b-[0.3rem] border border-black"
              style={{
                left: `${(x / totalW) * 100}%`,
                width: `${blackWidth}%`,
                height: "50%",
                background: isActive
                  ? "linear-gradient(to bottom, #000000 0%, #d1d5db 100%)"
                  : isInScore
                    ? "linear-gradient(to bottom, #000000 0%, #a3a3a3 100%)"
                    : "linear-gradient(45deg, #222 0%, #555 100%)",
                boxShadow: keyShadow(isActive || isInScore, true),
                transform: isActive ? "translateY(1px)" : "translateY(0)",
                transition: "transform 120ms ease, background 120ms ease, box-shadow 120ms ease",
              }}
            />
          );
        })}
      </div>
    </div>
  );
});
