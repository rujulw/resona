#!/usr/bin/env node
// Generates 24 vinyl disc PNG assets (512×512) for Discord activity large_image.
// No npm deps — uses only built-in zlib for PNG compression.
// Output: assets/discord/vinyl/vinyl_h{hue:03}.png + vinyl_default.png
// Upload output files to Discord Developer Portal with matching asset keys.

import zlib from "zlib";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "assets", "discord", "vinyl");
const SIZE = 512;
const CX = SIZE / 2;
const CY = SIZE / 2;
const DISC_R = SIZE / 2;
const LABEL_R = DISC_R * 0.30; // w-[30%] of disc container = 30% of radius
const INNER_RING_R = LABEL_R * 0.80; // inner div is h-[80%] w-[80%] of label
const SPINDLE_R = 7;       // h-5 w-5 at ~736px disc → ~5px at 512px, bump slightly
const SPINDLE_DOT_R = 2;   // h-1 w-1 inner white/20 dot

// --- CRC32 ---

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// --- PNG writer ---

function uint32BE(n) {
  return Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const lenBuf = uint32BE(data.length);
  const payload = Buffer.concat([typeBytes, data]);
  const crc = uint32BE(crc32(payload));
  return Buffer.concat([lenBuf, payload, crc]);
}

function encodePng(pixels) {
  // pixels: Uint8Array RGBA row-major, SIZE×SIZE
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.concat([
    uint32BE(SIZE),
    uint32BE(SIZE),
    Buffer.from([8, 6, 0, 0, 0]), // 8-bit RGBA
  ]);
  const ihdr = chunk("IHDR", ihdrData);

  // Build raw scanlines: filter byte (0) + RGBA row
  const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
  for (let y = 0; y < SIZE; y++) {
    raw[y * (1 + SIZE * 4)] = 0; // filter: None
    for (let x = 0; x < SIZE; x++) {
      const src = (y * SIZE + x) * 4;
      const dst = y * (1 + SIZE * 4) + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });
  const idat = chunk("IDAT", compressed);
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// --- Color math ---

function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// --- Vinyl renderer ---

function renderVinyl(labelHue) {
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const [lr, lg, lb] = labelHue !== null ? hslToRgb(labelHue, 0.62, 0.38) : [40, 40, 40];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - CX;
      const dy = y - CY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * SIZE + x) * 4;

      // Outside disc — transparent
      if (dist > DISC_R) {
        pixels[idx + 3] = 0;
        continue;
      }

      // Base disc color: #050505
      let r = 5, g = 5, b = 5;

      // Groove rings — alternating bands, 40% blend over base
      const groove = dist % 4 < 2 ? 0x1a : 0x00;
      r = Math.round(r * 0.6 + groove * 0.4);
      g = Math.round(g * 0.6 + groove * 0.4);
      b = Math.round(b * 0.6 + groove * 0.4);

      // Specular highlight — soft conic shimmer at ~50° and ~230°
      const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const specAt = (center) => {
        const d = Math.abs(((angle - center + 180) % 360) - 180);
        return d < 35 ? Math.max(0, (1 - d / 35) * 0.06) : 0;
      };
      const spec = specAt(50) + specAt(230);
      r = clamp(Math.round(r + 255 * spec), 0, 255);
      g = clamp(Math.round(g + 255 * spec), 0, 255);
      b = clamp(Math.round(b + 255 * spec), 0, 255);

      // Center label
      if (dist <= LABEL_R) {
        const blend = dist > LABEL_R - 5 ? (LABEL_R - dist) / 5 : 1;
        r = Math.round(lr * blend + r * (1 - blend));
        g = Math.round(lg * blend + g * (1 - blend));
        b = Math.round(lb * blend + b * (1 - blend));

        // Inner decorative ring on label
        if (dist >= INNER_RING_R && dist < INNER_RING_R + 1.5) {
          r = Math.round(r * 0.65);
          g = Math.round(g * 0.65);
          b = Math.round(b * 0.65);
        }
      }

      // Spindle — bg-[#111] with tiny white/20 center dot
      if (dist <= SPINDLE_R) {
        if (dist <= SPINDLE_DOT_R) {
          r = clamp(Math.round(17 * 0.8 + 255 * 0.2), 0, 255);
          g = r;
          b = r;
        } else {
          r = 17; g = 17; b = 17;
        }
      }

      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }
  return pixels;
}

// --- Main ---

fs.mkdirSync(OUT_DIR, { recursive: true });

const slots = Array.from({ length: 24 }, (_, i) => i * 15);

for (const hue of slots) {
  const key = `vinyl_h${String(hue).padStart(3, "0")}`;
  const pixels = renderVinyl(hue);
  const png = encodePng(pixels);
  const outPath = path.join(OUT_DIR, `${key}.png`);
  fs.writeFileSync(outPath, png);
  process.stdout.write(`  wrote ${key}.png\n`);
}

// Default asset — neutral dark label (no artwork)
const defaultPixels = renderVinyl(null);
const defaultPng = encodePng(defaultPixels);
fs.writeFileSync(path.join(OUT_DIR, "vinyl_default.png"), defaultPng);
process.stdout.write("  wrote vinyl_default.png\n");

process.stdout.write(`\nDone. ${slots.length + 1} assets in ${OUT_DIR}\n`);
process.stdout.write("Upload to Discord Developer Portal with matching asset key names.\n");
