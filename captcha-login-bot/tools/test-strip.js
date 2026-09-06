'use strict';
// تنظیم maxThin برای stripThinNoise: برای هر نمونه تعداد/مساحت کامپوننت‌ها
// پس از حذف وبِ خطوط گزارش می‌شود؛ هدف: دقیقاً len کامپوننت گلیف سالم.
// مصرف: node tools/test-strip.js
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { _internals: I } = require('../captcha-solver');

const dir = path.join(__dirname, '..', 'real-samples');
for (const f of fs.readdirSync(dir).filter(x => /\.png$/i.test(x))) {
  const label = path.basename(f, path.extname(f)).toLowerCase();
  const gray = I.toGray(PNG.sync.read(fs.readFileSync(path.join(dir, f))));
  const big = I.bilinearUpscale(gray, 4);
  for (const mt of [4, 5, 6, 7]) {
    const binBig = I.despeckle(I.stripThinNoise(I.binarize(big, 0), mt));
    const comps = I.connectedComponents(binBig).filter(c => c.area >= 16);
    const boxes = I.segmentGlyphs(binBig, label.length);
    const areas = comps.map(c => c.area).sort((a, b) => b - a);
    console.log(`${f} maxThin=${mt}: comps=${comps.length} seg=${boxes ? boxes.length + '✓' : '✗'} areas=${areas.slice(0, 10).join(',')}${areas.length > 10 ? '…' : ''}`);
  }
  console.log('');
}
