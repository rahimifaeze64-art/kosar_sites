#!/usr/bin/env node
// exp.js — آزمایش پارامترهای Tesseract روی یک تصویر
// اجرا: node exp.js <image.png> [image2.png ...]
'use strict';
const fs = require('fs');
const Tesseract = require('tesseract.js');

(async () => {
  const files = process.argv.slice(2);
  const worker = await Tesseract.createWorker('eng', 1, { cachePath: './tessdata', errorHandler: () => {} });
  const psms = {
    '7-line': Tesseract.PSM.SINGLE_LINE,
    '8-word': Tesseract.PSM.SINGLE_WORD,
    '6-block': Tesseract.PSM.SINGLE_BLOCK,
    '13-raw': Tesseract.PSM.RAW_LINE,
    '11-sparse': Tesseract.PSM.SPARSE_TEXT,
  };
  for (const file of files) {
    console.log(`\n===== ${file} =====`);
    for (const [name, psm] of Object.entries(psms)) {
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        tessedit_pageseg_mode: psm,
      });
      const { data } = await worker.recognize(fs.readFileSync(file));
      console.log(`  whitelist+  psm=${name.padEnd(9)} → "${data.text.trim()}"  conf=${Math.round(data.confidence)}`);
    }
    await worker.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE });
    const { data } = await worker.recognize(fs.readFileSync(file));
    console.log(`  no-wl       psm=7-line   → "${data.text.trim()}"  conf=${Math.round(data.confidence)}`);
  }
  await worker.terminate();
})().catch(e => { console.error(e); process.exit(1); });
