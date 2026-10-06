// Renders the Lanyard app / tray icons into resources/ without any image dependencies:
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

// ------------------------------------------------------------------ artwork
//
// The Lanyard mark, rebuilt from the reference silhouette (1024x572 artwork):
// two crossing straps, a clip ring, a connector, and an ID card with a ">_"
// cut-out. Coordinates below are in that artwork's pixel space.

/** Rounded rectangle given by its corners; negative inside. */
function box(x, y, x0, y0, x1, y1, r = 0) {
  const qx = Math.abs(x - (x0 + x1) / 2) - (x1 - x0) / 2 + r;
  const qy = Math.abs(y - (y0 + y1) / 2) - (y1 - y0) / 2 + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Capsule around segment a-b with half-width hw; negative inside. */
function seg(x, y, ax, ay, bx, by, hw) {
  const px = x - ax,
    py = y - ay,
    dx = bx - ax,
    dy = by - ay;
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - dx * t, py - dy * t) - hw;
}

// Strap edges: x = x0 + slope * y. Straps extend above the artwork so they
// can run off the top of the tile.
const RIGHT_SLOPE = -102 / 262; // right strap runs down-left, on top
const LEFT_SLOPE = 0.3935; // left strap runs down-right, underneath
const STRAP_COS = 262 / Math.hypot(102, 262);

function strapRight(x, y) {
  return y < 270 && x >= 592 + RIGHT_SLOPE * y && x <= 638 + RIGHT_SLOPE * y;
}

function strapLeft(x, y, gap) {
  if (y >= 270 || x < 385 + LEFT_SLOPE * y || x > 431 + LEFT_SLOPE * y) return false;
  // Leave a thin gap where it passes under the right strap.
  const leftOfRight = (592 + RIGHT_SLOPE * y - x) * STRAP_COS;
  return leftOfRight > gap;
}

/**
 * True where the (white) glyph is. level: 'full' (48px+), 'medium' (24-47px)
 * or 'tiny' (<24px) trade fine details for thicker strokes.
 */
function glyph(x, y, level) {
  const full = level === 'full';
  const gap = full ? 7 : 16;

  const card = box(x, y, 435, 316, 588, 532, 18) < 0;
  if (card) {
    if (level === 'tiny') return true;
    const cw = full ? 6.5 : 11;
    const chevron = Math.min(seg(x, y, 472, 398, 500, 427, cw), seg(x, y, 500, 427, 472, 457, cw)) < 0;
    const grow = full ? 0 : 4;
    const underscore = box(x, y, 511 - grow, 458 - grow, 559 + grow, 468 + grow, 2) < 0;
    if (chevron || underscore) return false;
    if (!full) return true;
    // Badge slot around the connector, with the connector drawn back on top.
    const slot = box(x, y, 493, 312, 530, 336, 3) < 0 || box(x, y, 485, 334, 538, 347, 3) < 0;
    const connector = (box(x, y, 504, 288, 519, 300) < 0 || box(x, y, 500, 296, 523, 346, 3) < 0) && Math.hypot(x - 512, y - 311) > 4.5;
    return !slot || connector;
  }

  if (strapRight(x, y) || strapLeft(x, y, gap)) return true;

  const ringOuter = box(x, y, 480, 262, 543, 291, 10) < 0;
  const ringHole = full && box(x, y, 487, 269, 536, 284, 4) < 0;
  if (ringOuter && !ringHole) return true;

  const connector = box(x, y, 504, 288, 519, 300) < 0 || box(x, y, 500, 296, 523, 346, 3) < 0;
  return connector && (!full || Math.hypot(x - 512, y - 311) > 4.5);
}

/** How the artwork is framed on the tile: [top artwork y, artwork px per tile]. */
const FRAMING = {
  full: [101, 490], // straps enter from the top edge of the tile
  medium: [180, 390], // tighter crop so the card stays legible
  tiny: [205, 360],
};

const lerp = (a, b, t) => a + (b - a) * t;
const TILE_TOP = [47, 52, 62]; // #2f343e
const TILE_BOTTOM = [24, 26, 32]; // #181a20

/**
 * style: 'app'      charcoal tile + white glyph
 *        'template' black glyph only (macOS menu bar template image)
 */
function render(size, style) {
  const px = Buffer.alloc(size * size * 4);
  const ss = 4; // supersampling per axis
  const level = size >= 48 ? 'full' : size >= 24 ? 'medium' : 'tiny';
  const [top, scale] = FRAMING[style === 'template' ? 'tiny' : level];
  const small = size <= 32;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = (i + (sx + 0.5) / ss) / size;
          const v = (j + (sy + 0.5) / ss) / size;
          const ax = (u - 0.5) * scale + 511.5;
          const ay = v * scale + top;
          if (style === 'template') {
            if (glyph(ax, ay, 'tiny')) a += 1;
            continue;
          }
          const inset = small ? 0 : 0.04;
          if (box(u, v, inset, inset, 1 - inset, 1 - inset, small ? 0.2 : 0.18) > 0) continue;
          let c = [lerp(TILE_TOP[0], TILE_BOTTOM[0], v), lerp(TILE_TOP[1], TILE_BOTTOM[1], v), lerp(TILE_TOP[2], TILE_BOTTOM[2], v)];
          if (glyph(ax, ay, level)) c = [255, 255, 255];
          r += c[0];
          g += c[1];
          b += c[2];
          a += 1;
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

/** Windows .ico with PNG-compressed entries (supported since Vista). */
function encodeIco(sizes) {
  const images = sizes.map((s) => render(s, 'app'));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((s, k) => {
    const e = 6 + 16 * k;
    header[e] = s >= 256 ? 0 : s; // 0 means 256
    header[e + 1] = s >= 256 ? 0 : s;
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(images[k].length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += images[k].length;
  });
  return Buffer.concat([header, ...images]);
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
fs.writeFileSync(path.join(OUT, 'icon.ico'), encodeIco([16, 20, 24, 32, 40, 48, 64, 128, 256]));
console.log('wrote resources/icon.ico (16-256)');
