'use strict';
// اجرای دسته‌ای سولور روی همهٔ PNGهای sample/ و مقایسه با labels.json
// مصرف: node tools/batch-solve.js
// خروجی: جدول در کنسول + sample/batch-results.json (ذخیرهٔ تدریجی برای نظارت)
const fs = require('fs');
const path = require('path');
const { solveImage, getWorker } = require('../captcha-solver');

const SAMPLE_DIR = path.join(__dirname, '..', 'sample');
const LABELS = path.join(SAMPLE_DIR, 'labels.json');
const OUT = path.join(SAMPLE_DIR, 'batch-results.json');

(async () => {
  const labels = JSON.parse(fs.readFileSync(LABELS, 'utf8'));
  const files = fs.readdirSync(SAMPLE_DIR)
    .filter(f => /\.png$/i.test(f) && !f.startsWith('_'))
    .sort();

  const rows = [];
  let hits = 0, charHits = 0, charTotal = 0, posHits = [];

  console.log(`batch: ${files.length} فایل — شروع...`);

  for (const f of files) {
    const truth = (labels[f] || '').toLowerCase();
    const t0 = Date.now();
    let r;
    try {
      r = await solveImage(path.join(SAMPLE_DIR, f), { debug: false });
    } catch (e) {
      r = { text: `<ERR: ${e.message}>`, confidence: 0, candidates: [] };
    }
    const guess = (r.text || '').toLowerCase();
    const hit = guess === truth && truth.length > 0;
    if (hit) hits++;
    for (let i = 0; i < truth.length; i++) {
      charTotal++;
      if (guess[i] === truth[i]) charHits++;
    }
    // دقت موقعیت‌به‌موقعیت (برای یافتن جایگاه‌های مشکل‌دار)
    for (let i = 0; i < truth.length; i++) {
      posHits[i] = posHits[i] || [0, 0];
      posHits[i][1]++;
      if (guess[i] === truth[i]) posHits[i][0]++;
    }
    const row = {
      file: f, guess: r.text, truth, hit,
      conf: r.confidence, ms: Date.now() - t0,
      candidates: (r.candidates || []).map(c => `${c.text}(${c.score}/${c.variant})`),
    };
    rows.push(row);
    console.log(`${hit ? 'HIT ' : 'MISS'} ${f}  guess="${r.text}"  truth="${truth}"  conf=${r.confidence}%  (${row.ms}ms)`);
    fs.writeFileSync(OUT, JSON.stringify({ hits, total: rows.length, rows }, null, 2));
  }

  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  console.log('==================================================');
  console.log(`WORDS : ${hits}/${rows.length}  (${pct(hits, rows.length)}%)`);
  console.log(`CHARS : ${charHits}/${charTotal}  (${pct(charHits, charTotal)}%)`);
  posHits.forEach((p, i) => console.log(`  pos${i + 1}: ${p[0]}/${p[1]} (${pct(p[0], p[1])}%)`));
  console.log('==================================================');

  fs.writeFileSync(OUT, JSON.stringify({
    words: `${hits}/${rows.length}`, chars: `${charHits}/${charTotal}`,
    posHits, rows,
  }, null, 2));
  console.log(`ذخیره شد: ${OUT}`);

  try { const w = await getWorker({}); await w.terminate(); } catch (_) {}
})().catch(e => { console.error('ERROR:', e && e.stack || e); process.exit(1); });
