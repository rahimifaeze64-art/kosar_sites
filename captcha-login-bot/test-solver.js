#!/usr/bin/env node
// ============================================================
// test-solver.js — تست دقت حل‌کننده با کپچای مصنوعی شبیه نمونه واقعی
// اجرا:  node test-solver.js [تعداد نمونه]
// نمونه‌های خطا در پوشه debug/ ذخیره می‌شوند (fail-<کد>.png)
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { solveImage, getWorker } = require('./captcha-solver');

// مطابق کپچای واقعی سایت: فقط حروف، بدون i/l/o (سه حرف پرخطا: نقطهٔ i با نویز گم می‌شود، l↔i، o↔e/c)
// — ۶ نمونه لیبل‌شده کاربر صفر رقم داشتند → بدون رقم
const CHARS = 'abcdefghjkmnpqrstuvwxyz';
const COLORS = ['#8f8f3f', '#c8722a', '#2a3a8a', '#5a8a2a'];

function randomCode(len = 5) {
  let s = '';
  for (let i = 0; i < len; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

function captchaHtml(code) {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  let spans = '';
  for (const ch of code) {
    // کپچای واقعی هر حرف را با case تصادفی نمایش می‌دهد (مثل SrMGX) ولی جواب همیشه lowercase است
    const visual = Math.random() < 0.5 ? ch.toUpperCase() : ch;
    const rot = (Math.random() * 36 - 18).toFixed(1);
    const dy = (Math.random() * 10 - 5).toFixed(1);
    spans += `<span style="display:inline-block;transform:rotate(${rot}deg) translateY(${dy}px);` +
      `font-size:32px;font-weight:600;font-family:Georgia,serif;color:${color};margin:0 1px;">${visual}</span>`;
  }
  let lines = '';
  for (let i = 0; i < 8; i++) {
    lines += `<line x1="${(Math.random() * 170).toFixed(0)}" y1="${(Math.random() * 60).toFixed(0)}"` +
      ` x2="${(Math.random() * 170).toFixed(0)}" y2="${(Math.random() * 60).toFixed(0)}"` +
      ` stroke="${color}" stroke-width="1" opacity="0.9"/>`;
  }
  return `<!DOCTYPE html><html><body style="margin:0">
    <div id="cap" style="width:170px;height:60px;background:#e9e9e3;position:relative;overflow:hidden">
      <svg width="170" height="60" style="position:absolute;inset:0">${lines}</svg>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${spans}</div>
    </div></body></html>`;
}

(async () => {
  const N = parseInt(process.argv[2] || '10', 10);
  const debugDir = path.join(__dirname, 'debug');
  fs.mkdirSync(debugDir, { recursive: true });

  // از Chrome/Edge نصب‌شده ویندوز استفاده کن (CDN پلی‌رایت در ایران مسدود است)
  let browser;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try { browser = await chromium.launch({ headless: true, channel }); break; } catch (e) { /* بعدی */ }
  }
  if (!browser) throw new Error('Chrome/Edge پیدا نشد');
  const page = await browser.newPage();

  let ok = 0;
  for (let i = 0; i < N; i++) {
    const code = randomCode(5);
    await page.setContent(captchaHtml(code));
    const shot = await page.locator('#cap').screenshot();
    const r = await solveImage(shot, { debug: false });
    const match = r.text.toLowerCase() === code.toLowerCase();
    if (match) ok++;
    else fs.writeFileSync(path.join(debugDir, `fail-${code}.png`), shot);
    console.log(`${match ? 'OK ' : 'ERR'} real=${code}  solved=${r.text || '-'}  (${r.confidence}%)  cand=${r.candidates.slice(1).map(c => c.text).join(',')}`);
  }
  await browser.close();
  console.log(`\nAccuracy: ${ok}/${N}`);
  const w = await getWorker();
  await w.terminate();
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
