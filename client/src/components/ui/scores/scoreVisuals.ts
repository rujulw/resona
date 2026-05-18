import type { ScoreNoteEvent } from "../../../desktop";

const WHITE_NOTES = new Set([0, 2, 4, 5, 7, 9, 11]);
const BK_LEFT: Record<number, number> = { 1: 0.6, 3: 1.62, 6: 3.58, 8: 4.6, 10: 5.62 };
const WW = 14;
const DIAT = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

export const E4_ABS = 2 + 7 * 4;
export const G2_ABS = 4 + 7 * 2;
export const STAFF_LINE_SPACING = 13;
export const TREBLE_LINES = [52, 65, 78, 91, 104];
export const BASS_LINES = [136, 149, 162, 175, 188];
export const STAFF_HEIGHT = 232;
export const LEFT_MARGIN = 14;
export const RIGHT_MARGIN = 97;
export const NOTE_W = 16;
export const NOTE_H = 10;

export interface KeyData {
  midi: number;
  x: number;
}

export function buildKeys(lo: number, hi: number): { whites: KeyData[]; blacks: KeyData[]; totalW: number } {
  const start = lo - (lo % 12);
  let wi = 0;
  const cPos = new Map<number, number>();
  const whites: KeyData[] = [];
  const blacks: KeyData[] = [];

  for (let midi = start; midi <= hi; midi++) {
    const note = midi % 12;
    if (WHITE_NOTES.has(note)) {
      if (note === 0) cPos.set(midi, wi);
      whites.push({ midi, x: wi * WW });
      wi++;
    }
  }

  for (let midi = start; midi <= hi; midi++) {
    const note = midi % 12;
    if (!WHITE_NOTES.has(note) && BK_LEFT[note] !== undefined) {
      const c = cPos.get(midi - note);
      if (c !== undefined) blacks.push({ midi, x: (c + BK_LEFT[note]) * WW });
    }
  }

  return { whites, blacks, totalW: wi * WW };
}

export function sampleEvents(events: ScoreNoteEvent[], maxCount: number) {
  if (events.length <= maxCount) return events;
  const stride = Math.ceil(events.length / maxCount);
  return events.filter((_, index) => index % stride === 0);
}

export function diatAbs(midi: number) {
  return DIAT[midi % 12] + 7 * (Math.floor(midi / 12) - 1);
}

export function staffPos(refAbs: number, midi: number) {
  return diatAbs(midi) - refAbs;
}

export function posY(bottomY: number, pos: number) {
  return bottomY - pos * (STAFF_LINE_SPACING / 2);
}

export function ledgerYs(bottomY: number, pos: number) {
  const lines: number[] = [];
  if (pos < 0) {
    const bot = pos % 2 === 0 ? pos : pos + 1;
    for (let p = -2; p >= bot; p -= 2) lines.push(posY(bottomY, p));
  } else if (pos > 8) {
    const top = pos % 2 === 0 ? pos : pos - 1;
    for (let p = 10; p <= top; p += 2) lines.push(posY(bottomY, p));
  }
  return lines;
}
