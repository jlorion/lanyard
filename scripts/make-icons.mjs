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

function box(x, y, cx, cy, hx, hy, r) {
  const qx = Math.abs(x - cx) - hx + r;
  const qy = Math.abs(y - cy) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * The Lanyard mark: a strap coming down from the top, a clip, and an ID badge.
 * Returns true where the white glyph is. `detailed` adds the badge's punched
 * slot, avatar and text lines, which only read well at 48px and up.
 */
function lanyard(x, y, detailed) {
  const w = detailed ? 0.04 : 0.06;
  const strap = Math.min(
    segment(x, y, 0.26, 0.08, 0.465, 0.42, w),
    segment(x, y, 0.74, 0.08, 0.535, 0.42, w),
  );
  const clip = box(x, y, 0.5, 0.47, 0.07, 0.06, 0.02);
  const badge = box(x, y, 0.5, 0.69, 0.22, 0.175, detailed ? 0.05 : 0.04);
  const solid = Math.min(strap, clip, badge) < 0;
  if (!solid || !detailed || badge >= 0) return solid;
  const cut = Math.min(
    box(x, y, 0.5, 0.575, 0.06, 0.016, 0.016), // punched slot
    Math.hypot(x - 0.405, y - 0.71) - 0.06, // avatar
    box(x, y, 0.59, 0.685, 0.06, 0.018, 0.018), // name
    box(x, y, 0.57, 0.745, 0.04, 0.018, 0.018), // title
  );
  return cut >= 0;
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
  const detailed = size >= 48;
  const small = size <= 32;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (i + (sx + 0.5) / ss) / size;
          const y = (j + (sy + 0.5) / ss) / size;
          if (style === 'template') {
            if (lanyard(x, y, false)) a += 1;
            continue;
          }
          if (box(x, y, 0.5, 0.5, small ? 0.5 : 0.46, small ? 0.5 : 0.46, small ? 0.2 : 0.18) > 0) continue;
          const t = (x + y) / 2;
          let c = [lerp(FROM[0], TO[0], t), lerp(FROM[1], TO[1], t), lerp(FROM[2], TO[2], t)];
          if (lanyard(x, y, detailed)) c = [255, 255, 255];
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
