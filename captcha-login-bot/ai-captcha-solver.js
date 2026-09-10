#!/usr/bin/env node
// ============================================================
// ai-captcha-solver.js — حل کپچا با مدل هوش مصنوعی بینایی (Vision)
// تصویر کپچا به مدل qwen3.8-flash (پیش‌فرض) داده می‌شود و متن
// خوانده‌شده برمی‌گردد.
//
// تنظیمات (محیط):
//   AVALAI_API_KEY   کلید API (اجباری)
//   AVALAI_BASE_URL  پیش‌فرض: https://api.avalai.ir/v1
//   AVALAI_MODEL     پیش‌فرض: qwen3.8-flash
//
// اجرای مستقل برای تست:
//   node ai-captcha-solver.js img1.png [img2.png ...]
// ============================================================
'use strict';

const fs = require('fs');

const API_KEY = process.env.AVALAI_API_KEY || 'aa-MaF9tn3w0Wga3E9kSChiIIZmpAIGE4rlTx2EiMIN52OUyWjR';
const BASE_URL = (process.env.AVALAI_BASE_URL || 'https://api.avalai.ir/v1').replace(/\/+$/, '');
const MODEL = process.env.AVALAI_MODEL || 'qwen3.8-flash';

const PROMPT = [
  'این تصویر یک کپچای متنی است.',
  'فقط و فقط کاراکترهای داخل تصویر را بدون هیچ توضیح اضافه بنویس.',
  'قواعد:',
  '- فقط رشته نهایی را برگردان (مثلا: vwexh)',
  '- حروف بزرگ/کوچک را دقیقا همان‌طور که می‌بینی بنویس',
  '- اگر عدد بود عدد بنویس، اگر حرف بود حرف بنویس',
  '- هیچ فضای خالی، نقطه، علامت یا کلمه اضافه ننویس',
].join(' ');

function isConfigured() {
  return API_KEY.length > 0;
}

// ── حل یک تصویر (Buffer یا مسیر فایل) با مدل AI ─────────────
async function solveWithAI(imageInput) {
  if (!API_KEY) {
    throw new Error('AVALAI_API_KEY تنظیم نشده است — حل با مدل AI غیرفعال');
  }

  const buf = Buffer.isBuffer(imageInput)
    ? imageInput
    : fs.readFileSync(imageInput);
  const b64 = buf.toString('base64');

  const body = {
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${b64}` },
          },
        ],
      },
    ],
    max_tokens: 32,
    temperature: 0,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`AI API ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    let text = data?.choices?.[0]?.message?.content || '';
    // پاکسازی: فقط کاراکترهای مجاز کپچا (حرف/عدد) + یکدست‌سازی حروف کوچک
    text = String(text).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return { text, model: MODEL, raw: data?.choices?.[0]?.message?.content };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { solveWithAI, isConfigured, MODEL, BASE_URL };

// ── اجرای مستقل: node ai-captcha-solver.js img.png ... ──────
if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.log('استفاده: node ai-captcha-solver.js <تصویر1> [تصویر2 ...]');
    process.exit(0);
  }
  (async () => {
    for (const f of files) {
      try {
        const t0 = Date.now();
        const r = await solveWithAI(f);
        console.log(`🧩 ${f} → «${r.text}» (${Date.now() - t0}ms، مدل ${r.model})`);
      } catch (e) {
        console.error(`❌ ${f}: ${e.message}`);
      }
    }
  })();
}
