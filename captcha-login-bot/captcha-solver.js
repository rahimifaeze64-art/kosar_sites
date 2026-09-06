#!/usr/bin/env node
// ============================================================
// captcha-solver.js — حل‌کننده کپچای متنی (حروف/اعداد + خطوط نویز)
// استراتژی:
//   ۱) چند «واریانت» تصویر (خاکستری خام/پاک‌سازی‌شده/باینری) ساخته می‌شود
//   ۲) هر واریانت با چند PSM خوانده می‌شود (PSM 8 و 13 بهترین‌اند — تست‌شده)
//   ۳) رأی‌گیری اجماعی: خوانش تکرارشونده بین واریانت‌ها برنده است
//      (اطمینان Tesseract روی این کپچاها غیرقابل‌اعتماد است)
// اجرای مستقل برای تست:  node captcha-solver.js img1.png [img2.png ...]
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const Tesseract = require('tesseract.js');

// ── طبقه‌بند عصبی گلیف (اختیاری) — مدل با tools/train-nn.js ساخته می‌شود ──
// اگر glyph-nn.js یا models/glyph-mlp.json موجود نباشد، بدون خطا غیرفعال می‌ماند
let _nnMod;
function getNN() {
  if (_nnMod === undefined) {
    try { _nnMod = require('./glyph-nn'); } catch (e) { _nnMod = null; }
    if (_nnMod && !_nnMod.loadModel()) _nnMod = null;
  }
  return _nnMod;
}

// ── ۱. تبدیل RGBA به ماتریس خاکستری (نرمال‌شده 0..1) ──────────
function toGray(png) {
  const { width, height, data } = png;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
  }
  return { gray, width, height };
}

// ── ۲. بزرگ‌نمایی دوخطی (bilinear) ───────────────────────────
function bilinearUpscale(img, factor) {
  const { gray, width: w, height: h } = img;
  const W = w * factor, H = h * factor;
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const gy = Math.min(h - 1.001, (y + 0.5) / factor - 0.5);
    const y0 = Math.max(0, Math.floor(gy)), ty = gy - y0;
    const y1 = Math.min(h - 1, y0 + 1);
    for (let x = 0; x < W; x++) {
      const gx = Math.min(w - 1.001, (x + 0.5) / factor - 0.5);
      const x0 = Math.max(0, Math.floor(gx)), tx = gx - x0;
      const x1 = Math.min(w - 1, x0 + 1);
      const a = gray[y0 * w + x0], b = gray[y0 * w + x1];
      const c = gray[y1 * w + x0], d = gray[y1 * w + x1];
      out[y * W + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  return { gray: out, width: W, height: H };
}

// ── ۳. آستانه‌گذاری Otsu (1 = جوهر/تیره) ─────────────────────
function binarize(img, bias = 0) {
  const { width, height, gray } = img;
  const n = width * height;
  const hist = new Float64Array(256);
  for (let i = 0; i < n; i++) hist[Math.min(255, (gray[i] * 255) | 0)]++;

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
  const th = Math.max(0, Math.min(255, thresh + bias * 255)) / 255;
  const bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = gray[i] < th ? 1 : 0;
  let dark = 0;
  for (let i = 0; i < n; i++) dark += bin[i];
  if (dark > n / 2) for (let i = 0; i < n; i++) bin[i] ^= 1;
  return { bin, width, height };
}

// ── ۴. ماسک خطوط نویز — ران‌های بلند؛ حذف نرم بر اساس ضخامت موضعی ──
// خط نویز ۲-۳px است، ساقهٔ حروف بولد ۴px+ → فقط پیکسل‌های نازک پاک می‌شوند
// تا ساقه‌های عمودی q/b/d/j و اریب‌های v/w/x آسیب نبینند
function detectLineMask(binImg, minLenRatio = 0.25) {
  const { bin, width: w, height: h } = binImg;
  const mask = new Uint8Array(w * h);
  const minLen = Math.max(25, Math.round(w * minLenRatio));
  // [dx, dy, pdx, pdy] — pd راستای عمود بر ران برای سنجش ضخامت موضعی
  const dirs = [[1, 0, 0, 1], [0, 1, 1, 0], [1, 1, 1, -1], [1, -1, 1, 1]];

  for (const [dx, dy, pdx, pdy] of dirs) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!bin[i] || mask[i]) continue;
        const px = x - dx, py = y - dy;
        if (px >= 0 && px < w && py >= 0 && py < h && bin[py * w + px]) continue;

        let len = 0;
        while (true) {
          const cx = x + len * dx, cy = y + len * dy;
          if (cx < 0 || cx >= w || cy < 0 || cy >= h || !bin[cy * w + cx]) break;
          len++;
        }
        if (len < minLen) continue;

        // نمونه‌گیری ضخامت در طول ران: اگر بیشترِ ران نازک است ← خط نویز است
        // (حتی اگر از روی چند گلیف عبور کند)؛ وگرنه ساقهٔ حرف است و نباید پاک شود
        let thin = 0;
        for (let s = 0; s < len; s++) {
          const cx = x + s * dx, cy = y + s * dy;
          let t = 1;
          let tx = cx + pdx, ty = cy + pdy;
          while (tx >= 0 && tx < w && ty >= 0 && ty < h && bin[ty * w + tx]) { t++; tx += pdx; ty += pdy; }
          tx = cx - pdx; ty = cy - pdy;
          while (tx >= 0 && tx < w && ty >= 0 && ty < h && bin[ty * w + tx]) { t++; tx -= pdx; ty -= pdy; }
          if (t <= 3) thin++;
        }
        if (thin / len < 0.55) continue; // اکثراً ضخیم ← گلیف، دست نزن

        // ماسک کامل ران — شامل بخش‌هایی که از روی گلیف رد می‌شود
        for (let s = 0; s < len; s++) mask[(y + s * dy) * w + (x + s * dx)] = 1;
      }
    }
  }
  return { mask, width: w, height: h };
}

// ── ۵. سفیدکردن پیکسل‌های خط روی تصویر خاکستری ───────────────
function applyMaskGray(img, maskImg) {
  const { gray, width, height } = img;
  const out = Float32Array.from(gray);
  for (let i = 0; i < out.length; i++) {
    if (maskImg.mask[i]) out[i] = 1;
  }
  return { gray: out, width, height };
}

// ── ۶. حذف نویز نقطه‌ای باینری ───────────────────────────────
function despeckle(binImg) {
  const { bin, width: w, height: h } = binImg;
  const out = Uint8Array.from(bin);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!bin[i]) continue;
      let nb = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (dx || dy) nb += bin[(y + dy) * w + (x + dx)];
      if (nb === 0) out[i] = 0;
    }
  }
  return { bin: out, width: w, height: h };
}

// ── ۶الف. حذف موضعی وبِ خطوط نویز نازک (هر زاویه‌ای) ─────────
// خطوط نویز با زاویه‌های دلخواه همهٔ گلیف‌ها را به هم می‌دوزند و
// detectLineMask (فقط ۴ راستای اصلی) آن‌ها را نمی‌گیرد. معیار موضعی:
// برای هر پیکسلِ جوهر، ضخامت موضعی = کمینهٔ ران در ۴ راستا سنجیده می‌شود؛
// اگر حتی در یک راستا نازک باشد (≤ maxThin) یعنی از سازهٔ نازک است
// (خط ۱px @۱x → ~۴-۵px @۴x) و پاک می‌شود؛ ساقهٔ حرف در ۴x ضخامت ≥۶px دارد.
// نکته: کمینه (نه بیشینه) — خطِ تقریباً افقی رانِ افقی بلند دارد ولی رانِ عمودش نازک است.
function stripThinNoise(binImg, maxThin = 5) {
  const { bin, width: w, height: h } = binImg;
  const out = Uint8Array.from(bin);
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bin[i]) continue;
      let minRun = 256;
      for (const [dx, dy] of dirs) {
        let t = 1;
        let tx = x + dx, ty = y + dy;
        while (tx >= 0 && tx < w && ty >= 0 && ty < h && bin[ty * w + tx]) { t++; tx += dx; ty += dy; }
        tx = x - dx; ty = y - dy;
        while (tx >= 0 && tx < w && ty >= 0 && ty < h && bin[ty * w + tx]) { t++; tx -= dx; ty -= dy; }
        if (t < minRun) minRun = t;
        if (minRun <= maxThin) break;
      }
      if (minRun <= maxThin) out[i] = 0;
    }
  }
  return { bin: out, width: w, height: h };
}

// ── ۷. خاکستری/باینری → PNG ─────────────────────────────────
function imgToPng(img) {
  const { width, height } = img;
  const png = new PNG({ width, height });
  const isBin = !!img.bin;
  for (let i = 0, p = 0; i < (isBin ? img.bin.length : img.gray.length); i++, p += 4) {
    const v = isBin ? (img.bin[i] ? 0 : 255) : Math.max(0, Math.min(255, Math.round(img.gray[i] * 255)));
    png.data[p] = png.data[p + 1] = png.data[p + 2] = v;
    png.data[p + 3] = 255;
  }
  return PNG.sync.write(png);
}

// ── ۷الف. کامپوننت‌های همبند (۸-همسایگی) برای پیدا کردن گلیف‌ها ──
function connectedComponents(binImg) {
  const { bin, width: w, height: h } = binImg;
  const labels = new Int32Array(w * h).fill(-1);
  const comps = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!bin[s] || labels[s] >= 0) continue;
    const id = comps.length;
    let minX = w, minY = h, maxX = 0, maxY = 0, area = 0;
    stack.length = 0;
    stack.push(s);
    labels[s] = id;
    while (stack.length) {
      const p = stack.pop();
      const px = p % w, py = (p / w) | 0;
      area++;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (bin[q] && labels[q] < 0) { labels[q] = id; stack.push(q); }
        }
      }
    }
    comps.push({ minX, minY, maxX, maxY, area });
  }
  return comps;
}

// ── ۷ب. برش باکس چسبیده با درهٔ پروجکشن عمودی ─────────────────
function splitBoxByValley(binImg, b, pieces) {
  const { bin, width: w } = binImg;
  const cols = [];
  for (let x = b.minX; x <= b.maxX; x++) {
    let cnt = 0;
    for (let y = b.minY; y <= b.maxY; y++) if (bin[y * w + x]) cnt++;
    cols.push({ x, cnt });
  }
  const inner = cols.slice(1, -1).sort((a, b2) => a.cnt - b2.cnt);
  const cuts = inner.slice(0, pieces - 1).map(c => c.x).sort((a, b2) => a - b2);
  const parts = [];
  let prev = b.minX;
  for (const cx of [...cuts, b.maxX]) {
    if (cx - prev + 1 >= 4) parts.push({ ...b, minX: prev, maxX: cx });
    prev = cx + 1;
  }
  return parts.length ? parts : [b];
}

// ── ۷پ. جداسازی گلیف‌ها به تعداد هدف (ادغام تکه‌ریز + برش چسبیده) ──
function segmentGlyphs(binImg, expected) {
  const { width: w } = binImg;
  const comps = connectedComponents(binImg).filter(c => c.area >= 16);
  if (!comps.length) return null;
  comps.sort((a, b) => (a.minX + a.maxX) - (b.minX + b.maxX));
  const areas = comps.map(c => c.area).sort((x, y) => x - y);
  const medArea = areas[areas.length >> 1];

  // ۱) تکه‌های ریز (نقطه، بقایای خط) به نزدیک‌ترین باکسِ هم‌ستون می‌چسبند
  let boxes = [];
  for (const c of comps) {
    if (c.area < medArea * 0.18 && boxes.length) {
      let best = -1, bestD = Infinity;
      for (let i = 0; i < boxes.length; i++) {
        const d = Math.abs((boxes[i].minX + boxes[i].maxX) / 2 - (c.minX + c.maxX) / 2);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0 && bestD < (w / expected) * 0.8) {
        const b = boxes[best];
        b.minX = Math.min(b.minX, c.minX); b.maxX = Math.max(b.maxX, c.maxX);
        b.minY = Math.min(b.minY, c.minY); b.maxY = Math.max(b.maxY, c.maxY);
        continue;
      }
    }
    boxes.push({ ...c });
  }

  // ۲) حروف چسبیده: پهن‌ترین باکسِ غیرعادی برش می‌خورد تا تعداد کامل شود
  if (boxes.length < expected) {
    const widths = boxes.map(b => b.maxX - b.minX + 1).sort((x, y) => x - y);
    const medW = Math.max(1, widths[widths.length >> 1]);
    let guard = expected * 2;
    while (boxes.length < expected && guard-- > 0) {
      boxes.sort((a, b) => a.minX - b.minX);
      let bi = -1, bw = 0;
      for (let i = 0; i < boxes.length; i++) {
        const tw = boxes[i].maxX - boxes[i].minX + 1;
        if (tw > bw && tw > medW * 1.45) { bw = tw; bi = i; }
      }
      if (bi < 0) break;
      const pieces = Math.min(expected - boxes.length + 1, Math.max(2, Math.round(bw / medW)));
      const parts = splitBoxByValley(binImg, boxes[bi], pieces);
      if (parts.length < 2) break;
      boxes.splice(bi, 1, ...parts);
    }
  }

  if (boxes.length !== expected) return null;
  boxes.sort((a, b) => (a.minX + a.maxX) - (b.minX + b.maxX));
  return boxes;
}

// ── ۷ت. برش یک گلیف از باینری با حاشیهٔ سفید → PNG ────────────
function cropBinPng(binImg, b, pad) {
  const { bin, width: w, height: h } = binImg;
  const x0 = Math.max(0, b.minX - pad), y0 = Math.max(0, b.minY - pad);
  const x1 = Math.min(w - 1, b.maxX + pad), y1 = Math.min(h - 1, b.maxY + pad);
  const W = x1 - x0 + 1, H = y1 - y0 + 1;
  const png = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      const v = bin[(y0 + y) * w + (x0 + x)] ? 0 : 255;
      png.data[p] = png.data[p + 1] = png.data[p + 2] = v;
      png.data[p + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

// ── ۷ث. نرمال‌سازی گلیف به ارتفاع ۳۲ (با میانگین‌گیری ناحیه‌ای، حفظ نسبت) ──
function normGlyphToBits(binImg, b, targetH = 32, maxW = 44) {
  const { bin, width: w } = binImg;
  const bw = b.maxX - b.minX + 1, bh = b.maxY - b.minY + 1;
  const scale = bh / targetH;
  const W = Math.max(2, Math.min(maxW, Math.round(bw / scale)));
  const bits = new Uint8Array(W * targetH);
  for (let y = 0; y < targetH; y++) {
    const y0 = b.minY + Math.floor(y * scale);
    const y1 = b.minY + Math.min(bh, Math.max(y0 + 1, Math.ceil((y + 1) * scale)));
    for (let x = 0; x < W; x++) {
      const x0 = b.minX + Math.floor(x * scale);
      const x1 = b.minX + Math.min(bw, Math.max(x0 + 1, Math.ceil((x + 1) * scale)));
      let ink = 0, tot = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) { tot++; if (bin[sy * w + sx]) ink++; }
      }
      bits[y * W + x] = (tot && ink / tot >= 0.4) ? 1 : 0;
    }
  }
  return { bits, w: W, h: targetH };
}

// ── ۷ج. فاصلهٔ XOR با جستجوی شیفت کوچک (چینش وسط‌چین) ─────────
function xorDistance(a, b) {
  const W = Math.max(a.w, b.w) + 4, H = a.h + 2;
  let best = Infinity;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      let ink = 0, diff = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const ax = x - 2, ay = y - 1;
          const av = (ax >= 0 && ax < a.w && ay >= 0 && ay < a.h) ? a.bits[ay * a.w + ax] : 0;
          const bx = x - 2 + dx, by = y - 1 + dy;
          const bv = (bx >= 0 && bx < b.w && by >= 0 && by < b.h) ? b.bits[by * b.w + bx] : 0;
          if (av || bv) ink++;
          if (av !== bv) diff++;
        }
      }
      const d = diff / Math.max(1, ink);
      if (d < best) best = d;
    }
  }
  return best;
}

// ── ۷چ. ساخت/بارگذاری قالب‌های حروف (رندر در مرورگر + کش دیسک) ──
const TEMPLATE_VERSION = 1;
let _templates = null;
async function buildTemplates() {
  if (_templates) return _templates;
  const cacheFile = path.join(__dirname, 'templates', `cache-v${TEMPLATE_VERSION}.json`);
  try {
    if (fs.existsSync(cacheFile)) {
      _templates = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (_templates && _templates.length) return _templates;
    }
  } catch (e) { /* کش خراب — بازسازی */ }
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { return null; }
  let browser = null;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try { browser = await chromium.launch({ headless: true, channel }); break; } catch (e) { /* بعدی */ }
  }
  if (!browser) return null;
  try {
    const page = await browser.newPage();
    const CHARS_TPL = 'abcdefghjkmnpqrstuvwxyz'.split('');
    const fonts = ['Georgia', '"Times New Roman"'];
    const rots = [-18, -12, -6, 0, 6, 12, 18];
    const list = [];
    for (const font of fonts) {
      for (const rot of rots) {
        const spans = CHARS_TPL.map((ch, i) =>
          `<div id="g${i}" style="display:inline-block;padding:12px 16px;margin:8px;` +
          `font-family:${font},serif;font-weight:700;font-size:34px;color:#000;` +
          `transform:rotate(${rot}deg)">${ch}</div>`).join('');
        await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff">${spans}</body></html>`);
        for (let i = 0; i < CHARS_TPL.length; i++) {
          const buf = await page.locator(`#g${i}`).screenshot();
          const g = toGray(PNG.sync.read(buf));
          const b = binarize(g, 0);
          let minX = b.width, minY = b.height, maxX = -1, maxY = -1;
          for (let y = 0; y < b.height; y++) {
            for (let x = 0; x < b.width; x++) {
              if (b.bin[y * b.width + x]) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
          if (maxX < 0) continue;
          const n = normGlyphToBits(b, { minX, minY, maxX, maxY }, 32, 44);
          list.push({ ch: CHARS_TPL[i], w: n.w, h: n.h, bits: Array.from(n.bits) });
        }
      }
    }
    await browser.close();
    _templates = list;
    try {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(list));
    } catch (e) { /* کش اختیاری است */ }
    return _templates;
  } catch (e) {
    try { await browser.close(); } catch (e2) { /* بیت */ }
    return null;
  }
}

// ── ۷ح. تطبیق هر باکس گلیف با همهٔ قالب‌ها → رتبه‌بندی حروف ────
function matchGlyphTemplates(templates, binImg, boxes) {
  if (!templates || !templates.length) return null;
  const out = [];
  for (const b of boxes) {
    const g = normGlyphToBits(binImg, b, 32, 44);
    const best = new Map();
    for (const t of templates) {
      const d = xorDistance(g, { bits: t.bits, w: t.w, h: t.h });
      if (!best.has(t.ch) || d < best.get(t.ch)) best.set(t.ch, d);
    }
    out.push([...best.entries()].sort((x, y) => x[1] - y[1]));
  }
  return out;
}

// ── ۸. امتیاز خوانش منفرد — طول هدف و الفبای هدف ─────────────
function scoreText(text, confidence, minLen, maxLen, caseInsensitive, lettersOnly) {
  let clean = (text || '').replace(/[^A-Za-z0-9]/g, '');
  if (lettersOnly) clean = clean.replace(/[^A-Za-z]/g, ''); // رقم = خوانش نامعتبر → حذف + جریمهٔ طول
  if (caseInsensitive) clean = clean.toLowerCase();
  let score = confidence * 0.5; // اطمینان Tesseract روی این کپچاها کم‌ارزش است
  if (clean.length >= minLen && clean.length <= maxLen) score += 25;
  else score -= Math.abs(Math.round((minLen + maxLen) / 2) - clean.length) * 12;
  if (clean.length > 1 && new Set(clean).size < clean.length / 2) score -= 15;
  return { score, clean };
}

// ── ۹. Worker مشترک + حالت‌های PSM ───────────────────────────
let _workerPromise = null;
let _workerKey = '';
function getWorker(opts = {}) {
  // langPath قابل تنظیم است: مدل دقیق‌تر tessdata_best به‌جای مدل fast
  const langPath = opts.langPath || '';
  const key = langPath;
  if (!_workerPromise || _workerKey !== key) {
    if (_workerPromise) _workerPromise.then(w => w.terminate()).catch(() => {});
    _workerKey = key;
    _workerPromise = Tesseract.createWorker('eng', 1, {
      cachePath: path.join(__dirname, 'tessdata'),
      ...(langPath ? { langPath } : {}),
      errorHandler: () => {},
    }).then(async (worker) => {
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      });
      return worker;
    });
  }
  return _workerPromise;
}

const PSM_FAST = ['SINGLE_WORD', 'RAW_LINE'];                      // PSM 8, 13 — بهترین‌ها
const PSM_ALL = ['SINGLE_WORD', 'RAW_LINE', 'SINGLE_LINE', 'SINGLE_BLOCK'];
const psmValue = (name) => Tesseract.PSM[name];

// ── ۱۰. حل یک تصویر کپچا (Buffer یا مسیر فایل) ───────────────
async function solveImage(input, opts = {}) {
  const cfg = {
    upscale: 4,
    thresholds: [0.42, 0.5, 0.58],
    lineRemoval: true,
    minLength: 5,
    maxLength: 5,
    // دیتای لیبل‌شده کاربر نشان داد جواب همیشه حروف کوچک است (سامانه case-insensitive) —
    // خروجی بعد از خوانش به حروف کوچک نرمال می‌شود (scoreText). whitelist باید کامل بماند
    // چون گلیف‌های تصویر mixed-case هستند و محدودکردن کلاس‌ها به lowercase دقت Tesseract را خراب می‌کند
    caseInsensitive: true,
    // هر ۶ نمونه واقعی کاربر فقط حرف بودند (۰ رقم در ۳۰ کاراکتر) → جواب همیشه فقط حروف است؛
    // خوانش‌های دارای رقم نامعتبرند و حذف رقم در آن‌ها جریمهٔ طول می‌گیرد (کاندید اشتباه باقی نمی‌ماند)
    // نمونه‌های واقعی نشان داد ارقام هم در جواب هست (مثل 83cfr/vwexh/pytr6) → ارقام مجازند؛
    // شبکهٔ عصبی گلیف کلاس‌های رقم 2-9 را دارد و scoreText طول صحیح را می‌سنجد
    lettersOnly: false,
    // خوانش کاراکتر-به-کاراکتر: گلیف‌های جداشده هرکدام جدا با PSM 10 خوانده می‌شوند
    perChar: true,
    debug: false,
    debugDir: path.join(__dirname, 'debug'),
    langPath: '',
    ...opts,
  };
  // whitelist همیشه کامل: شکل گلیف‌ها mixed-case است؛ نرمال‌سازی به lowercase بعد از خوانش انجام می‌شود
  const WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  const buf = Buffer.isBuffer(input) ? input : fs.readFileSync(path.resolve(input));
  const gray = toGray(PNG.sync.read(buf));

  const worker = await getWorker({ langPath: cfg.langPath });
  const results = [];
  const perCharVotes = []; // رأی‌های تک‌حرف مرحلهٔ ۰ برای واکشی موقعیتی
  const saveDbg = (name, img) => {
    if (!cfg.debug) return;
    fs.mkdirSync(cfg.debugDir, { recursive: true });
    fs.writeFileSync(path.join(cfg.debugDir, `var_${name}.png`), imgToPng(img));
  };
  const runOcr = async (label, img, psmName) => {
    try {
      await worker.setParameters({
        tessedit_char_whitelist: WHITELIST,
        tessedit_pageseg_mode: psmValue(psmName),
      });
      const { data } = await worker.recognize(imgToPng(img));
      const { score, clean } = scoreText(data.text, data.confidence || 0,
        cfg.minLength, cfg.maxLength, cfg.caseInsensitive, cfg.lettersOnly);
      results.push({ text: clean, score, variant: `${label}/${psmName}`, confidence: Math.round(data.confidence || 0) });
    } catch (e) { /* یک خوانش خراب نباید همه را بکشد */ }
  };

  // ساخت واریانت‌های پایه
  const bin1x = binarize(gray, 0);
  const mask = cfg.lineRemoval ? detectLineMask(bin1x) : null;
  const grayClean = mask ? applyMaskGray(gray, mask) : gray;
  const grayBigClean = bilinearUpscale(grayClean, cfg.upscale);
  const grayBigRaw = bilinearUpscale(gray, cfg.upscale);
  const binBig = despeckle(stripThinNoise(binarize(grayBigClean, 0)));

  // ── مرحله ۰ (کاراکتری): جداسازی گلیف‌ها و خواندن تک‌تک با PSM 10 —
  // دقت خوانش تک‌حرف بسیار بالاتر از کل-کلمه است؛ نتیجه مثل یک خوانش معمولی وارد اجماع می‌شود
  if (cfg.perChar) {
    const expected = Math.round((cfg.minLength + cfg.maxLength) / 2);
    const boxes = segmentGlyphs(binBig, expected);
    if (boxes) {
      const pad = cfg.upscale * 6;
      // دو واریانت باینری (استاندارد + پررنگ‌تر) → دو رأی مستقل برای هر جایگاه
      const sources = [binBig, despeckle(stripThinNoise(binarize(grayBigClean, 0.12)))];
      for (let si = 0; si < sources.length; si++) {
        const chars = [];
        for (const b of boxes) {
          try {
            await worker.setParameters({
              tessedit_char_whitelist: WHITELIST,
              tessedit_pageseg_mode: Tesseract.PSM.SINGLE_CHAR,
            });
            const { data } = await worker.recognize(cropBinPng(sources[si], b, pad));
            const t = (data.text || '').replace(/[^A-Za-z0-9]/g, '');
            chars.push(t ? { ch: t[0].toLowerCase(), conf: data.confidence || 0 } : null);
          } catch (e) { chars.push(null); }
        }
        chars.forEach((c, i) => { if (c) perCharVotes.push({ pos: i, ch: c.ch, conf: c.conf }); });
        if (chars.every(Boolean)) {
          const word = chars.map(c => c.ch).join('');
          const conf = chars.reduce((s, c) => s + c.conf, 0) / chars.length;
          const { score, clean } = scoreText(word, conf * 0.9,
            cfg.minLength, cfg.maxLength, cfg.caseInsensitive, cfg.lettersOnly);
          results.push({ text: clean, score, variant: `perchar${si}`, confidence: Math.round(conf) });
        }
      }
      saveDbg('perchar', binBig);

      // ۳) طبقه‌بند قالبی — مستقل از Tesseract؛ رأی موقعیتی (top-2) + کلمهٔ کامل
      const tpl = await buildTemplates();
      if (tpl) {
        // تطبیق روی دو باینری (استاندارد + پررنگ‌تر) برای تنوع لبه‌ها
        const tplSources = [binBig, despeckle(stripThinNoise(binarize(grayBigClean, 0.12)))];
        let primaryRanked = null;
        for (const src of tplSources) {
          const rankedPerPos = matchGlyphTemplates(tpl, src, boxes);
          if (!rankedPerPos) continue;
          if (!primaryRanked) primaryRanked = rankedPerPos;
          if (cfg.debug) {
            console.log('[tmpl] ' + rankedPerPos.map(r =>
              r.slice(0, 3).map(x => `${x[0]}:${x[1].toFixed(2)}`).join('|')).join('  '));
          }
          rankedPerPos.forEach((ranked, i) => {
            if (!ranked.length) return;
            const [ch1, d1] = ranked[0];
            const [ch2, d2] = ranked[1] || [ch1, 1];
            if (d1 < 0.55) {
              const conf01 = Math.max(0, 1 - d1 / 0.55);
              const margin = Math.max(0, Math.min(1, (d2 - d1) / 0.15));
              const base = 40 + 60 * conf01;
              // conf تا ~۱۴۰ → بعد از ضریب ۰٫۴ در واکشی، وزن تا ~۵۶
              perCharVotes.push({ pos: i, ch: ch1, conf: base + 40 * margin });
              // گزینهٔ دوم: وقتی حاشیه کم است تقریباً هم‌وزنِ اول رأی می‌گیرد
              if (ch2 !== ch1) {
                perCharVotes.push({ pos: i, ch: ch2, conf: base * (1 - margin) * 0.7 });
              }
            }
          });
        }
        if (primaryRanked) {
          const word = primaryRanked.map(r => (r.length ? r[0][0] : '')).join('');
          const avgD = primaryRanked.reduce((s, r) => s + (r.length ? r[0][1] : 1), 0) / primaryRanked.length;
          const conf = Math.round(Math.max(0, Math.min(95, (1 - avgD / 0.55) * 100)));
          const { score, clean } = scoreText(word, conf,
            cfg.minLength, cfg.maxLength, cfg.caseInsensitive, cfg.lettersOnly);
          results.push({ text: clean, score: score + 5, variant: 'tmpl', confidence: conf });
        }
      }

      // ۳الف) طبقه‌بند عصبی MLP (بدون وابستگی) — رأی موقعیتی top-2 + کاندید کلمهٔ کامل «nn»
      const nn = getNN();
      if (nn) {
        const nnSources = [binBig, despeckle(stripThinNoise(binarize(grayBigClean, 0.12)))];
        let nnRanked = null;
        for (const src of nnSources) {
          const rankedPerPos = boxes.map(b => nn.classify(normGlyphToBits(src, b, 32, 44)) || []);
          if (!nnRanked) nnRanked = rankedPerPos;
          rankedPerPos.forEach((ranked, i) => {
            if (!ranked.length) return;
            const [ch1, p1] = ranked[0];
            const [ch2, p2] = ranked[1] || [ch1, 0];
            if (p1 < 0.2) return;
            const base = 30 + 70 * p1; // p1≈1 → رأیِ قوی (~100 مثل قالبیِ مطمئن)
            perCharVotes.push({ pos: i, ch: ch1, conf: base });
            if (ch2 !== ch1 && p2 > 0.08) perCharVotes.push({ pos: i, ch: ch2, conf: base * 0.45 });
          });
        }
        if (nnRanked && nnRanked.every(r => r.length)) {
          const word = nnRanked.map(r => r[0][0]).join('');
          const avgP = nnRanked.reduce((s, r) => s + r[0][1], 0) / nnRanked.length;
          const conf = Math.round(avgP * 100);
          const { score, clean } = scoreText(word, conf,
            cfg.minLength, cfg.maxLength, cfg.caseInsensitive, cfg.lettersOnly);
          results.push({ text: clean, score: score + 6, variant: 'nn', confidence: conf });
          if (cfg.debug) console.log('[nn] ' + nnRanked.map(r =>
            r.slice(0, 3).map(x => `${x[0]}:${x[1].toFixed(2)}`).join('|')).join('  '));
        }
      }
    }
  }

  // ── مرحله ۱ (سریع): ۶ خوانش روی ۳ واریانت × ۲ PSM
  saveDbg('gray-clean', grayBigClean);
  saveDbg('gray-raw', grayBigRaw);
  saveDbg('bin', binBig);
  await runOcr('gray-clean', grayBigClean, 'SINGLE_WORD');
  await runOcr('gray-clean', grayBigClean, 'RAW_LINE');
  await runOcr('gray-raw', grayBigRaw, 'SINGLE_WORD');
  await runOcr('gray-raw', grayBigRaw, 'RAW_LINE');
  await runOcr('bin', binBig, 'SINGLE_WORD');
  await runOcr('bin', binBig, 'RAW_LINE');

  // ── تجمیع اجماعی: خوانش تکرارشونده پاداش می‌گیرد
  const group = (rows) => {
    const g = {};
    for (const r of rows) {
      if (!r.text) continue;
      if (!g[r.text]) g[r.text] = { text: r.text, score: 0, count: 0, confidence: 0, variant: r.variant };
      g[r.text].score += r.score;
      g[r.text].count++;
      g[r.text].confidence = Math.max(g[r.text].confidence, r.confidence);
      g[r.text].variant = r.variant;
    }
    return Object.values(g)
      .map(x => ({ ...x, score: x.score + 12 * (x.count - 1) }))
      .sort((a, b) => b.score - a.score);
  };

  let ranked = group(results);

  // ── مرحله ۲ (کامل): اگر بهترین اجماع قوی نبود، جستجوی گسترده
  const GOOD_ENOUGH = 55;
  if (!ranked.length || ranked[0].score < GOOD_ENOUGH) {
    const more = [];
    for (const t of cfg.thresholds) {
      const b1 = binarize(gray, t - 0.5);
      const m = cfg.lineRemoval ? detectLineMask(b1) : null;
      const gc = m ? applyMaskGray(gray, m) : gray;
      const gBig = bilinearUpscale(gc, cfg.upscale);
      const name = `t${t}`;
      saveDbg(`${name}-clean`, gBig);
      more.push(['bin-clean', despeckle(binarize(gBig, 0))]);
      more.push([`gray-${name}`, gBig]);
    }
    for (const [label, img] of more)
      for (const psmName of PSM_ALL) await runOcr(label, img, psmName);
    ranked = group(results);
  }

  // ── واکشی موقعیتی (fusion): هر جایگاه با رأی اکثریت وزن‌دار پر می‌شود —
  // فقط خوانش‌های «دقیقاً ۵-حرفی» رأی کل-کلمه‌ای می‌دهند (خوانش‌های دارای حرف جاافتاده/اضافی رد می‌شوند)
  // و رأی‌های تک‌حرف مرحلهٔ ۰ هم با وزن اطمینان اضافه می‌شوند
  {
    const exp = Math.round((cfg.minLength + cfg.maxLength) / 2);
    const pos = Array.from({ length: exp }, () => ({}));
    let cnt = 0, scoreSum = 0;
    for (const r of results) {
      if (r.variant === 'fused' || r.text.length !== exp) continue;
      cnt++;
      scoreSum += r.score;
      // وزن تخت: خوانش کل-کلمه singly قابل‌اعتماد نیست؛ اجماع با شمارش انجام می‌شود
      for (let i = 0; i < exp; i++) pos[i][r.text[i]] = (pos[i][r.text[i]] || 0) + 25;
    }
    for (const v of perCharVotes) pos[v.pos][v.ch] = (pos[v.pos][v.ch] || 0) + v.conf * 0.4;
    if (cnt || perCharVotes.length >= exp) {
      const word = pos.map(m => {
        const e = Object.entries(m).sort((a, b) => b[1] - a[1]);
        return e.length ? e[0][0] : '';
      }).join('');
      if (word.length === exp) {
        const avgScore = cnt ? scoreSum / cnt : 40;
        const { score, clean } = scoreText(word, Math.min(95, avgScore * 0.8 + 10),
          cfg.minLength, cfg.maxLength, cfg.caseInsensitive, cfg.lettersOnly);
        results.push({ text: clean, score: score + 8, variant: 'fused', confidence: 70 });
        ranked = group(results);
      }
    }
  }

  if (cfg.debug) {
    fs.mkdirSync(cfg.debugDir, { recursive: true });
    fs.writeFileSync(path.join(cfg.debugDir, 'last-results.json'),
      JSON.stringify({ winner: ranked[0] || null, ranked: ranked.slice(0, 6), raw: results }, null, 2));
  }
  return {
    text: ranked.length ? ranked[0].text : '',
    confidence: ranked.length ? ranked[0].confidence : 0,
    candidates: ranked.slice(0, 3).map(r => ({ text: r.text, score: Math.round(r.score), variant: r.variant })),
    source: 'tesseract',
  };
}

// ── ۱۱. اجرای مستقل برای تست روی فایل‌های نمونه ───────────────
if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.log('استفاده: node captcha-solver.js <تصویر1.png> [تصویر2.png ...]');
    process.exit(0);
  }
  (async () => {
    // BEST=1 → مدل دقیق‌تر tessdata_best (به‌جای مدل fast)
    const langPath = process.env.BEST
      ? 'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_best@main'
      : '';
    for (const f of files) {
      const t0 = Date.now();
      const r = await solveImage(f, { debug: true, langPath });
      console.log(`=> ${path.basename(f)} : "${r.text}"  (${Date.now() - t0}ms)`);
      console.log(`   cand: ${r.candidates.map(c => `${c.text}(${c.score}/${c.variant})`).join('  |  ')}`);
    }
    const w = await getWorker({ langPath });
    await w.terminate();
  })().catch(e => { console.error('ERR', e.message); process.exit(1); });
}

module.exports = {
  solveImage, getWorker,
  // ابزارهای داخلی برای اسکریپت‌های آموزش/سنجش (tools/*)
  _internals: { toGray, binarize, despeckle, stripThinNoise, bilinearUpscale, detectLineMask, applyMaskGray, segmentGlyphs, normGlyphToBits, xorDistance, connectedComponents },
};



