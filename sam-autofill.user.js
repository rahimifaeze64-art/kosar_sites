// ==UserScript==
// @name         پرکردن خودکار فرم ورود — سامانه دانشگاه قم
// @namespace    edu-system-sam-autofill
// @version      1.0
// @description  شماره دانشجویی و رمز سامانه را در فرم ورود edu.qom.ac.ir می‌گذارد و کد امنیتی را با هوش مصنوعی حل می‌کند
// @match        https://edu.qom.ac.ir/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const LOGIN_HASH = '#/auth/login';
  const API_KEY = 'aa-MaF9tn3w0Wga3E9kSChiIIZmpAIGE4rlTx2EiMIN52OUyWjR';
  const BASE_URL = 'https://api.avalai.ir/v1';
  const MODEL = 'qwen3.8-flash';

  const log = (...m) => console.log('%c[SamAutofill]', 'color:#84cc16;font-weight:bold', ...m);

  // ── خواندن اعتبارها: اولویت با کلیپ‌بورد، سپس localStorage ──
  function readCreds() {
    try {
      const raw = localStorage.getItem('sam_autofill');
      if (!raw) return null;
      const p = JSON.parse(raw);
      // فقط ۲ دقیقه اعتبار دارد — کلیک قدیمی دوباره استفاده نشود
      if (!p || !p.username || Date.now() - (p.ts || 0) > 120000) return null;
      return p;
    } catch (e) { return null; }
  }

  function findInput(name) {
    return document.querySelector(`input[name="${name}"]`)
      || (name === 'UserName'
        ? [...document.querySelectorAll('input[type="text"]')].find(i => /شناسه کاربری/.test(i.placeholder || ''))
        : [...document.querySelectorAll('input[type="password"]')][0]);
  }

  function setCaptchaInput(val) {
    const inp = document.querySelector('input[name="Captcha"]')
      || [...document.querySelectorAll('input[type="text"]')].find(i => /کد امنیتی/.test(i.placeholder || ''));
    if (!inp) return null;
    setVal(inp, val);
    return inp;
  }

  // ست کردن مقدار سازگار با Angular
  function setVal(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ── حل کپچا با مدل بینایی AI ────────────────────────────────
  async function solveCaptcha(imgEl) {
    // تبدیل تصویر به base64 (از src یا خود عنصر)
    let b64 = '';
    if (imgEl && imgEl.src && imgEl.src.startsWith('data:image')) {
      b64 = imgEl.src.split(',')[1];
    } else if (imgEl) {
      const canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth || imgEl.width;
      canvas.height = imgEl.naturalHeight || imgEl.height;
      canvas.getContext('2d').drawImage(imgEl, 0, 0);
      b64 = canvas.toDataURL('image/png').split(',')[1];
    }
    if (!b64) return '';

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'این تصویر یک کپچای متنی است. فقط و فقط کاراکترهای داخل تصویر را بدون هیچ توضیح اضافه، دقیقا همان‌طور که می‌بینی بنویس. هیچ چیز دیگری ننویس.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
          ],
        }],
        max_tokens: 32,
        temperature: 0,
      }),
    });
    if (!res.ok) throw new Error(`AI API ${res.status}`);
    const data = await res.json();
    return String(data?.choices?.[0]?.message?.content || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  // ── جریان اصلی ──────────────────────────────────────────────
  async function run() {
    if (!location.hash.includes(LOGIN_HASH)) return;
    const creds = readCreds();
    if (!creds) { log('اعتباری یافت نشد — فرم دستی پر می‌شود'); return; }

    // صبر تا رندر Angular
    for (let i = 0; i < 40; i++) {
      const u = findInput('UserName');
      const p = findInput('Password');
      if (u && p) break;
      await new Promise(r => setTimeout(r, 250));
    }
    const userIn = findInput('UserName');
    const passIn = findInput('Password');
    if (!userIn || !passIn) { log('فرم پیدا نشد'); return; }

    setVal(userIn, creds.username);
    setVal(passIn, creds.password);
    log('✅ نام کاربری و گذرواژه پر شد');
    localStorage.removeItem('sam_autofill');

    // کپچا
    try {
      const capImg = document.querySelector('.captcha img') || document.querySelector('img#ci');
      if (capImg) {
        log('⏳ در حال حل کپچا با هوش مصنوعی...');
        const code = await solveCaptcha(capImg);
        if (code) {
          setCaptchaInput(code);
          log(`🧩 کپچا: «${code}» — دکمه ورود را بزن`);
        } else {
          log('کپچا خوانده نشد — دستی وارد کن');
        }
      }
    } catch (e) {
      log('خطای حل کپچا:', e.message, '— دستی وارد کن');
    }
  }

  // Angular مسیرها را با hash عوض می‌کند
  window.addEventListener('hashchange', () => setTimeout(run, 600));
  setTimeout(run, 800);
})();
