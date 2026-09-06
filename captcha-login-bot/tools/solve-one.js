'use strict';
// حلِ تک‌تصویر و چاپ حدس برای تخمین دقت توسط کاربر
// مصرف: node tools/solve-one.js <مسیر-تصویر> [پاسخ-درست-اختیاری]
const path = require('path');
const { solveImage } = require('../captcha-solver');

(async () => {
  const file = process.argv[2];
  const truth = process.argv[3] ? process.argv[3].toLowerCase() : null;
  if (!file) { console.error('usage: node tools/solve-one.js <image> [answer]'); process.exit(1); }
  const t0 = Date.now();
  const r = await solveImage(file, { debug: true });
  console.log('========================================');
  console.log(`IMAGE : ${path.basename(file)}`);
  console.log(`GUESS : "${r.text}"`);
  console.log(`CONF  : ${r.confidence}%   (${Date.now() - t0}ms)`);
  if (r.candidates && r.candidates.length) {
    console.log('CANDIDATES:');
    for (const c of r.candidates) console.log(`   ${c.text}  score=${c.score} variant=${c.variant}`);
  }
  if (truth) {
    console.log(`TRUTH : "${truth}"  →  ${r.text.toLowerCase() === truth ? '✅ HIT' : '❌ MISS'}`);
  }
  console.log('========================================');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
