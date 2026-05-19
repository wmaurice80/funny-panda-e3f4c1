#!/usr/bin/env node
/**
 * generate-icons.js
 * Génère icon-192.png et icon-512.png dans public/icons/
 * Utilise uniquement des modules Node.js natifs (zlib + Buffer) — aucune dépendance externe.
 *
 * Dessin : carré fond violet #7c3aed avec les lettres "CS" blanches centrées.
 */

import { createDeflate } from 'zlib';
import { createWriteStream, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'public', 'icons');

mkdirSync(ICONS_DIR, { recursive: true });

// ---------- helpers PNG ----------

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = u32be(data.length);
  const crcVal = u32be(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

function pngSignature() {
  return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;  // bit depth
  data[9] = 2;  // colour type: RGB
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace
  return chunk('IHDR', data);
}

// ---------- dessin ----------

const BG_R = 0x7c, BG_G = 0x3a, BG_B = 0xed; // #7c3aed violet
const FG_R = 0xff, FG_G = 0xff, FG_B = 0xff; // blanc

/**
 * Renvoie un Uint8Array[w*h*3] représentant l'image RGB.
 * Dessine un fond violet et les lettres "CS" en blanc, stylisées pixel art.
 */
function drawImage(size) {
  const pixels = new Uint8Array(size * size * 3).fill(0);

  // Fond violet
  for (let i = 0; i < size * size; i++) {
    pixels[i * 3] = BG_R;
    pixels[i * 3 + 1] = BG_G;
    pixels[i * 3 + 2] = BG_B;
  }

  // Arrondis aux coins (rayon = size/8)
  const radius = Math.round(size / 8);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inCorner = false;
      const cx = [radius, size - 1 - radius];
      const cy = [radius, size - 1 - radius];
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const dx = x - cx[i], dy = y - cy[j];
          if (
            ((i === 0 && x < cx[0]) || (i === 1 && x > cx[1])) &&
            ((j === 0 && y < cy[0]) || (j === 1 && y > cy[1])) &&
            dx * dx + dy * dy > radius * radius
          ) inCorner = true;
        }
      }
      if (inCorner) {
        pixels[(y * size + x) * 3] = 0x0f;
        pixels[(y * size + x) * 3 + 1] = 0x0f;
        pixels[(y * size + x) * 3 + 2] = 0x1a;
      }
    }
  }

  // Lettres "CS" — bitmap 5×7 mis à l'échelle
  const C = [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ];
  const S = [
    [0,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [0,1,1,1,0],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [1,1,1,1,0],
  ];

  const scale = Math.max(1, Math.floor(size / 24));
  const letterW = 5 * scale;
  const letterH = 7 * scale;
  const gap = scale * 2;
  const totalW = letterW * 2 + gap;
  const startX = Math.floor((size - totalW) / 2);
  const startY = Math.floor((size - letterH) / 2);

  function drawLetter(bitmap, offsetX) {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (!bitmap[row][col]) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = startX + offsetX + col * scale + sx;
            const py = startY + row * scale + sy;
            if (px >= 0 && px < size && py >= 0 && py < size) {
              const idx = (py * size + px) * 3;
              pixels[idx] = FG_R;
              pixels[idx + 1] = FG_G;
              pixels[idx + 2] = FG_B;
            }
          }
        }
      }
    }
  }

  drawLetter(C, 0);
  drawLetter(S, letterW + gap);

  return pixels;
}

/**
 * Encode les pixels RGB en données IDAT compressées (deflate PNG).
 */
async function encodeIDAT(pixels, width, height) {
  // Ajouter le byte de filtre (0x00 = None) en début de chaque ligne
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0x00; // filtre None
    pixels.copy
      ? pixels.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3)
      : raw.set(pixels.subarray(y * width * 3, (y + 1) * width * 3), y * (1 + width * 3) + 1);
  }

  return new Promise((resolve, reject) => {
    const deflate = createDeflate({ level: 9 });
    const chunks = [];
    deflate.on('data', (c) => chunks.push(c));
    deflate.on('end', () => resolve(Buffer.concat(chunks)));
    deflate.on('error', reject);
    deflate.write(raw);
    deflate.end();
  });
}

async function generatePNG(size, outPath) {
  const pixelsBuf = drawImage(size);
  // drawImage returns Uint8Array; convert to Buffer for .copy
  const pixelsBuffer = Buffer.from(pixelsBuf);
  const idatData = await encodeIDAT(pixelsBuffer, size, size);

  const png = Buffer.concat([
    pngSignature(),
    ihdr(size, size),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  const ws = createWriteStream(outPath);
  await new Promise((resolve, reject) => {
    ws.write(png);
    ws.end();
    ws.on('finish', resolve);
    ws.on('error', reject);
  });

  console.log(`✓ ${outPath} (${(png.length / 1024).toFixed(1)} KB)`);
}

await generatePNG(192, join(ICONS_DIR, 'icon-192.png'));
await generatePNG(512, join(ICONS_DIR, 'icon-512.png'));
console.log('Icons generated successfully.');
