'use strict';
// ── آموزش طبقه‌بند عصبی سبک (MLP) برای گلیف‌های کپچا ──────────
// داده: رندر فونت‌های برنده (اندازه/وزن/چرخش متنوع) + نمونه‌های واقعی real-samples
// مصرف: node tools/train-nn.js [--fonts "Verdana,Tahoma"] [--epochs 14] [--hidden 72]
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { chromium } = require('playwright');
const { _internals: I } = require('../captcha-solver');

const argv = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([a-z-]+)(?:=(.+))?$/);
  if (m) argv[m[1]] = m[2] === undefined ? true : m[2];
}
const FONT_NAMES = (argv.fonts || 'Verdana,Tahoma').split(',').map(s => s.trim()).filter(Boolean);
const WEIGHTS = [400, 700];
const SIZES = [30, 34, 38];
const ROTS = [-16, -12, -8, -4, 0, 4, 8, 12, 16];
const LETTERS = 'abcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';
const CHARS = (LETTERS + DIGITS).split('');
const IW = 18, IH = 26;
const CELL = 76, COLS = 20, ROWS_PER_PAGE = 15;
const SAMPLES_DIR = path.join(__dirname, '..', 'real-samples');
const MODEL_PATH = path.join(__dirname, '..', 'models', 'glyph-mlp.json');

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

function noisy(x) {
  const y = Float32Array.from(x);
  for (let i = 0; i < y.length; i++) {
    if (Math.random() < 0.05) y[i] = Math.max(0, Math.min(1, y[i] + (Math.random() - 0.5) * 0.6));
  }
  return y;
}

// خطوط نویز تصادفی ۱px — شبیه‌سازی وبِ خطوط نمونه‌های واقعی برای مقاوم‌سازی شبکه
function drawRandomLines(img, n) {
  const { gray, width: w, height: h } = img;
  for (let k = 0; k < n; k++) {
    const ang = Math.random() * Math.PI;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const cx = Math.random() * w, cy = Math.random() * h;
    for (let s = -(w + h) / 2; s < (w + h) / 2; s += 0.5) {
      const px = Math.round(cx + s * dx), py = Math.round(cy + s * dy);
      if (px >= 0 && px < w && py >= 0 && py < h) gray[py * w + px] = 0;
    }
  }
}
function cropToNorm(gray, cx, cy, withLines) {
  const sub = { gray: new Float32Array(CELL * CELL), width: CELL, height: CELL };
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++)
    sub.gray[y * CELL + x] = gray.gray[(cy + y) * gray.width + (cx + x)];
  if (withLines && Math.random() < 0.55) drawRandomLines(sub, 1 + ((Math.random() * 2) | 0));
  let b = I.binarize(sub, 0);
  if (withLines) b = I.stripThinNoise(b, 1); // خطوط ۱px حذف می‌شوند؛ فرسایش ناچیزِ نوک حروف شبیه نمونهٔ واقعی است
  let minX = b.width, minY = b.height, maxX = -1, maxY = -1;
  for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
    if (b.bin[y * b.width + x]) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return I.normGlyphToBits(b, { minX, minY, maxX, maxY }, 32, 44);
}
// [PART2]
async function train(samples, valIdx, hidden, epochs) {
  const IN = IW * IH, CL = CHARS.length;
  const W1 = new Float32Array(hidden * IN).map(() => (Math.random() - 0.5) * 0.08);
  const b1 = new Float32Array(hidden);
  const W2 = new Float32Array(CL * hidden).map(() => (Math.random() - 0.5) * 0.08);
  const b2 = new Float32Array(CL);
  const vW1 = new Float32Array(W1.length), vB1 = new Float32Array(hidden);
  const vW2 = new Float32Array(W2.length), vB2 = new Float32Array(CL);
  const trIdx = samples.map((_, i) => i).filter(i => !valIdx.has(i));
  let lr = 0.12;
  const upd = (W, g, v, n) => { for (let q = 0; q < W.length; q++) { v[q] = 0.9 * v[q] - (lr / n) * g[q]; W[q] += v[q]; } };
  for (let ep = 0; ep < epochs; ep++) {
    for (let i = trIdx.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = trIdx[i]; trIdx[i] = trIdx[j]; trIdx[j] = t; }
    let loss = 0, correct = 0;
    let gW1 = new Float32Array(W1.length), gB1 = new Float32Array(hidden);
    let gW2 = new Float32Array(W2.length), gB2 = new Float32Array(CL);
    let batchN = 0;
    for (const si of trIdx) {
      const s = samples[si];
      const h1 = new Float32Array(hidden), a1 = new Float32Array(hidden);
      for (let j = 0; j < hidden; j++) {
        let sum = b1[j]; const off = j * IN;
        for (let q = 0; q < IN; q++) sum += W1[off + q] * s.x[q];
        h1[j] = sum; a1[j] = sum > 0 ? sum : 0;
      }
      const logits = new Float32Array(CL);
      let mx = -1e9;
      for (let k = 0; k < CL; k++) {
        let sum = b2[k]; const off = k * hidden;
        for (let j = 0; j < hidden; j++) sum += W2[off + j] * a1[j];
        logits[k] = sum; if (sum > mx) mx = sum;
      }
      let Z = 0;
      for (let k = 0; k < CL; k++) { logits[k] = Math.exp(logits[k] - mx); Z += logits[k]; }
      let pred = 0, pv = -1;
      for (let k = 0; k < CL; k++) { logits[k] /= Z; if (logits[k] > pv) { pv = logits[k]; pred = k; } }
      loss += -Math.log(Math.max(1e-9, logits[s.label]));
      if (pred === s.label) correct++;
      const dA1 = new Float32Array(hidden);
      for (let k = 0; k < CL; k++) {
        const g = logits[k] - (k === s.label ? 1 : 0); const off = k * hidden;
        for (let j = 0; j < hidden; j++) { gW2[off + j] += g * a1[j]; dA1[j] += g * W2[off + j]; }
        gB2[k] += g;
      }
      for (let j = 0; j < hidden; j++) {
        const g = h1[j] > 0 ? dA1[j] : 0;
        if (g) { const off = j * IN; for (let q = 0; q < IN; q++) gW1[off + q] += g * s.x[q]; }
        gB1[j] += g;
      }
      if (++batchN === 64) {
        upd(W1, gW1, vW1, batchN); upd(b1, gB1, vB1, batchN); upd(W2, gW2, vW2, batchN); upd(b2, gB2, vB2, batchN);
        gW1 = new Float32Array(W1.length); gB1 = new Float32Array(hidden);
        gW2 = new Float32Array(W2.length); gB2 = new Float32Array(CL);
        batchN = 0;
      }
    }
    lr *= 0.88;
    console.log(`epoch ${ep + 1}/${epochs} — loss ${(loss / trIdx.length).toFixed(4)} — train-acc ${((correct / trIdx.length) * 100).toFixed(1)}%`);
  }
  return { W1, b1, W2, b2 };
}

function predict(m, x) {
  const IN = IW * IH, hidden = m.W1.length / IN, CL = m.b2.length;
  const a1 = new Float32Array(hidden);
  for (let j = 0; j < hidden; j++) {
    let sum = m.b1[j]; const off = j * IN;
    for (let q = 0; q < IN; q++) sum += m.W1[off + q] * x[q];
    a1[j] = sum > 0 ? sum : 0;
  }
  let mx = -1e9;
  const sc = new Array(CL);
  for (let k = 0; k < CL; k++) {
    let sum = m.b2[k]; const off = k * hidden;
    for (let j = 0; j < hidden; j++) sum += m.W2[off + j] * a1[j];
    sc[k] = sum; if (sum > mx) mx = sum;
  }
  let Z = 0;
  for (let k = 0; k < CL; k++) { sc[k] = Math.exp(sc[k] - mx); Z += sc[k]; }
  return sc.map((v, k) => [CHARS[k], v / Z]).sort((a, b) => b[1] - a[1]);
}
function realGlyphs() {
  const out = [];
  let files = [];
  try { files = fs.readdirSync(SAMPLES_DIR).filter(f => /\.png$/i.test(f)); } catch (e) { return out; }
  for (const f of files) {
    const label = path.basename(f, path.extname(f)).toLowerCase();
    if (!/^[a-z0-9]{4,8}$/.test(label)) continue;
    let gray;
    try { gray = I.toGray(PNG.sync.read(fs.readFileSync(path.join(SAMPLES_DIR, f)))); } catch (e) { continue; }
    const bin1 = I.binarize(gray, 0);
    const mask = I.detectLineMask(bin1);
    const gc = mask ? I.applyMaskGray(gray, mask) : gray;
    const binBig = I.despeckle(I.stripThinNoise(I.binarize(I.bilinearUpscale(gc, 4), 0)));
    const boxes = I.segmentGlyphs(binBig, label.length);
    if (!boxes || boxes.length !== label.length) { console.log(`⚠️ ${f}: جداسازی ناموفق`); continue; }
    boxes.forEach((b, i) => out.push({ x: toNNInput(I.normGlyphToBits(binBig, b, 32, 44)), label: CHARS.indexOf(label[i]), tag: `${f}#${i}` }));
  }
  return out;
}

async function main() {
  const hidden = parseInt(argv.hidden || 72, 10);
  const epochs = parseInt(argv.epochs || 14, 10);
  const cells = [];
  for (const font of FONT_NAMES) for (const weight of WEIGHTS) for (const size of SIZES)
    for (const ch of CHARS) {
      const displays = ch >= 'a' && ch <= 'z' ? [ch, ch.toUpperCase()] : [ch];
      for (const d of displays) for (const rot of ROTS) cells.push({ ch, d, rot, font, weight, size });
    }
  let browser = null;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try { browser = await chromium.launch({ headless: true, channel }); break; } catch (e) { /* بعدی */ }
  }
  if (!browser) throw new Error('مرورگر در دسترس نیست');
  const page = await browser.newPage();
  const base = [];
  const perPage = COLS * ROWS_PER_PAGE;
  for (let p0 = 0; p0 < cells.length; p0 += perPage) {
    const chunk = cells.slice(p0, p0 + perPage);
    const rows = Math.ceil(chunk.length / COLS);
    const html = chunk.map((c, i) =>
      `<div style="position:absolute;left:${(i % COLS) * CELL}px;top:${((i / COLS) | 0) * CELL}px;width:${CELL}px;height:${CELL}px;display:flex;align-items:center;justify-content:center;">` +
      `<span style="font-family:'${c.font}',sans-serif;font-weight:${c.weight};font-size:${c.size}px;color:#000;display:inline-block;transform:rotate(${c.rot}deg)">${c.d}</span></div>`).join('');
    await page.setContent(`<body style="margin:0;background:#fff;position:relative;width:${COLS * CELL}px;height:${rows * CELL}px">${html}</body>`);
    const shot = await page.screenshot({ clip: { x: 0, y: 0, width: COLS * CELL, height: rows * CELL } });
    const gray = I.toGray(PNG.sync.read(shot));
    for (let i = 0; i < chunk.length; i++) {
      const n = cropToNorm(gray, (i % COLS) * CELL, ((i / COLS) | 0) * CELL, true);
      if (n) base.push({ x: toNNInput(n), label: CHARS.indexOf(chunk[i].ch) });
    }
    process.stdout.write(`\rرندر: ${Math.min(p0 + chunk.length, cells.length)}/${cells.length}`);
  }
  await browser.close();
  console.log('');
  const real = realGlyphs();
  console.log(`دادهٔ رندر: ${base.length} — گلیف واقعی: ${real.length}`);
  const samples = [];
  for (const s of base) samples.push(s, { x: noisy(s.x), label: s.label });
  for (let r = 0; r < 40; r++) for (const s of real) samples.push({ x: noisy(s.x), label: s.label });
  const valIdx = new Set();
  while (valIdx.size < Math.max(1, Math.floor(samples.length * 0.02))) valIdx.add((Math.random() * samples.length) | 0);
  console.log(`آموزش روی ${samples.length - valIdx.size} نمونه (اعتبارسنجی ${valIdx.size})…`);
  const model = train(samples, valIdx, hidden, epochs);
  let gOk = 0;
  const bySample = new Map();
  for (const g of real) {
    const p = predict(model, g.x);
    if (p[0][0] === CHARS[g.label]) gOk++;
    const key = g.tag.split('#')[0];
    if (!bySample.has(key)) bySample.set(key, []);
    bySample.get(key).push({ exp: CHARS[g.label], got: p[0][0] });
  }
  console.log(`دقت گلیف روی نمونه‌های واقعی: ${gOk}/${real.length}`);
  for (const [k, arr] of bySample) {
    console.log(`  ${k}: انتظار=${arr.map(a => a.exp).join('')} شبکه=${arr.map(a => a.got).join('')}`);
  }
  const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
  fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
  fs.writeFileSync(MODEL_PATH, JSON.stringify({
    created: new Date().toISOString(), iw: IW, ih: IH, hidden, classes: CHARS,
    W1: b64(model.W1), b1: b64(model.b1), W2: b64(model.W2), b2: b64(model.b2),
  }));
  console.log(`💾 مدل ذخیره شد: ${MODEL_PATH}`);
}

main().catch(e => { console.error('ERR', e); process.exit(1); });
