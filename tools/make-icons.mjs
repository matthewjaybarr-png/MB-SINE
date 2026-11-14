// Makes the program, window and installer icons from Matt's Sine icon (copied from MB Editor's script):
//   node tools/make-icons.mjs
// Reads src-tauri/icons/source/SINE-ICON.png - a copy of the stick's SINE\SINE ICON\SINE-ICON.png (11-06),
// unchanged, 1254 px - and writes src-tauri/icons/icon.ico, the PNGs Tauri uses and the Store tiles. Needs ImageMagick 7.
//
//
// The only changes to Matt's art: it is sized down, and the dark area OUTSIDE the rounded square is made see-through
// (a flood fill from each corner).
import fs from 'node:fs'; import zlib from 'node:zlib'; import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------------------------------------------------------------- PNG and ICO reading (test/icons.mjs uses these)
// An image is { w, h, px } with px RGBA, 8 bits, top row first.
export function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let w, h, depth, type, interlace, plte, trns; const idat = [];
  for (let o = 8; o < buf.length;) {
    const len = buf.readUInt32BE(o), kind = buf.toString('latin1', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (kind === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; interlace = d[12]; }
    else if (kind === 'PLTE') plte = d; else if (kind === 'tRNS') trns = d; else if (kind === 'IDAT') idat.push(d);
    else if (kind === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`PNG depth ${depth}${interlace ? ', interlaced' : ''}: not read here`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type], raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch;
  const rows = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), out = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? rows[out + i - ch] : 0, b = y ? rows[out - stride + i] : 0, c = y && i >= ch ? rows[out - stride + i - ch] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      rows[out + i] = src[i] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
    }
  }
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = rows.subarray(i * ch, i * ch + ch);
    const rgba = type === 6 ? s : type === 2 ? [...s, 255] : type === 4 ? [s[0], s[0], s[0], s[1]] : type === 0 ? [s[0], s[0], s[0], 255]
      : [plte[s[0] * 3], plte[s[0] * 3 + 1], plte[s[0] * 3 + 2], trns && s[0] < trns.length ? trns[s[0]] : 255];
    px.set(rgba, i * 4);
  }
  return { w, h, px };
}

// Map size -> { kind: 'png' | 'bmp32' | 'bmp<n>', img }, in the file's order
export function readIco(buf) {
  if (buf.readUInt16LE(2) !== 1) throw new Error('not an .ico');
  const out = new Map();
  for (let i = 0; i < buf.readUInt16LE(4); i++) {
    const e = 6 + 16 * i, size = buf.readUInt32LE(e + 8), off = buf.readUInt32LE(e + 12), d = buf.subarray(off, off + size);
    if (d.readUInt32BE(0) === 0x89504e47) { const img = readPng(d); out.set(img.w, { kind: 'png', img }); continue; }
    const w = d.readInt32LE(4), h = d.readInt32LE(8) / 2, bits = d.readUInt16LE(14), colors = d.readUInt32LE(32) || (bits <= 8 ? 1 << bits : 0);
    const pal = d.subarray(d.readUInt32LE(0), d.readUInt32LE(0) + colors * 4);
    const xorAt = d.readUInt32LE(0) + colors * 4, xorRow = Math.ceil(w * bits / 32) * 4, andAt = xorAt + xorRow * h, andRow = Math.ceil(w / 32) * 4;
    const px = new Uint8Array(w * h * 4); let anyAlpha = false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = xorAt + (h - 1 - y) * xorRow, o = (y * w + x) * 4;
      if (bits === 32) { px.set([d[r + x * 4 + 2], d[r + x * 4 + 1], d[r + x * 4], d[r + x * 4 + 3]], o); anyAlpha ||= d[r + x * 4 + 3] > 0; }
      else if (bits === 24) px.set([d[r + x * 3 + 2], d[r + x * 3 + 1], d[r + x * 3], 255], o);
      else { const v = (d[r + ((x * bits) >> 3)] >> (8 - bits - ((x * bits) & 7))) & ((1 << bits) - 1); px.set([pal[v * 4 + 2], pal[v * 4 + 1], pal[v * 4], 255], o); }
    }
    if (bits !== 32 || !anyAlpha)   // no alpha of its own: the AND mask says what is see-through
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
        if ((d[andAt + (h - 1 - y) * andRow + (x >> 3)] >> (7 - (x & 7))) & 1) px[(y * w + x) * 4 + 3] = 0;
    out.set(w, { kind: 'bmp' + bits, img: { w, h, px } });
  }
  return out;
}

// ---------------------------------------------------------------- writing
function chunk(kind, data) {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), body = Buffer.concat([Buffer.from(kind, 'latin1'), data]);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([len, body, crc]);
}
export function writePng({ w, h, px }) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) raw.set(px.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);   // filter 0
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// 32-bit BMP with its AND mask (what Windows reads best at small sizes), PNG at 256
function bmp32({ w, h, px }) {
  const andRow = Math.ceil(w / 32) * 4, head = Buffer.alloc(40), xor = Buffer.alloc(w * h * 4), and = Buffer.alloc(andRow * h);
  head.writeUInt32LE(40, 0); head.writeInt32LE(w, 4); head.writeInt32LE(h * 2, 8); head.writeUInt16LE(1, 12); head.writeUInt16LE(32, 14);
  head.writeUInt32LE(xor.length + and.length, 20);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 4, d = ((h - 1 - y) * w + x) * 4;
    xor.set([px[s + 2], px[s + 1], px[s], px[s + 3]], d);
    if (!px[s + 3]) and[(h - 1 - y) * andRow + (x >> 3)] |= 0x80 >> (x & 7);
  }
  return Buffer.concat([head, xor, and]);
}
export function writeIco(imgs) {
  const data = imgs.map(img => img.w === 256 ? writePng(img) : bmp32(img));
  const head = Buffer.alloc(6 + 16 * imgs.length); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
  let off = head.length;
  imgs.forEach((img, i) => {
    const e = 6 + 16 * i;
    head[e] = img.w & 255; head[e + 1] = img.h & 255; head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data[i].length, e + 8); head.writeUInt32LE(off, e + 12); off += data[i].length;
  });
  return Buffer.concat([head, ...data]);
}

// ---------------------------------------------------------------- the icons
// ImageMagick: the picture (sized), the dark outside flood-filled away from each corner (8% fuzz), as raw RGBA
function cut(input, size, resize) {
  const m = size - 1;
  const args = [input, ...(resize ? ['-resize', `${size}x${size}!`] : []), '-alpha', 'set', '-fuzz', '8%', '-fill', 'none',
    ...[[0, 0], [m, 0], [0, m], [m, m]].flatMap(([x, y]) => ['-draw', `color ${x},${y} floodfill`]), '-depth', '8', 'rgba:-'];
  const r = spawnSync('magick', args, { maxBuffer: 1 << 26 });
  if (r.error || r.status) throw new Error('magick: ' + (r.error?.message || r.stderr));
  if (r.stdout.length !== size * size * 4) throw new Error(`magick gave ${r.stdout.length} bytes for ${size} px`);
  const px = new Uint8Array(r.stdout);
  for (let i = 3; i < px.length; i += 4) px[i] = px[i] ? 255 : 0;   // see-through or not, nothing between
  return { w: size, h: size, px };
}

export const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
export const TILES = { 'Square30x30Logo.png': 30, 'Square44x44Logo.png': 44, 'Square71x71Logo.png': 71, 'Square89x89Logo.png': 89,
  'Square107x107Logo.png': 107, 'Square142x142Logo.png': 142, 'Square150x150Logo.png': 150, 'Square284x284Logo.png': 284,
  'Square310x310Logo.png': 310, 'StoreLogo.png': 50 };

function main() {
  const dir = new URL('../src-tauri/icons/', import.meta.url), at = p => fileURLToPath(new URL(p, dir));
  const big = at('source/SINE-ICON.png');
  const frames = ICO_SIZES.map(s => cut(big, s, true));
  fs.writeFileSync(at('icon.ico'), writeIco(frames));
  const by = Object.fromEntries(frames.map(f => [f.w, f]));
  for (const [file, s] of Object.entries({ '32x32.png': 32, '64x64.png': 64, '128x128.png': 128, '128x128@2x.png': 256, 'icon.png': 256 }))
    fs.writeFileSync(at(file), writePng(by[s]));
  for (const [file, s] of Object.entries(TILES)) fs.writeFileSync(at(file), writePng(cut(big, s, true)));
  // The installer's Welcome/Finish strip, as Datum's: the 128 px icon centred on the icon's own navy, 24-bit BMP3.
  const side = spawnSync('magick', ['-size', '164x314', 'xc:rgb(0,18,53)', at('128x128.png'), '-gravity', 'center', '-composite',
    '-alpha', 'off', '-type', 'TrueColor', '-strip', 'BMP3:' + at('installer-side.bmp')]);
  if (side.status) throw new Error('magick: ' + side.stderr);
  console.log(`icon.ico ${ICO_SIZES.join(', ')}, PNGs, ${Object.keys(TILES).length} tiles and installer-side.bmp written`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
