'use strict';
// ── شناسایی فونت واقعی کپچا با مقایسهٔ XOR گلیف‌ها ─────────────
// گلیف‌های نمونه‌های واقعی (real-samples/<جواب>.png) با رندر فونت‌های
// کاندید مقایسه می‌شوند؛ کمترین فاصلهٔ XOR = برنده. مصرف: node tools/find-font.js
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { chromium } = require('playwright');
const { _internals: I } = require('../captcha-solver');

const SAMPLES_DIR = path.join(__dirname, '..', 'real-samples');
const FONTS = ['Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Arial',
  'Comic Sans MS', 'Georgia', 'Times New Roman', 'Lucida Sans Unicode', 'Impact'];
const WEIGHTS = [400, 700];
const ROTS = [-15, -10, -5, 0, 5, 10, 15];
const CELL = 76, FONT_SIZE = 34, COLS = 14;

function extractRealGlyphs() {
  const files = fs.readdirSync(SAMPLES_DIR).filter(f => /\.png$/i.test(f));
  if (!files.length) { console.error('❌ هیچ نمونهٔ واقعی در real-samples نیست (مثل pytr6.png)'); process.exit(1); }
  const glyphs = [];
  const byClass = new Map();
  for (const f of files) {
    const label = path.basename(f, path.extname(f)).toLowerCase();
    if (!/^[a-z0-9]{4,8}$/.test(label)) { console.error(`⚠️ ${f}: نام فایل باید جواب کپچا باشد`); continue; }
    let gray;
    try { gray = I.toGray(PNG.sync.read(fs.readFileSync(path.join(SAMPLES_DIR, f)))); }
    catch (e) { console.error(`⚠️ ${f}: خواندن PNG ناموفق`); continue; }
    const bin1 = I.binarize(gray, 0);
    const mask = I.detectLineMask(bin1);
    const gc = mask ? I.applyMaskGray(gray, mask) : gray;
    const binBig = I.despeckle(I.stripThinNoise(I.binarize(I.bilinearUpscale(gc, 4), 0)));
    const boxes = I.segmentGlyphs(binBig, label.length);
    if (!boxes || boxes.length !== label.length) {
      console.error(`⚠️ ${f}: جداسازی گلیف ناموفق (${boxes ? boxes.length : 0} از ${label.length})`);
      continue;
    }
    boxes.forEach((b, i) => {
      const n = I.normGlyphToBits(binBig, b, 32, 44);
      const g = { ...n, label: label[i], sample: f, pos: i };
      glyphs.push(g);
      if (!byClass.has(g.label)) byClass.set(g.label, []);
      byClass.get(g.label).push(g);
    });
  }
  return { glyphs, byClass };
}

(async () => {
  const { glyphs, byClass } = extractRealGlyphs();
  if (!glyphs.length) { console.error('❌ هیچ گلیفی استخراج نشد'); process.exit(1); }
  console.log(`✅ ${glyphs.length} گلیف واقعی استخراج شد`);
  const need = new Map(); // نمایش‌کار → برچسب کلاس
  for (const cls of byClass.keys()) {
    need.set(cls, cls);
    if (cls >= 'a' && cls <= 'z') need.set(cls.toUpperCase(), cls);
  }
  const cells = [];
  for (const ch of need.keys()) for (const rot of ROTS) cells.push({ ch, rot });
  const rows = Math.ceil(cells.length / COLS);
  const globalBest = new Map(); // gk → { ch, d } برای اعتبارسنجی برچسب

  let browser = null;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try { browser = await chromium.launch({ headless: true, channel }); break; } catch (e) { /* بعدی */ }
  }
  if (!browser) { console.error('❌ مرورگری در دسترس نیست'); process.exit(1); }
  const page = await browser.newPage();
  const score = new Map();
  for (const font of FONTS) {
    for (const weight of WEIGHTS) {
      const html = cells.map((c, i) =>
        `<div style="position:absolute;left:${(i % COLS) * CELL}px;top:${((i / COLS) | 0) * CELL}px;width:${CELL}px;height:${CELL}px;display:flex;align-items:center;justify-content:center;">` +
        `<span style="font-family:'${font}',sans-serif;font-weight:${weight};font-size:${FONT_SIZE}px;color:#000;display:inline-block;transform:rotate(${c.rot}deg)">${c.ch}</span></div>`).join('');
      await page.setContent(`<body style="margin:0;background:#fff;position:relative;width:${COLS * CELL}px;height:${rows * CELL}px">${html}</body>`);
      const shot = await page.screenshot({ clip: { x: 0, y: 0, width: COLS * CELL, height: rows * CELL } });
      const gray = I.toGray(PNG.sync.read(shot));
      const perGlyph = new Map();
      for (let i = 0; i < cells.length; i++) {
        const t = cropToNorm(gray, (i % COLS) * CELL, ((i / COLS) | 0) * CELL);
        if (!t) continue;
        const cls = need.get(cells[i].ch);
        for (const g of byClass.get(cls)) {
          const d = I.xorDistance(g, t);
          const gk = `${g.sample}#${g.pos}`;
          if (!perGlyph.has(gk) || d < perGlyph.get(gk)) perGlyph.set(gk, d);
          const gb = globalBest.get(gk);
          if (!gb || d < gb.d) globalBest.set(gk, { ch: cls, d });
        }
      }
      let sum = 0, n = 0;
      for (const d of perGlyph.values()) { sum += d; n++; }
      score.set(`${font}|${weight}`, n ? sum / n : Infinity);
      console.log(`  ${font}|${weight}: ${(n ? sum / n : Infinity).toFixed(4)}`);
    }
  }
  await browser.close();

  console.log('\n── رتبه‌بندی فونت‌ها (میانگین فاصلهٔ XOR کمتر = بهتر) ──');
  const ranked = [...score.entries()].sort((a, b) => a[1] - b[1]);
  for (const [k, v] of ranked) console.log(`${v.toFixed(4)}  ${k}`);
  const w = ranked[0][0].split('|'), r2 = ranked[1] ? ranked[1][0].split('|') : w;
  console.log(`\n🏆 برنده: ${ranked[0][0]} — TPL_FONTS پیشنهادی برای captcha-solver.js:`);
  console.log(`const TPL_FONTS = [ { family: '${w[0]}', weight: ${w[1]} }, { family: '${r2[0]}', weight: ${r2[1]} } ];`);

  console.log('\n── اعتبارسنجی برچسب‌ها (بهترین کاراکتر سراسری) ──');
  let bad = 0;
  for (const [gk, gb] of globalBest) {
    const file = gk.split('#')[0];
    const expChar = path.basename(file, path.extname(file)).toLowerCase()[parseInt(gk.split('#')[1], 10)];
    if (gb.ch !== expChar) { bad++; console.log(`  ✗ ${gk}: برچسب=${expChar} ولی بهترین تطبیق=${gb.ch} (d=${gb.d.toFixed(3)})`); }
  }
  console.log(bad ? `⚠️ ${bad} گلیف مشکوک — برچسب‌ها را بررسی/تصحیح کن` : '✅ همهٔ برچسب‌ها با بهترین تطبیق می‌خوانند');
})().catch(e => { console.error('ERR', e); process.exit(1); });

function cropToNorm(gray, cx, cy) {
  const sub = { gray: new Float32Array(CELL * CELL), width: CELL, height: CELL };
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++)
    sub.gray[y * CELL + x] = gray.gray[(cy + y) * gray.width + (cx + x)];
  const b = I.binarize(sub, 0);
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
