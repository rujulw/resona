import { useEffect, useRef, useState } from "react";
import type { DragEvent, MouseEvent, RefObject } from "react";
import { GripVertical } from "lucide-react";

import { resolveArtworkSource } from "../desktop";
import type { TrackListItem } from "../desktop";
import type { QueueState } from "../types/app";
import { AdvisoryBadge } from "../components/ui/AdvisoryBadge";
import { VinylDisc } from "../components/ui/VinylDisc";

export function PlayerPage({
  queueState,
  isPlaying,
  onQueueReorder,
}: {
  queueState: QueueState;
  isPlaying: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
  onQueueReorder: (trackIds: string[]) => void;
}) {
  const { activeTrack, upcomingTracks } = queueState;
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    trackId: string;
    placement: "before" | "after";
  } | null>(null);
  const draggedTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeTrack?.artworkKey) {
      setArtworkUrl(null);
      return () => { cancelled = true; };
    }
    void resolveArtworkSource(activeTrack.artworkKey).then((source) => {
      if (!cancelled) setArtworkUrl(source?.assetUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [activeTrack?.artworkKey]);

  useEffect(() => {
    if (!draggedTrackId) return;
    const clearDrag = () => {
      draggedTrackIdRef.current = null;
      setDraggedTrackId(null);
      setDropIndicator(null);
    };
    window.addEventListener("mouseup", clearDrag);
    return () => window.removeEventListener("mouseup", clearDrag);
  }, [draggedTrackId]);

  if (!activeTrack) {
    return (
      <div className="grid h-full min-h-0 place-items-center bg-black px-6 py-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid max-w-md gap-2 text-center">
          <h2 className="m-0 text-xl font-medium text-[#f2f2f2]">queue is waiting</h2>
          <p className="m-0 text-sm text-[#8f8f8f]">
            Select a track from the library to derive the active queue and next-up flow.
          </p>
        </div>
      </div>
    );
  }

  const upcoming = upcomingTracks ?? [];

  const resolvePlacement = (
    e: DragEvent<HTMLElement> | MouseEvent<HTMLElement>,
    trackId: string,
  ): { trackId: string; placement: "before" | "after" } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    return { trackId, placement: e.clientY >= mid ? "after" : "before" };
  };

  const commitReorder = (
    movingId: string,
    targetId: string,
    placement: "before" | "after",
  ) => {
    if (movingId === targetId) return;
    const arr = [...upcoming];
    const fromIdx = arr.findIndex((t) => t.id === movingId);
    const [moved] = arr.splice(fromIdx, 1);
    const toIdx = arr.findIndex((t) => t.id === targetId);
    const insertAt = placement === "after" ? toIdx + 1 : toIdx;
    arr.splice(insertAt, 0, moved);
    onQueueReorder([activeTrack.id, ...arr.map((t) => t.id)]);
  };

  const clearDrag = () => {
    draggedTrackIdRef.current = null;
    setDraggedTrackId(null);
    setDropIndicator(null);
  };

  return (
    <div className="flex h-full min-h-0 items-center bg-black p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <section className="relative ml-[4%] flex h-full w-full max-w-[99vh] shrink-0 items-center justify-center overflow-hidden rounded-[clamp(2rem,4vw,3rem)] border border-white/5 bg-[#2c2c2c] shadow-[0_0_100px_rgba(0,0,0,0.5)]">
        <div className="absolute left-[clamp(1rem,2.2vw,2.5rem)] top-[clamp(1rem,2.2vw,2.5rem)] text-[10px] font-black uppercase tracking-[0.5em] text-white/10">
          direct drive system / quartz lock
        </div>
        <div className="absolute bottom-[clamp(1rem,2.2vw,2.5rem)] right-[clamp(1rem,2.2vw,2.5rem)] z-50 text-[10px] font-bold uppercase tracking-[0.4em] text-white/15">
          timbre. audio / mk-7
        </div>
        <VinylDisc
          key={activeTrack.artworkKey ?? "no-art"}
          artworkUrl={artworkUrl}
          title={activeTrack.title}
          isPlaying={isPlaying}
        />
      </section>

      <aside className="flex min-w-0 flex-1 flex-col self-stretch overflow-hidden px-8 py-8">
        {upcoming.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <p className="shrink-0 text-[11px] tracking-[0.08em] text-[#4a4a4a]">up next</p>
            <div className="min-h-0 flex-1 overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {upcoming.map((track: TrackListItem, i) => {
                const isDragging = draggedTrackId === track.id;
                const opacity = draggedTrackId !== null ? 1 : Math.max(0.22, 1 - i * 0.14);
                return (
                  <div
                    key={track.id}
                    className="relative"
                    onDragOver={(e) => {
                      e.preventDefault();
                      const dragging = draggedTrackIdRef.current ?? draggedTrackId ?? e.dataTransfer.getData("text/plain");
                      if (!dragging || dragging === track.id) return;
                      const p = resolvePlacement(e, track.id);
                      setDropIndicator((prev) =>
                        prev?.trackId === p.trackId && prev.placement === p.placement ? prev : p,
                      );
                    }}
                    onDragLeave={() => {
                      setDropIndicator((prev) =>
                        prev?.trackId === track.id ? null : prev,
                      );
                    }}
                    onMouseMove={(e) => {
                      if (!draggedTrackIdRef.current) return;
                      if (draggedTrackIdRef.current === track.id) return;
                      const p = resolvePlacement(e, track.id);
                      setDropIndicator((prev) =>
                        prev?.trackId === p.trackId && prev.placement === p.placement ? prev : p,
                      );
                    }}
                    onMouseUp={(e) => {
                      const movingId = draggedTrackIdRef.current ?? draggedTrackId;
                      if (!movingId) return;
                      const p = resolvePlacement(e, track.id);
                      commitReorder(movingId, track.id, p.placement);
                      clearDrag();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const movingId = draggedTrackIdRef.current ?? draggedTrackId ?? e.dataTransfer.getData("text/plain");
                      if (!movingId) return;
                      const p = resolvePlacement(e, track.id);
                      commitReorder(movingId, track.id, p.placement);
                      clearDrag();
                    }}
                  >
                    {dropIndicator?.trackId === track.id && dropIndicator.placement === "before" && (
                      <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-white/30" />
                    )}
                    <div
                      className={[
                        "group flex items-center gap-3 py-2.5 transition-opacity",
                        isDragging ? "opacity-30" : "",
                      ].join(" ")}
                      style={{ opacity: isDragging ? 0.3 : opacity }}
                    >
                      <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-[#3a3a3a]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-xs font-medium text-[#8f8f8f]">
                          {track.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <AdvisoryBadge advisory={track.advisory} />
                          <span className="truncate text-[11px] text-[#5a5a5a]">{track.artist}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        draggable
                        aria-label={`Drag ${track.title}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          draggedTrackIdRef.current = track.id;
                          setDraggedTrackId(track.id);
                        }}
                        onDragStart={(e) => {
                          e.dataTransfer?.setData("text/plain", track.id);
                          if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
                          draggedTrackIdRef.current = track.id;
                          setDraggedTrackId(track.id);
                        }}
                        onDragEnd={clearDrag}
                        className="inline-flex h-6 w-6 cursor-grab items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                      >
                        <GripVertical className="h-3.5 w-3.5 shrink-0 text-[#3a3a3a]" strokeWidth={2} />
                      </button>
                    </div>
                    {dropIndicator?.trackId === track.id && dropIndicator.placement === "after" && (
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-px bg-white/30" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
