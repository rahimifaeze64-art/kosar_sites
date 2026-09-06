'use strict';
// آزمایش مورفولوژی: open (min→max 3x3) وبِ خطوط نازک را از خاکستری حذف می‌کند
// و بعد otsu2 (Otsu دومرحله‌ای) فقط متن را نگه می‌دارد. سنجش در ۱x و ۴x.
// مصرف: node tools/test-thresh.js
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
function otsu2th(g, w, h) {
  const n = w * h;
  const th1 = otsuTh(g, w, h);
  let ink1 = 0;
  for (let i = 0; i < n; i++) if (g[i] < th1) ink1++;
  if (ink1 / n <= 0.08) return { th1, th2: th1 };
  const clamped = Float32Array.from(g).map(v => Math.min(v, th1));
  const th2 = otsuTh(clamped, w, h);
  return { th1, th2 };
}
function probe(tag, g, w, h, expected) {
  const n = w * h;
  const { th1, th2 } = otsu2th(g, w, h);
  const sorted = Float32Array.from(g).sort();
  const pct = p => sorted[Math.min(n - 1, Math.floor(p * n))];
  let line = `${tag}: otsu2 th1=${th1.toFixed(3)} th2=${th2.toFixed(3)} |`;
  for (const frac of [0.04, 0.06, 0.08, 0.10, 0.12, 0.15]) {
    const th = pct(frac);
    const bin = new Uint8Array(n);
    for (let i = 0; i < n; i++) bin[i] = g[i] < th ? 1 : 0;
    const comps = I.connectedComponents({ bin, width: w, height: h }).filter(c => c.area >= 16);
    const areas = comps.map(c => c.area).sort((a, b) => b - a);
    const boxes = I.segmentGlyphs({ bin, width: w, height: h }, expected);
    line += ` ${(frac * 100) | 0}%:${comps.length}/${boxes ? '✓' : '✗'}(${areas.slice(0, 6).join(',')})`;
  }
  {
    const bin = new Uint8Array(n);
    for (let i = 0; i < n; i++) bin[i] = g[i] < th2 ? 1 : 0;
    const comps = I.connectedComponents({ bin, width: w, height: h }).filter(c => c.area >= 16);
    const areas = comps.map(c => c.area).sort((a, b) => b - a);
    const boxes = I.segmentGlyphs({ bin, width: w, height: h }, expected);
    line += ` | otsu2: ${comps.length}/${boxes ? '✓' : '✗'}(${areas.slice(0, 6).join(',')})`;
  }
  console.log(line);
}

const dir = path.join(__dirname, '..', 'real-samples');
for (const f of fs.readdirSync(dir).filter(x => /\.png$/i.test(x))) {
  const label = path.basename(f, path.extname(f)).toLowerCase();
  const gray = I.toGray(PNG.sync.read(fs.readFileSync(path.join(dir, f))));
  const opened = morphOpen(gray.gray, gray.width, gray.height);
  console.log(`\n=== ${f} (${gray.width}x${gray.height}) expected=${label.length} ===`);
  probe('  1x raw  ', gray.gray, gray.width, gray.height, label.length);
  probe('  1x open ', opened, gray.width, gray.height, label.length);
  const big = I.bilinearUpscale(gray, 4);
  const bigOpen = morphOpen(big.gray, big.width, big.height);
  probe('  4x open ', bigOpen, big.width, big.height, label.length);
}
