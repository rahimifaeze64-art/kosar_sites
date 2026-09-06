'use strict';
// تشخیص یک‌بارهٔ مشکل باینری‌سازی نمونه‌های واقعی — مصرف: node tools/diag.js
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const I = require('../captcha-solver')._internals;
const dir = path.join(__dirname, '..', 'real-samples');
const out = path.join(__dirname, '..', 'debug');
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(dir).filter(f => /\.png$/i.test(f))) {
  const png = PNG.sync.read(fs.readFileSync(path.join(dir, f)));
  const { width, height, data } = png;
  let transp = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transp++;
  const gray = I.toGray(png);
  let dark = 0;
  for (let i = 0; i < gray.gray.length; i++) if (gray.gray[i] < 0.5) dark++;
  const bin = I.binarize(gray, 0);
  let ink = 0;
  for (let i = 0; i < bin.bin.length; i++) if (bin.bin[i]) ink++;
  const comps = I.connectedComponents(bin);
  const big = comps.filter(c => c.area >= 16);
  const areas = big.map(c => c.area).sort((a, b) => b - a).slice(0, 14);
  const o = new PNG({ width, height });
  for (let i = 0, p = 0; i < bin.bin.length; i++, p += 4) {
    const v = bin.bin[i] ? 0 : 255;
    o.data[p] = o.data[p + 1] = o.data[p + 2] = v; o.data[p + 3] = 255;
  }
  fs.writeFileSync(path.join(out, 'diag-' + f), PNG.sync.write(o));
  console.log(`${f}: ${width}x${height} transp=${transp} dark=${dark}/${gray.gray.length} ink=${ink} comps(>=16)=${big.length} topAreas=${areas.join(',')}`);
}
