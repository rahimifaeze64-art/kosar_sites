'use strict';
// ── طبقه‌بند عصبی سبک گلیف (MLP بدون وابستگی) ─────────────────
// ورودی: بیت‌مپ نرمال‌شدهٔ گلیف (از normGlyphToBits) — خروجی: [ [char, prob], ... ] مرتب
// مدل: models/glyph-mlp.json — با tools/train-nn.js آموزش داده می‌شود
const fs = require('fs');
const path = require('path');
const MODEL_PATH = path.join(__dirname, 'models', 'glyph-mlp.json');
let _model;

function f32FromB64(b64) {
  const buf = Buffer.from(b64, 'base64');
  const a = new Float32Array(buf.length / 4);
  for (let i = 0; i < a.length; i++) a[i] = buf.readFloatLE(i * 4);
  return a;
}

function loadModel() {
  if (_model !== undefined) return _model;
  try {
    const raw = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
    _model = {
      iw: raw.iw, ih: raw.ih, hidden: raw.hidden, classes: raw.classes,
      W1: f32FromB64(raw.W1), b1: f32FromB64(raw.b1),
      W2: f32FromB64(raw.W2), b2: f32FromB64(raw.b2),
    };
  } catch (e) { _model = null; }
  return _model;
}

// n = { bits: Uint8Array, w, h } — بیت‌مپ ۳۲-پیکسلی نرمال‌شده
function classify(n) {
  const m = loadModel();
  if (!m || !n || !n.bits || !n.w || !n.h) return null;
  const { iw, ih, hidden, classes, W1, b1, W2, b2 } = m;
  // تغییر مقیاس به شبکهٔ ثابت iw×ih با میانگین‌گیری ناحیه‌ای
  const x = new Float32Array(iw * ih);
  for (let y = 0; y < ih; y++) {
    const sy0 = Math.floor((y * n.h) / ih), sy1 = Math.max(sy0 + 1, Math.ceil(((y + 1) * n.h) / ih));
    for (let x2 = 0; x2 < iw; x2++) {
      const sx0 = Math.floor((x2 * n.w) / iw), sx1 = Math.max(sx0 + 1, Math.ceil(((x2 + 1) * n.w) / iw));
      let s = 0, c = 0;
      for (let sy = sy0; sy < Math.min(n.h, sy1); sy++)
        for (let sx = sx0; sx < Math.min(n.w, sx1); sx++) { c++; s += n.bits[sy * n.w + sx]; }
      x[y * iw + x2] = c ? s / c : 0;
    }
  }
  const a1 = new Float32Array(hidden);
  // لایهٔ پنهان — W1 به‌صورت [hidden × iw*ih] ذخیره شده
  for (let j = 0; j < hidden; j++) {
    let sum = b1[j];
    const off = j * iw * ih;
    for (let q = 0; q < iw * ih; q++) sum += W1[off + q] * x[q];
    a1[j] = sum > 0 ? sum : 0;
  }
  const scores = new Array(classes.length);
  let mx = -Infinity;
  for (let k = 0; k < classes.length; k++) {
    let sum = b2[k]; const off = k * hidden;
    for (let j = 0; j < hidden; j++) sum += W2[off + j] * a1[j];
    scores[k] = sum; if (sum > mx) mx = sum;
  }
  let Z = 0;
  for (let k = 0; k < scores.length; k++) { scores[k] = Math.exp(scores[k] - mx); Z += scores[k]; }
  return classes.map((c, k) => [c, scores[k] / Z]).sort((a, b) => b[1] - a[1]);
}

module.exports = { classify, loadModel };
