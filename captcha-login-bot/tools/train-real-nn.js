'use strict';
// ── آموزش MLP گلیف روی نمونه‌های واقعی برچسب‌دار sample/ ─────────
// مصرف: node tools/train-real-nn.js [--diag] [--epochs 90] [--hidden 96] [--aug 30]
//   --diag : فقط گزارش بخش‌بندی هر فایل (بدون آموزش)
// خروجی: models/glyph-mlp.json (فرمت glyph-nn.js) + گزارش دقت per-file
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { _internals: I } = require('../captcha-solver');

const argv = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([a-z-]+)(?:=(.+))?$/);
  if (m) argv[m[1]] = m[2] === undefined ? true : m[2];
}

const SAMPLE_DIR = path.join(__dirname, '..', 'sample');
const MODEL_PATH = path.join(__dirname, '..', 'models', 'glyph-mlp.json');
const LETTERS = 'abcdefghjkmnpqrstuvwxyz'; // i/l/o حذف‌شده (سامانه استفاده نمی‌کند)
const DIGITS = '23456789';
const CHARS = (LETTERS + DIGITS).split('');
const IW = 18, IH = 26;
// فایل‌های دارای برچسب مشکوک از آموزش کنار گذاشته می‌شوند
const SKIP_FILES = new Set(['Screenshot 2026-09-06 123823.png']);
const FRACS = [0.05, 0.06, 0.07, 0.08, 0.10, 0.12];

// ── RNG با بذر برای تکرارپذیری ──────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260906);

// ── آستانهٔ صدکی: نگه‌داشتن تیره‌ترین frac٪ پیکسل‌ها ─────────────
function percentileThresh(gray, frac) {
  const sorted = Float32Array.from(gray).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(frac * sorted.length))];
}

// ── بخش‌بندی ۱x: کمترین frac که ۵ باکس سالم می‌دهد ──────────────
function segment1x(gray, expected) {
  const w = gray.width, h = gray.height;
  const tried = [];
  for (const frac of FRACS) {
    const th = percentileThresh(gray.gray, frac);
    let bin = new Uint8Array(w * h);
    for (let i = 0; i < bin.length; i++) bin[i] = gray.gray[i] < th ? 1 : 0;
    bin = I.despeckle({ bin, width: w, height: h }).bin;
    for (const strip of [false, true]) {
      const bImg = strip ? I.stripThinNoise({ bin, width: w, height: h }, 1) : { bin, width: w, height: h };
      const comps = I.connectedComponents(bImg).filter(c => c.area >= 16);
      const boxes = I.segmentGlyphs(bImg, expected);
      tried.push(`${(frac * 100) | 0}%${strip ? '/s' : ''}:c${comps.length}${boxes ? '✓' : '✗'}`);
      if (boxes) return { frac, strip, bin: bImg.bin, width: w, height: h, boxes, tried };
    }
  }
  return { nullSeg: true, tried };
}

// ── استخراج دیتاست: هر فایل → ۵ گلیف نرمال‌شده + برچسب ──────────
function extractDataset(diag) {
  const labels = JSON.parse(fs.readFileSync(path.join(SAMPLE_DIR, 'labels.json'), 'utf8'));
  const files = fs.readdirSync(SAMPLE_DIR)
    .filter(f => /\.png$/i.test(f) && !f.startsWith('_') && !SKIP_FILES.has(f))
    .sort();
  const data = [];
  const failed = [];
  for (const f of files) {
    const truth = (labels[f] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!truth || truth.length !== 5) { failed.push(`${f} (label?)`); continue; }
    const gray = I.toGray(PNG.sync.read(fs.readFileSync(path.join(SAMPLE_DIR, f))));
    const seg = segment1x(gray, truth.length);
    if (!seg || seg.nullSeg) {
      if (diag) console.log(`FAIL ${f}  [${(seg && seg.tried || []).join(' ')}]`);
      failed.push(f);
      continue;
    }
    if (diag) {
      console.log(`OK   ${f}  frac=${seg.frac} strip=${seg.strip}  [${seg.tried.join(' ')}]`);
      continue;
    }
    seg.boxes.forEach((b, pos) => {
      const n = I.normGlyphToBits(seg, b, 32, 44);
      data.push({ bits: n.bits, w: n.w, h: n.h, label: CHARS.indexOf(truth[pos]), file: f, pos });
    });
  }
  return { data, failed };
}
// ── تبدیل بیت‌مپ متغیر به ورودی شبکه (مثل glyph-nn.classify) ─────
function toNNInput(n) {
  const x = new Float32Array(IW * IH);
  for (let y = 0; y < IH; y++) {
    const sy0 = Math.floor((y * n.h) / IH), sy1 = Math.max(sy0 + 1, Math.ceil(((y + 1) * n.h) / IH));
    for (let x2 = 0; x2 < IW; x2++) {
      const sx0 = Math.floor((x2 * n.w) / IW), sx1 = Math.max(sx0 + 1, Math.ceil(((x2 + 1) * n.w) / IW));
      let s = 0, c = 0;
      for (let sy = sy0; sy < Math.min(n.h, sy1); sy++)
        for (let sx = sx0; sx < Math.min(n.w, sx1); sx++) { c++; s += n.bits[sy * n.w + sx]; }
      x[y * IW + x2] = c ? s / c : 0;
    }
  }
  return x;
}

// ── افزایش داده روی بیت‌مپ خام گلیف ─────────────────────────────
function shiftBits(n, dx, dy) {
  const out = new Uint8Array(n.bits.length);
  for (let y = 0; y < n.h; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= n.h) continue;
    for (let x = 0; x < n.w; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= n.w) continue;
      out[y * n.w + x] = n.bits[sy * n.w + sx];
    }
  }
  return { bits: out, w: n.w, h: n.h };
}
function rotateBits(n, deg) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const cx = (n.w - 1) / 2, cy = (n.h - 1) / 2;
  const out = new Uint8Array(n.bits.length);
  for (let y = 0; y < n.h; y++) {
    for (let x = 0; x < n.w; x++) {
      const sx = Math.round(cos * (x - cx) + sin * (y - cy) + cx);
      const sy = Math.round(-sin * (x - cx) + cos * (y - cy) + cy);
      if (sx >= 0 && sx < n.w && sy >= 0 && sy < n.h) out[y * n.w + x] = n.bits[sy * n.w + sx];
    }
  }
  return { bits: out, w: n.w, h: n.h };
}
function dilateBits(n) {
  const out = Uint8Array.from(n.bits);
  for (let y = 0; y < n.h; y++) for (let x = 0; x < n.w; x++) {
    if (n.bits[y * n.w + x]) continue;
    let nb = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < n.w && ny >= 0 && ny < n.h && n.bits[ny * n.w + nx]) nb++;
    }
    if (nb >= 3) out[y * n.w + x] = 1;
  }
  return { bits: out, w: n.w, h: n.h };
}
function noisyBits(n, rate) {
  const out = Uint8Array.from(n.bits);
  const k = Math.max(1, Math.round(out.length * rate));
  for (let i = 0; i < k; i++) out[(rng() * out.length) | 0] ^= 1;
  return { bits: out, w: n.w, h: n.h };
}
function augmentOne(n) {
  let g = n;
  const rot = [-9, -6, -3, 0, 3, 6, 9][(rng() * 7) | 0];
  if (rot) g = rotateBits(g, rot);
  const dx = [-2, -1, 0, 1, 2][(rng() * 5) | 0];
  const dy = [-1, 0, 1][(rng() * 3) | 0];
  if (dx || dy) g = shiftBits(g, dx, dy);
  if (rng() < 0.35) g = dilateBits(g);
  if (rng() < 0.7) g = noisyBits(g, 0.02);
  return g;
}
// ── MLP کوچک (ReLU + softmax، SGD با مومنتوم) ───────────────────
function initModel(hidden) {
  const inN = IW * IH, outN = CHARS.length;
  const r1 = Math.sqrt(2 / inN), r2 = Math.sqrt(2 / hidden);
  const gauss = (r) => {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * r;
  };
  const W1 = new Float32Array(hidden * inN);
  for (let i = 0; i < W1.length; i++) W1[i] = gauss(r1);
  const W2 = new Float32Array(outN * hidden);
  for (let i = 0; i < W2.length; i++) W2[i] = gauss(r2);
  return { hidden, W1, b1: new Float32Array(hidden), W2, b2: new Float32Array(outN) };
}
function forward(m, x) {
  const inN = IW * IH, outN = CHARS.length;
  const a1 = new Float32Array(m.hidden);
  for (let j = 0; j < m.hidden; j++) {
    let s = m.b1[j];
    const off = j * inN;
    for (let q = 0; q < inN; q++) s += m.W1[off + q] * x[q];
    a1[j] = s > 0 ? s : 0;
  }
  const z2 = new Float32Array(outN);
  let mx = -Infinity;
  for (let k = 0; k < outN; k++) {
    let s = m.b2[k];
    const off = k * m.hidden;
    for (let j = 0; j < m.hidden; j++) s += m.W2[off + j] * a1[j];
    z2[k] = s;
    if (s > mx) mx = s;
  }
  let Z = 0;
  const p = new Float32Array(outN);
  for (let k = 0; k < outN; k++) { p[k] = Math.exp(z2[k] - mx); Z += p[k]; }
  for (let k = 0; k < outN; k++) p[k] /= Z;
  return { a1, p };
}
function argmax(p) { let b = 0; for (let k = 1; k < p.length; k++) if (p[k] > p[b]) b = k; return b; }
function trainMLP(m, samples, epochs, lr0) {
  const inN = IW * IH, outN = CHARS.length;
  const gW1 = new Float32Array(m.W1.length), gb1 = new Float32Array(m.hidden);
  const gW2 = new Float32Array(m.W2.length), gb2 = new Float32Array(outN);
  const vW1 = new Float32Array(m.W1.length), vb1 = new Float32Array(m.hidden);
  const vW2 = new Float32Array(m.W2.length), vb2 = new Float32Array(outN);
  const idx = samples.map((_, i) => i);
  for (let ep = 1; ep <= epochs; ep++) {
    const lr = lr0 * Math.pow(0.5, Math.floor((ep - 1) / 30));
    for (let i = idx.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const B = 16;
    for (let b0 = 0; b0 < idx.length; b0 += B) {
      gW1.fill(0); gb1.fill(0); gW2.fill(0); gb2.fill(0);
      const end = Math.min(idx.length, b0 + B);
      for (let bi = b0; bi < end; bi++) {
        const s = samples[idx[bi]];
        const { a1, p } = forward(m, s.x);
        const dz2 = new Float32Array(outN);
        for (let k = 0; k < outN; k++) dz2[k] = p[k] - (k === s.label ? 1 : 0);
        for (let k = 0; k < outN; k++) {
          gb2[k] += dz2[k];
          const off = k * m.hidden;
          for (let j = 0; j < m.hidden; j++) gW2[off + j] += dz2[k] * a1[j];
        }
        for (let j = 0; j < m.hidden; j++) {
          if (a1[j] <= 0) continue;
          let d = 0;
          for (let k = 0; k < outN; k++) d += m.W2[k * m.hidden + j] * dz2[k];
          gb1[j] += d;
          const off = j * inN;
          for (let q = 0; q < inN; q++) gW1[off + q] += d * s.x[q];
        }
      }
      const bs = end - b0, mm = 0.9, sc = lr / bs;
      for (let i = 0; i < m.W1.length; i++) { vW1[i] = mm * vW1[i] - sc * gW1[i]; m.W1[i] += vW1[i]; }
      for (let i = 0; i < m.hidden; i++) { vb1[i] = mm * vb1[i] - sc * gb1[i]; m.b1[i] += vb1[i]; }
      for (let i = 0; i < m.W2.length; i++) { vW2[i] = mm * vW2[i] - sc * gW2[i]; m.W2[i] += vW2[i]; }
      for (let i = 0; i < outN; i++) { vb2[i] = mm * vb2[i] - sc * gb2[i]; m.b2[i] += vb2[i]; }
    }
    if (ep % 30 === 0 || ep === epochs) {
      let ok = 0;
      for (const s of samples) if (argmax(forward(m, s.x).p) === s.label) ok++;
      console.log(`  epoch ${ep}/${epochs} lr=${lr.toFixed(4)} trainAcc=${((100 * ok) / samples.length).toFixed(1)}%`);
    }
  }
  return m;
}
// ── main ────────────────────────────────────────────────────────
function main() {
  console.log('استخراج گلیف‌های واقعی از sample/ …');
  const { data, failed } = extractDataset(!!argv.diag);
  console.log(`گلیف استخراج‌شده: ${data.length} — ناموفق: ${failed.length}${failed.length ? ' → ' + failed.join(', ') : ''}`);
  if (argv.diag || !data.length) process.exit(0);

  // hold-out بر اساس فایل (هر فایل پنجم) تا نشت داده نباشد
  const files = [...new Set(data.map(d => d.file))].sort();
  const valFiles = new Set(files.filter((_, i) => i % 5 === 2));
  const trainRaw = data.filter(d => !valFiles.has(d.file));
  const valRaw = data.filter(d => valFiles.has(d.file));
  console.log(`فایل آموزش: ${files.length - valFiles.size} — اعتبارسنجی: ${valFiles.size} (${[...valFiles].join(', ')})`);

  const aug = parseInt(argv.aug || 30, 10);
  const samples = [];
  for (const g of trainRaw) {
    samples.push({ x: toNNInput(g), label: g.label });
    for (let r = 0; r < aug; r++) samples.push({ x: toNNInput(augmentOne(g)), label: g.label });
  }
  console.log(`نمونهٔ آموزش (با افزایش داده): ${samples.length}`);

  const hidden = parseInt(argv.hidden || 96, 10);
  const epochs = parseInt(argv.epochs || 90, 10);
  const m = trainMLP(initModel(hidden), samples, epochs, 0.1);

  // سنجش روی گلیف‌های خام (بدون افزایش داده)
  const evalRaw = (set, tag) => {
    let ok = 0;
    const byFile = new Map();
    for (const g of set) {
      const got = CHARS[argmax(forward(m, toNNInput(g)).p)];
      const exp = CHARS[g.label];
      if (got === exp) ok++;
      if (!byFile.has(g.file)) byFile.set(g.file, { exp: [], got: [] });
      const e = byFile.get(g.file);
      e.exp[g.pos] = exp; e.got[g.pos] = got;
    }
    console.log(`${tag} گلیف: ${ok}/${set.length} (${((100 * ok) / set.length).toFixed(1)}%)`);
    for (const [f, e] of byFile) {
      const hit = e.exp.join('') === e.got.join('');
      console.log(`   ${hit ? 'HIT ' : 'MISS'} ${f}: ${e.exp.join('')} → ${e.got.join('')}`);
    }
    return ok / set.length;
  };
  evalRaw(trainRaw, 'آموزش');
  const vAcc = evalRaw(valRaw, 'اعتبارسنجی');

  // ذخیرهٔ مدل در فرمت glyph-nn.js
  const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
  fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
  fs.writeFileSync(MODEL_PATH, JSON.stringify({
    created: new Date().toISOString(),
    trainedOn: 'sample/ real labeled glyphs (tools/train-real-nn.js)',
    iw: IW, ih: IH, hidden, classes: CHARS,
    W1: b64(m.W1), b1: b64(m.b1), W2: b64(m.W2), b2: b64(m.b2),
  }));
  console.log(`مدل ذخیره شد: ${MODEL_PATH} — دقت اعتبارسنجی گلیف: ${(100 * vAcc).toFixed(1)}%`);
}
main();




