'use strict';

const Jimp = require('jimp');

// COCO 常见连边（可按你的关键点定义调整）
const EDGES = [
  [5,7],[7,9], [6,8],[8,10], [5,6], [11,12],
  [5,11],[6,12], [11,13],[13,15], [12,14],[14,16], [0,5],[0,6]
];

function toPairs(kps) {
  // 支持 [{x,y,score}] 或 [[x,y,score]]
  if (!Array.isArray(kps)) return [];
  if (kps.length && Array.isArray(kps[0])) {
    return kps.map(([x,y,s]) => ({ x, y, s: s ?? 1 }));
  }
  return kps.map(k => ({ x: k.x, y: k.y, s: k.score ?? k.s ?? 1 }));
}

async function drawSkeleton(imageBuffer, keypoints) {
  const img = await Jimp.read(imageBuffer);
  const kps = toPairs(keypoints);

  // 画点
  for (const k of kps) {
    if (k.s < 0.2) continue;
    const x0 = Math.max(0, Math.round(k.x) - 2);
    const y0 = Math.max(0, Math.round(k.y) - 2);
    for (let dx = 0; dx < 4; dx++) {
      for (let dy = 0; dy < 4; dy++) {
        const x = x0 + dx, y = y0 + dy;
        if (x >= 0 && y >= 0 && x < img.bitmap.width && y < img.bitmap.height) {
          img.setPixelColor(Jimp.rgbaToInt(0, 255, 0, 255), x, y);
        }
      }
    }
  }

  // 画线（Bresenham）
  const drawLine = (x0,y0,x1,y1) => {
    let dx = Math.abs(x1-x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1-y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      if (x0 >= 0 && y0 >= 0 && x0 < img.bitmap.width && y0 < img.bitmap.height) {
        img.setPixelColor(Jimp.rgbaToInt(0,255,0,255), Math.round(x0), Math.round(y0));
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };

  for (const [a, b] of EDGES) {
    const ka = kps[a], kb = kps[b];
    if (!ka || !kb || ka.s < 0.2 || kb.s < 0.2) continue;
    drawLine(ka.x, ka.y, kb.x, kb.y);
  }

  const out = await img.getBufferAsync(Jimp.MIME_JPEG);
  return { buffer: out, mime: Jimp.MIME_JPEG };
}

module.exports = { drawSkeleton };
