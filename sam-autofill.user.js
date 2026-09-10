// ==UserScript==
// @name         پرکردن خودکار فرم ورود — سامانه دانشگاه قم
// @namespace    edu-system-sam-autofill
// @version      2.0
// @description  شماره دانشجویی و رمز سامانه در فرم ورود edu.qom.ac.ir می‌گذارد و کد امنیتی را با هوش مصنوعی حل می‌کند
// @match        https://edu.qom.ac.ir/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      api.avalai.ir
// ==/UserScript==

(function () {
  'use strict';

  const LOGIN_HASH = '#/auth/login';
  const API_KEY = 'aa-MaF9tn3w0Wga3E9kSChiIIZmpAIGE4rlTx2EiMIN52OUyWjR';
  const BASE_URL = 'https://api.avalai.ir/v1';
  const MODEL = 'qwen3.8-flash';

  const log = (...m) => console.log('%c[SamAutofill]', 'color:#84cc16;font-weight:bold', ...m);

  // ── UI شناور — نشانه فعال بودن اسکریپت ──────────────────────
  let statusEl;
  function buildUI() {
    if (document.getElementById('sam-af-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'sam-af-btn';
    btn.innerHTML = '🤖 ورود خودکار';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '18px', left: '18px', zIndex: 999999,
      background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', color: '#fff',
      padding: '10px 18px', borderRadius: '999px', cursor: 'pointer',
      font: 'bold 13px Vazirmatn, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.35)',
      userSelect: 'none',
    });
    btn.addEventListener('click', () => run(true));

    statusEl = document.createElement('div');
    statusEl.id = 'sam-af-status';
    Object.assign(statusEl.style, {
      position: 'fixed', bottom: '58px', left: '18px', zIndex: 999999,
      background: 'rgba(15,23,42,.92)', color: '#e2e8f0',
      padding: '6px 12px', borderRadius: '10px',
      font: '12px Vazirmatn, sans-serif', display: 'none', maxWidth: '320px',
    });
    document.body.appendChild(btn);
    document.body.appendChild(statusEl);
  }
  function setStatus(text, ms) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.display = 'block';
    if (ms) setTimeout(() => { statusEl.style.display = 'none'; }, ms);
  }

  // ── خواندن اعتبارها ─────────────────────────────────────────
  // اولویت: کوئری‌پارامتر ?sam=  →  حافظه نشست  →  کلیپ‌بورد
  let memCreds = null;

  function decodePayload(str) {
    try {
      const json = decodeURIComponent(escape(atob(str)));
      const p = JSON.parse(json);
      if (p && p.username && p.password) return p;
    } catch (e) {}
    return null;
  }

  function credsFromURL() {
    try {
      const v = new URLSearchParams(location.search).get('sam');
      if (!v) return null;
      const p = decodePayload(v);
      // پاک کردن پارامتر از نوار آدرس
      const u = new URL(location.href);
      u.searchParams.delete('sam');
      history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + u.hash);
      return p;
    } catch (e) { return null; }
  }

  function credsFromSession() {
    try {
      const raw = sessionStorage.getItem('sam_autofill');
      if (!raw) return null;
      const p = JSON.parse(raw);
      // ۵ دقیقه اعتبار
      if (!p || !p.username || Date.now() - (p.ts || 0) > 300000) return null;
      return p;
    } catch (e) { return null; }
  }

  async function credsFromClipboard() {
    try {
      const txt = await navigator.clipboard.readText();
      const p = JSON.parse(txt);
      if (p && p.username && p.password) return p;
    } catch (e) {}
    return null;
  }

  async function getCreds(allowClipboard) {
    let p = credsFromURL() || memCreds || credsFromSession();
    if (!p && allowClipboard) p = await credsFromClipboard();
    if (p) {
      memCreds = p;
      try { sessionStorage.setItem('sam_autofill', JSON.stringify({ ...p, ts: Date.now() })); } catch (e) {}
    }
    return p;
  }

  // ── یافتن فیلدهای فرم Angular ───────────────────────────────
  function findInput(name) {
    return document.querySelector(`input[name="${name}"]`)
      || (name === 'UserName'
        ? [...document.querySelectorAll('input[type="text"]')].find(i => /شناسه کاربری/.test(i.placeholder || ''))
        : [...document.querySelectorAll('input[type="password"]')][0]);
  }

  function setVal(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  async function waitForForm() {
    for (let i = 0; i < 60; i++) {
      const u = findInput('UserName');
      const p = findInput('Password');
      if (u && p) return { u, p };
      await new Promise(r => setTimeout(r, 250));
    }
    return null;
  }

  // ── اسکرین‌شات تصویر کپچا و ارسال به مدل AI ─────────────────
  async function captureCaptcha() {
    const img = document.querySelector('.captcha img') || document.querySelector('img#ci');
    if (!img) return null;
    if (!img.naturalWidth) {
      await new Promise(r => { if (img.complete) r(); else { img.onload = r; img.onerror = r; setTimeout(r, 1500); } });
    }
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width || 66;
    canvas.height = img.naturalHeight || img.height || 32;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  }

  function aiRequest(body) {
    return new Promise((resolve, reject) => {
      const gm = (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest
               : (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;
      if (gm) {
        gm({
          method: 'POST',
          url: `${BASE_URL}/chat/completions`,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
          data: JSON.stringify(body),
          timeout: 30000,
          onload: r => {
            try {
              const d = JSON.parse(r.responseText);
              resolve(String(d?.choices?.[0]?.message?.content || ''));
            } catch (e) { reject(new Error('پاسخ نامعتبر از AI')); }
          },
          onerror: () => reject(new Error('خطای شبکه به AI')),
          ontimeout: () => reject(new Error('تایم‌اوت AI')),
        });
      } else {
        fetch(`${BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
          body: JSON.stringify(body),
        }).then(r => r.json()).then(d => resolve(String(d?.choices?.[0]?.message?.content || '')))
          .catch(() => reject(new Error('خطای شبکه به AI')));
      }
    });
  }

  async function solveCaptcha() {
    const dataUrl = await captureCaptcha();
    if (!dataUrl) return '';
    const text = await aiRequest({
      model: MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'این تصویر یک کپچای متنی است. فقط و فقط کاراکترهای داخل تصویر را بدون هیچ توضیح اضافه، دقیقا همان‌طور که می‌بینی بنویس. هیچ چیز دیگری ننویس.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
      max_tokens: 32,
      temperature: 0,
    });
    return String(text).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  // ── جریان اصلی پر کردن فرم ──────────────────────────────────
  async function run(manual) {
    const creds = await getCreds(manual);
    if (!creds) {
      if (manual) setStatus('اعتباری پیدا نشد — اول دکمه «ورود به سامانه» را در پنل بزن', 4000);
      return;
    }

    setStatus('⏳ در حال یافتن فرم...');
    const form = await waitForForm();
    if (!form) { setStatus('❌ فرم ورود پیدا نشد', 4000); return; }

    setVal(form.u, creds.username);
    setVal(form.p, creds.password);
    log('نام کاربری و گذرواژه پر شد');
    setStatus('✅ نام کاربری و گذرواژه پر شد', 3000);

    // کپچا
    setStatus('⏳ گرفتن تصویر کپچا و ارسال به هوش مصنوعی...');
    try {
      const code = await solveCaptcha();
      if (code) {
        const capIn = document.querySelector('input[name="Captcha"]')
          || [...document.querySelectorAll('input[type="text"]')].find(i => /کد امنیتی/.test(i.placeholder || ''));
        if (capIn) {
          setVal(capIn, code);
          setStatus(`🧩 کپچا: «${code}» — دکمه ورود را بزن`, 6000);
          log('کپچا:', code);
        }
      } else {
        setStatus('⚠️ کپچا خوانده نشد — دوباره 🤖 را بزن یا دستی وارد کن', 5000);
      }
    } catch (e) {
      log('خطای کپچا:', e.message);
      setStatus(`⚠️ حل کپچا ناموفق (${e.message}) — دستی وارد کن`, 5000);
    }
  }

  // ── شروع ────────────────────────────────────────────────────
  function boot() {
    if (!location.hash.includes(LOGIN_HASH)) return;
    buildUI();
    // اگر از پنل با پارامتر آمده، خودکار اجرا شود
    if (new URLSearchParams(location.search).get('sam')) {
      setTimeout(() => run(false), 800);
    }
  }
  window.addEventListener('hashchange', () => setTimeout(boot, 400));
  setTimeout(boot, 500);
})();
