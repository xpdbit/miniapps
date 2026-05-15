/**
 * tavern-miniapp tabBar 图标生成器
 * 生成 48x48 RGBA PNG 图标（无外部依赖）
 *
 * 图标设计：
 * - market: 购物袋 (矩形+弧线提手)
 * - chat:   聊天气泡 (圆角矩形+小三角)
 * - profile: 用户 (圆形头+肩膀)
 *
 * 正常色: #999 / 选中色: #8B5CF6
 */

import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SIZE = 48;
const NORMAL = [0x99, 0x99, 0x99, 0xFF];
const ACTIVE = [0x8B, 0x5C, 0xF6, 0xFF];
const BG = [0, 0, 0, 0]; // 透明

// ─── PNG 工具 ──────────────────────────────────────

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = data || Buffer.alloc(0);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(d.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, crcBuf]);
}

function makePNG(width, height, pixels) {
  // pixels: flat Uint8Array(width * height * 4) RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: None
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x++) {
      const pi = rowStart + x * 4;
      const ri = y * (1 + width * 4) + 1 + x * 4;
      raw[ri] = pixels[pi];
      raw[ri + 1] = pixels[pi + 1];
      raw[ri + 2] = pixels[pi + 2];
      raw[ri + 3] = pixels[pi + 3];
    }
  }
  const compressed = zlib.deflateSync(raw);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND'),
  ]);
}

// ─── 像素绘制工具 ────────────────────────────────────

function setPixel(pixels, x, y, color) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const idx = (y * SIZE + x) * 4;
  pixels[idx] = color[0];
  pixels[idx + 1] = color[1];
  pixels[idx + 2] = color[2];
  pixels[idx + 3] = color[3];
}

function fillRect(pixels, x1, y1, x2, y2, color) {
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      setPixel(pixels, x, y, color);
}

function fillCircle(pixels, cx, cy, r, color) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        setPixel(pixels, x, y, color);
      }
    }
  }
}

// 抗锯齿圆形
function aaCircle(pixels, cx, cy, r, color) {
  for (let y = cy - r - 1; y <= cy + r + 1; y++) {
    for (let x = cx - r - 1; x <= cx + r + 1; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        setPixel(pixels, x, y, color);
      } else if (dist < r + 1) {
        const alpha = Math.round((1 - (dist - r)) * color[3]);
        if (alpha > 0) {
          setPixel(pixels, x, y, [color[0], color[1], color[2], alpha]);
        }
      }
    }
  }
}

function fillTriangle(pixels, x1, y1, x2, y2, x3, y3, color) {
  // 扫描线填充
  const minY = Math.max(0, Math.min(y1, y2, y3));
  const maxY = Math.min(SIZE - 1, Math.max(y1, y2, y3));
  for (let y = minY; y <= maxY; y++) {
    const intersections = [];
    const edges = [
      [x1, y1, x2, y2],
      [x2, y2, x3, y3],
      [x3, y3, x1, y1],
    ];
    for (const [ex1, ey1, ex2, ey2] of edges) {
      if (ey1 === ey2) continue;
      if ((y < ey1 && y < ey2) || (y > ey1 && y > ey2)) continue;
      const t = (y - ey1) / (ey2 - ey1);
      const ix = ex1 + t * (ex2 - ex1);
      intersections.push(ix);
    }
    if (intersections.length >= 2) {
      intersections.sort((a, b) => a - b);
      const xStart = Math.max(0, Math.round(intersections[0]));
      const xEnd = Math.min(SIZE - 1, Math.round(intersections[intersections.length - 1]));
      for (let x = xStart; x <= xEnd; x++) {
        setPixel(pixels, x, y, color);
      }
    }
  }
}

function fillRoundRect(pixels, x1, y1, x2, y2, r, color) {
  fillRect(pixels, x1, y1 + r, x2, y2 - r, color);
  fillRect(pixels, x1 + r, y1, x2 - r, y2, color);
  // corners
  for (let y = 0; y <= r; y++) {
    for (let x = 0; x <= r; x++) {
      if (x * x + y * y <= r * r) {
        setPixel(pixels, x1 + r - x, y1 + r - y, color);
        setPixel(pixels, x2 - r + x, y1 + r - y, color);
        setPixel(pixels, x1 + r - x, y2 - r + y, color);
        setPixel(pixels, x2 - r + x, y2 - r + y, color);
      }
    }
  }
}

// ─── 图标绘图函数 ────────────────────────────────────

// 购物袋 (market)
function drawMarket(pixels, color) {
  // 提手 (半圆形弧线) — 先画，让袋子覆盖其底部
  aaCircle(pixels, 24, 10, 8, color);
  // 袋子主体 - 圆角矩形（覆盖提手底部，模拟真实连接效果）
  fillRoundRect(pixels, 8, 14, 39, 40, 4, color);
}

// 聊天气泡 (chat)
function drawChat(pixels, color) {
  // 气泡主体 - 圆角矩形
  fillRoundRect(pixels, 6, 8, 41, 34, 5, color);
  // 气泡小三角 (左下角)
  fillTriangle(pixels, 10, 32, 18, 32, 10, 40, color);
}

// 用户头像 (profile)
function drawProfile(pixels, color) {
  // 头 - 圆形
  aaCircle(pixels, 24, 15, 9, color);
  // 身体/肩膀
  fillTriangle(pixels, 8, 44, 40, 44, 24, 26, color);
}

// ─── 主逻辑 ──────────────────────────────────────────

const ICONS = [
  { name: 'market', draw: drawMarket },
  { name: 'chat', draw: drawChat },
  { name: 'profile', draw: drawProfile },
];

function generateIcon(name, color) {
  const pixels = new Uint8Array(SIZE * SIZE * 4); // all zero = transparent

  // 根据名称选择绘图函数
  const icon = ICONS.find(i => i.name === name);
  if (icon) icon.draw(pixels, color);

  return makePNG(SIZE, SIZE, pixels);
}

const outputDir = path.resolve(__dirname, '..', 'src', 'assets', 'icons');

console.log(`生成图标到: ${outputDir}`);
for (const icon of ICONS) {
  // Normal
  const normalPath = path.join(outputDir, `${icon.name}.png`);
  const normalPNG = generateIcon(icon.name, NORMAL);
  fs.writeFileSync(normalPath, normalPNG);
  console.log(`  ✓ ${icon.name}.png (${normalPNG.length} bytes)`);

  // Active
  const activePath = path.join(outputDir, `${icon.name}-active.png`);
  const activePNG = generateIcon(icon.name, ACTIVE);
  fs.writeFileSync(activePath, activePNG);
  console.log(`  ✓ ${icon.name}-active.png (${activePNG.length} bytes)`);
}

console.log('\n图标生成完成!');
