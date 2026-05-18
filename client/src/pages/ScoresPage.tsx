import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";

import { ScorePiano } from "../components/ui/scores/ScorePiano";
import { ScoreStaff } from "../components/ui/scores/ScoreStaff";
import { extractScore, pickScoreFile } from "../desktop";
import type { ScoreDetailPayload, ScoreNoteEvent } from "../desktop";
import { toAsyncErrorMessage } from "../hooks/shell/shellQueryShared";

function sampleUrl(fileName: string) {
  return `/piano/${fileName}`;
}

const SALAMANDER_SAMPLE_URLS = {
  A0: sampleUrl("A0v8.ogg"),
  A1: sampleUrl("A1v8.ogg"),
  A2: sampleUrl("A2v8.ogg"),
  A3: sampleUrl("A3v8.ogg"),
  A4: sampleUrl("A4v8.ogg"),
  A5: sampleUrl("A5v8.ogg"),
  A6: sampleUrl("A6v8.ogg"),
  A7: sampleUrl("A7v8.ogg"),
  C1: sampleUrl("C1v8.ogg"),
  C2: sampleUrl("C2v8.ogg"),
  C3: sampleUrl("C3v8.ogg"),
  C4: sampleUrl("C4v8.ogg"),
  C5: sampleUrl("C5v8.ogg"),
  C6: sampleUrl("C6v8.ogg"),
  C7: sampleUrl("C7v8.ogg"),
  C8: sampleUrl("C8v8.ogg"),
  "D#1": sampleUrl("Ds1v8.ogg"),
  "D#2": sampleUrl("Ds2v8.ogg"),
  "D#3": sampleUrl("Ds3v8.ogg"),
  "D#4": sampleUrl("Ds4v8.ogg"),
  "D#5": sampleUrl("Ds5v8.ogg"),
  "D#6": sampleUrl("Ds6v8.ogg"),
  "D#7": sampleUrl("Ds7v8.ogg"),
  "F#1": sampleUrl("Fs1v8.ogg"),
  "F#2": sampleUrl("Fs2v8.ogg"),
  "F#3": sampleUrl("Fs3v8.ogg"),
  "F#4": sampleUrl("Fs4v8.ogg"),
  "F#5": sampleUrl("Fs5v8.ogg"),
  "F#6": sampleUrl("Fs6v8.ogg"),
  "F#7": sampleUrl("Fs7v8.ogg"),
} as const;

type TransportState = "idle" | "playing" | "paused" | "ended";

function fmt(v: number | null, suffix = ""): string {
  if (v === null) return "—";
  return (Number.isInteger(v) ? `${v}` : v.toFixed(1)) + suffix;
}

function fmtTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getEffectiveTempoBpm(score: ScoreDetailPayload | null) {
  return score?.tempoBpm && score.tempoBpm > 0 ? score.tempoBpm : 96;
}

function getEventStartSeconds(event: ScoreNoteEvent, score: ScoreDetailPayload | null) {
  if (event.startSeconds !== null && event.startSeconds !== undefined) return event.startSeconds;
  return event.startBeats * (60 / getEffectiveTempoBpm(score));
}

function getEventDurationSeconds(event: ScoreNoteEvent, score: ScoreDetailPayload | null) {
  if (event.durationSeconds !== null && event.durationSeconds !== undefined && event.durationSeconds > 0) {
    return event.durationSeconds;
  }
  return Math.max(event.durationBeats * (60 / getEffectiveTempoBpm(score)), 0.08);
}

function getScoreDurationSeconds(score: ScoreDetailPayload | null) {
  if (!score) return 0;
  if (score.totalSeconds && score.totalSeconds > 0) return score.totalSeconds;
  let max = 0;
  for (const e of score.events) {
    max = Math.max(max, getEventStartSeconds(e, score) + getEventDurationSeconds(e, score));
  }
  return max;
}

function getActiveNotes(score: ScoreDetailPayload | null, playheadSeconds: number) {
  if (!score) return [];
  return score.events
    .filter((e) => {
      const start = getEventStartSeconds(e, score);
      return playheadSeconds >= start && playheadSeconds < start + getEventDurationSeconds(e, score);
    })
    .sort((a, b) => a.midi - b.midi);
}

export function ScoresPage() {
  const [score, setScore] = useState<ScoreDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [transportState, setTransportState] = useState<TransportState>("idle");
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [isPianoLoading, setIsPianoLoading] = useState(false);

  const samplerRef = useRef<Tone.Sampler | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const compressorRef = useRef<Tone.Compressor | null>(null);
  const samplerReadyPromiseRef = useRef<Promise<void> | null>(null);
  const triggeredEventsRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const playbackStartedAtRef = useRef<number | null>(null);
  const playbackOffsetRef = useRef(0);
  const transportStateRef = useRef<TransportState>("idle");
  const scoreRef = useRef<ScoreDetailPayload | null>(null);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    transportStateRef.current = transportState;
  }, [transportState]);

  useEffect(() => {
    return () => {
      stopAllVoices();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      samplerRef.current?.dispose();
      reverbRef.current?.dispose();
      filterRef.current?.dispose();
      compressorRef.current?.dispose();
    };
  }, []);

  async function ensureTonePiano() {
    if (samplerReadyPromiseRef.current) {
      await samplerReadyPromiseRef.current;
      return;
    }

    setIsPianoLoading(true);

    const compressor = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.003, release: 0.2 }).toDestination();
    const filter = new Tone.Filter({ type: "lowpass", frequency: 8200, rolloff: -24, Q: 0.35 });
    const reverb = new Tone.Reverb({ decay: 3.6, wet: 0.12, preDelay: 0.02 });
    const sampler = new Tone.Sampler({
      urls: SALAMANDER_SAMPLE_URLS,
      release: 1.8,
      attack: 0,
      curve: "exponential",
      onload: () => undefined,
    });

    sampler.volume.value = -1.5;
    sampler.connect(filter);
    filter.connect(compressor);
    filter.connect(reverb);
    reverb.connect(compressor);

    samplerRef.current = sampler;
    reverbRef.current = reverb;
    filterRef.current = filter;
    compressorRef.current = compressor;
    samplerReadyPromiseRef.current = Tone.loaded().then(() => {
      setIsPianoLoading(false);
    });

    try {
      await samplerReadyPromiseRef.current;
    } catch (err) {
      setIsPianoLoading(false);
      samplerReadyPromiseRef.current = null;
      sampler.dispose();
      reverb.dispose();
      filter.dispose();
      compressor.dispose();
      samplerRef.current = null;
      reverbRef.current = null;
      filterRef.current = null;
      compressorRef.current = null;
      throw err;
    }
  }

  function stopAllVoices() {
    samplerRef.current?.releaseAll();
    triggeredEventsRef.current.clear();
  }

  function triggerEvent(event: ScoreNoteEvent, currentSeconds: number) {
    const sampler = samplerRef.current;
    if (!sampler) return;
    const currentScore = scoreRef.current;
    const start = getEventStartSeconds(event, currentScore);
    const duration = getEventDurationSeconds(event, currentScore);
    const remaining = Math.max(start + duration - currentSeconds, 0.08);
    sampler.triggerAttackRelease(event.noteName, remaining, undefined, event.staff === 1 ? 0.88 : 0.76);
  }

  function syncVoices(currentSeconds: number) {
    const currentScore = scoreRef.current;
    if (!currentScore) return;

    for (const event of currentScore.events) {
      const start = getEventStartSeconds(event, currentScore);
      const end = start + getEventDurationSeconds(event, currentScore);
      const isActive = currentSeconds >= start && currentSeconds < end;
      const hasTriggered = triggeredEventsRef.current.has(event.id);

      if (isActive && !hasTriggered && getEventDurationSeconds(event, currentScore) > 0) {
        triggerEvent(event, currentSeconds);
        triggeredEventsRef.current.add(event.id);
      }

      if (!isActive && hasTriggered) triggeredEventsRef.current.delete(event.id);
    }
  }

  function tick() {
    const currentScore = scoreRef.current;
    if (!currentScore || transportStateRef.current !== "playing") return;
    const startedAt = playbackStartedAtRef.current;
    if (startedAt === null) return;

    const duration = getScoreDurationSeconds(currentScore);
    const currentSeconds = Math.min(playbackOffsetRef.current + (performance.now() - startedAt) / 1000, duration);

    setPlayheadSeconds(currentSeconds);
    syncVoices(currentSeconds);

    if (currentSeconds >= duration) {
      stopAllVoices();
      playbackStartedAtRef.current = null;
      playbackOffsetRef.current = duration;
      setTransportState("ended");
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  async function handleLoadScore() {
    setError(null);
    const sourcePath = await pickScoreFile();
    if (!sourcePath) return;

    stopAllVoices();
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    playbackStartedAtRef.current = null;
    playbackOffsetRef.current = 0;
    setPlayheadSeconds(0);
    setTransportState("idle");
    setIsLoading(true);

    try {
      setScore(await extractScore(sourcePath));
    } catch (e) {
      setError(toAsyncErrorMessage(e, "Failed to extract score"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePlay() {
    if (!score || score.events.length === 0) return;
    const duration = getScoreDurationSeconds(score);
    if (duration <= 0) return;

    await Tone.start();
    await ensureTonePiano();

    if (transportStateRef.current === "ended" || playbackOffsetRef.current >= duration) {
      playbackOffsetRef.current = 0;
      triggeredEventsRef.current.clear();
      setPlayheadSeconds(0);
    }

    setTransportState("playing");
    playbackStartedAtRef.current = performance.now();
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }

  function handlePause() {
    if (transportStateRef.current !== "playing") return;

    if (playbackStartedAtRef.current !== null) {
      playbackOffsetRef.current += (performance.now() - playbackStartedAtRef.current) / 1000;
    }

    playbackStartedAtRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    stopAllVoices();
    setTransportState("paused");
  }

  function handleRestart() {
    playbackOffsetRef.current = 0;
    playbackStartedAtRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stopAllVoices();
    setPlayheadSeconds(0);
    setTransportState(score ? "paused" : "idle");
  }

  const scoreDurationSeconds = getScoreDurationSeconds(score);
  const activeNotes = getActiveNotes(score, playheadSeconds);
  const progressPercent = scoreDurationSeconds > 0 ? Math.min((playheadSeconds / scoreDurationSeconds) * 100, 100) : 0;
  const playheadBeats = playheadSeconds * (getEffectiveTempoBpm(score) / 60);
  const metadataLine = score
    ? [
        score.keySignature ?? "unknown key",
        score.timeSignature ?? "free time",
        `${fmt(score.tempoBpm, " bpm")}`,
      ].join(" · ")
    : null;

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="grid gap-6 px-8 pb-8 pt-8">
          {error && (
            <div className="rounded-3xl border border-[#5d2828] bg-[#160909] px-5 py-4 text-sm text-[#f0b4b4]">
              {error}
            </div>
          )}

          {!score ? (
            <div className="flex min-h-[34rem] flex-col items-center justify-center gap-8 rounded-[2rem] border border-white/6 bg-[#0d0d0d] px-6 py-12 text-center">
              <div className="w-full max-w-6xl">
                <ScorePiano activeEvents={[]} scoreEvents={[]} />
              </div>
              <div className="grid max-w-2xl gap-3">
                <p className="m-0 text-[11px] uppercase tracking-[0.3em] text-white/30">scores</p>
                <h2 className="m-0 text-[clamp(2.6rem,7vw,5.4rem)] font-bold tracking-[-0.06em] text-[#f3efe8]">
                  scores
                </h2>
                <p className="m-0 text-sm leading-7 text-[#8f8f8f]">
                  Load a MusicXML score to view one measure at a time and play it through the sampled piano.
                </p>
              </div>
              <button
                className="rounded-full border border-white/12 bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-[#f0e7d8] disabled:cursor-wait disabled:opacity-70"
                type="button"
                disabled={isLoading}
                onClick={handleLoadScore}
              >
                {isLoading ? "extracting…" : "load score"}
              </button>
            </div>
          ) : (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="grid gap-2">
                  <div className="grid gap-1">
                    <h2 className="m-0 text-[clamp(2rem,5vw,4rem)] font-semibold tracking-[-0.06em] text-[#f3efe8]">
                      {score.title}
                    </h2>
                    <p className="m-0 text-sm text-[#8f8f8f]">{score.composer ?? "unknown composer"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-60"
                    type="button"
                    disabled={isLoading}
                    onClick={handleLoadScore}
                  >
                    {isLoading ? "extracting…" : "new score"}
                  </button>
                </div>
              </div>

              <div className="text-sm text-[#8f8f8f]">{metadataLine}</div>

              <div className="grid gap-5">
                <ScoreStaff score={score} playheadBeats={playheadBeats} />
                <ScorePiano activeEvents={activeNotes} scoreEvents={score.events} />
              </div>

              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-white/6 bg-[#0d0d0d] px-4 py-4">
                  <button
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#f3efe8] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={score.events.length === 0 || isPianoLoading}
                    onClick={transportState === "playing" ? handlePause : () => void handlePlay()}
                  >
                    {transportState === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
                  </button>

                  <button
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={score.events.length === 0}
                    onClick={handleRestart}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between gap-4 text-[11px] text-[#6f6f6f]">
                      <span>{isPianoLoading ? "loading piano…" : score.sourceName}</span>
                      <span>{fmtTime(playheadSeconds)} / {fmtTime(scoreDurationSeconds)}</span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-white/80 transition-[width] duration-100"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
