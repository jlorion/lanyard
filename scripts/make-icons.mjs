// Renders the app / tray icons into resources/ without any image dependencies:
// a tiny signed-distance-field rasterizer plus a minimal PNG encoder.
//   node scripts/make-icons.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'resources');

// ------------------------------------------------------------------ PNG

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ shapes (unit square coordinates)

function roundRect(x, y, cx, cy, half, r) {
  const qx = Math.abs(x - cx) - half + r;
  const qy = Math.abs(y - cy) - half + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function segment(x, y, ax, ay, bx, by, thickness) {
  const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - dx * t, py - dy * t) - thickness;
}

// ">_" prompt glyph
function glyph(x, y, w) {
  return Math.min(
    segment(x, y, 0.30, 0.31, 0.50, 0.50, w),
    segment(x, y, 0.50, 0.50, 0.30, 0.69, w),
    segment(x, y, 0.57, 0.69, 0.73, 0.69, w),
  );
}

const lerp = (a, b, t) => a + (b - a) * t;
const FROM = [79, 70, 229]; // indigo-600
const TO = [147, 51, 234]; // purple-600

/**
 * style: 'app'      gradient tile + white glyph
 *        'template' black glyph only (macOS menu bar template image)
 */
function render(size, style) {
  const px = Buffer.alloc(size * size * 4);
  const ss = 4; // supersampling per axis
  const stroke = size <= 32 ? 0.085 : 0.065;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (i + (sx + 0.5) / ss) / size;
          const y = (j + (sy + 0.5) / ss) / size;
          if (style === 'template') {
            if (glyph(x, y, stroke + 0.02) < 0) a += 1;
            continue;
          }
          if (roundRect(x, y, 0.5, 0.5, size <= 32 ? 0.5 : 0.46, size <= 32 ? 0.2 : 0.18) > 0) continue;
          const t = (x + y) / 2;
          let c = [lerp(FROM[0], TO[0], t), lerp(FROM[1], TO[1], t), lerp(FROM[2], TO[2], t)];
          if (glyph(x, y, stroke) < 0) c = [255, 255, 255];
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const n = ss * ss;
      const o = (j * size + i) * 4;
      if (a) {
        px[o] = Math.round(r / a);
        px[o + 1] = Math.round(g / a);
        px[o + 2] = Math.round(b / a);
      }
      px[o + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePng(size, px);
}

const targets = [
  ['icon.png', 512, 'app'],
  ['tray.png', 16, 'app'],
  ['tray@2x.png', 32, 'app'],
  ['trayTemplate.png', 16, 'template'],
  ['trayTemplate@2x.png', 32, 'template'],
];

fs.mkdirSync(OUT, { recursive: true });
for (const [name, size, style] of targets) {
  fs.writeFileSync(path.join(OUT, name), render(size, style));
  console.log(`wrote resources/${name} (${size}x${size})`);
}
