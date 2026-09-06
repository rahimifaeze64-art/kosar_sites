'use strict';
// ── سنجش سر‌به‌سر حل‌کننده روی نمونه‌های واقعی (نام فایل = جواب) ──
// مصرف: node tools/eval.js
const fs = require('fs');
const path = require('path');
const { solveImage } = require('../captcha-solver');

(async () => {
  const dir = path.join(__dirname, '..', 'real-samples');
  const files = fs.readdirSync(dir).filter(f => /\.png$/i.test(f));
  if (!files.length) { console.error('❌ نمونه‌ای در real-samples نیست'); process.exit(1); }
  let ok = 0;
  const t0 = Date.now();
  for (const f of files) {
    const exp = path.basename(f, path.extname(f)).toLowerCase();
    const r = await solveImage(path.join(dir, f), { debug: true });
    const hit = r.text === exp;
    if (hit) ok++;
    console.log(`${hit ? '✅' : '❌'} ${f}: انتظار=${exp} → "${r.text}" (conf=${r.confidence})  cand=[${r.candidates.map(c => `${c.text}/${c.variant}`).join(' | ')}]`);
  }
  console.log(`\n${ok}/${files.length} درست — میانگین ${Math.round((Date.now() - t0) / files.length)}ms`);
  process.exit(0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
