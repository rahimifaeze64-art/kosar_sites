'use strict';
// جداکردن همهٔ PNGهای چسبیده در یک فایل کش کلیپ‌بورد + چاپ ابعاد
// مصرف: node tools/split-paste.js <file.tmp>
const fs = require('fs');
const path = require('path');
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const src = process.argv[2];
if (!src) { console.error('usage: node split-paste.js <file>'); process.exit(1); }
const buf = fs.readFileSync(src);
const outDir = path.join(__dirname, '..', 'debug');
fs.mkdirSync(outDir, { recursive: true });
let idx = 0, n = 0;
while (idx < buf.length) {
  const start = buf.indexOf(SIG, idx);
  if (start < 0) break;
  let end = buf.indexOf('IEND', start + 8);
  if (end < 0) end = buf.length; else end += 8; // IEND + CRC
  const png = buf.slice(start, end);
  if (png.length > 33) {
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    const file = path.join(outDir, `paste-${String(n).padStart(2, '0')}-${w}x${h}.png`);
    fs.writeFileSync(file, png);
    console.log(`${file}  ${w}x${h}  ${(png.length / 1024).toFixed(1)}KB`);
    n++;
  }
  idx = end;
}
console.log(`total: ${n}`);
