'use strict';
// رندر بصری باینری «فقط-متن» در آستانه‌های کاندید برای بازبینی چشمی
// مصرف: node tools/test-vis.js  → خروجی: debug/vis-*.png
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { _internals: I } = require('../captcha-solver');

function otsuTh(grayArr, w, h) {
  const n = w * h;
  const hist = new Float64Array(256);
  for (let i = 0; i < n; i++) hist[Math.min(255, (grayArr[i] * 255) | 0)]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = -1, thresh = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thresh = t; }
  }
  return thresh / 255;
}
function morphOpen(src, w, h) {
  const er = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = Math.min(w - 1, Math.max(0, x + dx)), ny = Math.min(h - 1, Math.max(0, y + dy));
      const v = src[ny * w + nx]; if (v < m) m = v;
    }
    er[y * w + x] = m;
  }
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = Math.min(w - 1, Math.max(0, x + dx)), ny = Math.min(h - 1, Math.max(0, y + dy));
      const v = er[ny * w + nx]; if (v > m) m = v;
    }
    out[y * w + x] = m;
  }
  return out;
}

const dir = path.join(__dirname, '..', 'real-samples');
const outDir = path.join(__dirname, '..', 'debug');
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(dir).filter(x => /\.png$/i.test(x))) {
  const name = path.basename(f, path.extname(f));
  const gray = I.toGray(PNG.sync.read(fs.readFileSync(path.join(dir, f))));
  const { width: w, height: h, gray: g } = gray;
  const n = w * h;
  const sorted = Float32Array.from(g).sort();
  const pct = p => sorted[Math.min(n - 1, Math.floor(p * n))];
  const th1 = otsuTh(g, w, h);
  const clamped = Float32Array.from(g).map(v => Math.min(v, th1));
  const th2 = otsuTh(clamped, w, h);
  const opened = morphOpen(g, w, h);

  const variants = [
    [`pct4@${pct(0.04).toFixed(2)}`, pct(0.04), g],
    [`pct6@${pct(0.06).toFixed(2)}`, pct(0.06), g],
    [`otsu2@${th2.toFixed(2)}`, th2, g],
    [`open-pct6@${pct(0.06).toFixed(2)}`, pct(0.06), opened],
  ];
  for (const [tag, th, src] of variants) {
    const S = 3;
    const png = new PNG({ width: w * S, height: h * S });
    for (let y = 0; y < h * S; y++) {
      for (let x = 0; x < w * S; x++) {
        const v = src[((y / S) | 0) * w + ((x / S) | 0)] < th ? 0 : 255;
        const p = (y * w * S + x) * 4;
        png.data[p] = png.data[p + 1] = png.data[p + 2] = v;
        png.data[p + 3] = 255;
      }
    }
    const file = path.join(outDir, `vis-${name}-${tag.replace(/[.@]/g, '')}.png`);
    fs.writeFileSync(file, PNG.sync.write(png));
    console.log('wrote', file);
  }
}
