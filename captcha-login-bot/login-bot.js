#!/usr/bin/env node
// ============================================================
// login-bot.js — ورود خودکار به سامانه با حل کپچا
// دیتای دانشجو از students.json (خروجی export-students.html در
// بخش مدیریت دانشجویان) یا آرگومان مستقیم خوانده می‌شود.
//
// نمونه اجرا:
//   node login-bot.js --url "https://example/login" --student "QOM2024001"
//   node login-bot.js --url "..." --username ali --password 123456
//   node login-bot.js --list
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { solveImage } = require('./captcha-solver');
const aiSolver = require('./ai-captcha-solver');

// ── ۱. پارس آرگومان‌ها ───────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  const keysWithVal = ['url', 'student', 'username', 'password', 'user-field', 'pass-field',
    'attempts', 'students-file', 'solve-img'];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--headless') args.headless = true;
    else if (a === '--keep-open') args.keepOpen = true;
    else if (a === '--list') args.list = true;
    else if (a === '--save-session') args.saveSession = argv[++i] || 'session.json';
    else if (keysWithVal.includes(a.replace(/^--/, ''))) args[a.replace(/^--/, '')] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const STUDENTS_FILE = args['students-file'] || path.join(__dirname, 'students.json');

// ── ۲. بارگذاری دانشجویان (خروجی مدیریت دانشجویان) ───────────
function loadStudents() {
  if (!fs.existsSync(STUDENTS_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(STUDENTS_FILE, 'utf8'));
    return Array.isArray(raw) ? raw : (raw.students || []);
  } catch (e) {
    console.error(`❌ students.json قابل خواندن نیست: ${e.message}`);
    return [];
  }
}

function findStudent(list, query) {
  const q = query.trim().toLowerCase();
  return list.find(s =>
    (s.studentId || '').toLowerCase() === q ||
    (s.username || '').toLowerCase() === q ||
    (s.name || '').toLowerCase().includes(q)
  );
}

function pickFromStudent(s) {
  const c = CFG.credentials || {};
  const uKey = args['user-field'] || c.usernameField || 'studentId';
  const pKey = args['pass-field'] || c.passwordField || 'systemPassword';
  const fuKey = c.fallbackUsernameField || 'username';
  const fpKey = c.fallbackPasswordField || 'password';
  const username = s[uKey] || s[fuKey];
  const password = s[pKey] || s[fpKey];
  if (!username || !password) {
    console.error(`❌ فیلدهای ${uKey}/${pKey} برای «${s.name || s.id}» خالی است. با --user-field/--pass-field فیلد درست را بده.`);
    process.exit(1);
  }
  return {
    username: String(username),
    password: String(password),
    source: `دانشجو: ${s.name || s.id} (${uKey}=${username})`,
  };
}

function resolveCredentials() {
  // اولویت: آرگومان مستقیم → دانشجوی انتخابی از students.json
  if (args.username && args.password) {
    return { username: args.username, password: args.password, source: 'آرگومان خط فرمان' };
  }
  const list = loadStudents();
  if (args.student) {
    const s = findStudent(list, args.student);
    if (!s) {
      console.error(`❌ دانشجوی «${args.student}» در students.json پیدا نشد. (--list برای لیست)`);
      process.exit(1);
    }
    return pickFromStudent(s);
  }
  if (list.length === 1) return pickFromStudent(list[0]);
  console.error('❌ نام کاربری/رمز مشخص نشده. از --student "نام|شماره دانشجویی" یا --username/--password استفاده کن.');
  console.error('   (فایل students.json را با export-students.html از بخش مدیریت دانشجویان بساز)');
  process.exit(1);
}

// ── ۳. تشخیص خودکار فیلدهای فرم داخل صفحه ────────────────────
// عناصر با data-bot-field علامت‌گذاری می‌شوند تا Playwright سلکت کند
const DETECT_FN = () => {
  const vis = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
  };
  const attr = (el) => `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.className || ''}`;
  const mark = (el, tag) => { if (el) el.setAttribute('data-bot-field', tag); };

  // رمز عبور
  const pass = [...document.querySelectorAll('input[type=password]')].find(vis);

  // نام کاربری: ورودی‌های متنی قابل مشاهده با امتیازدهی
  const texts = [...document.querySelectorAll('input[type=text], input[type=email], input:not([type])')]
    .filter(el => vis(el) && el !== pass);
  const userScore = (el) => {
    const a = attr(el).toLowerCase();
    let s = 0;
    if (/username|login|uname|user_|_user|userid|account/.test(a)) s += 6;
    if (/کاربری|کاربر/.test(el.placeholder || '')) s += 4;
    if (/^(username|user|login|uid)$/.test(el.name || '') || /^(username|user|login|uid)$/.test(el.id || '')) s += 8;
    if (el.autocomplete === 'username') s += 5;
    return s;
  };
  const user = texts.slice().sort((a, b) => userScore(b) - userScore(a))[0] || texts[0] || null;

  // تصویر کپچا (img یا canvas)
  const captchaHit = (el) => {
    const a = `${el.src || ''} ${el.id || ''} ${el.className || ''} ${el.name || ''}`.toLowerCase();
    return /captcha|cap_|security|verify|random|checkcode/.test(a);
  };
  let capImg = [...document.querySelectorAll('img')].find(el => vis(el) && captchaHit(el));
  let capCanvas = null;
  if (!capImg) {
    capCanvas = [...document.querySelectorAll('canvas')].find(el => {
      const r = el.getBoundingClientRect();
      return vis(el) && r.width >= 60 && r.width <= 400 && r.height >= 20 && r.height <= 120;
    });
  }

  // ورودی کپچا: کلیدواژه یا نزدیک‌ترین ورودی متنی باقی‌مانده
  const capScore = (el) => {
    const a = attr(el).toLowerCase();
    let s = 0;
    if (/captcha|cap_|security|verify|seccode|checkcode/.test(a)) s += 8;
    if (/کد امنیتی|کد تصویر|کد را وارد/.test(el.placeholder || '') || /کد/.test(a)) s += 4;
    const ml = el.maxLength;
    if (ml > 2 && ml <= 8) s += 2;
    return s;
  };
  const remaining = texts.filter(el => el !== user);
  let capIn = remaining.slice().sort((a, b) => capScore(b) - capScore(a))[0] || null;
  if (capIn && capScore(capIn) === 0 && !capImg && !capCanvas) capIn = null;

  // اگر تصویر با کلیدواژه پیدا نشد: نزدیک‌ترین img با اندازه کپچا به ورودی کد
  if (!capImg && !capCanvas && capIn) {
    const scope = capIn.closest('div,td,p,li,fieldset,form') || document.body;
    capImg = [...scope.querySelectorAll('img')].find(el => {
      if (!vis(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 40 && r.width <= 420 && r.height >= 15 && r.height <= 150;
    }) || null;
  }

  // دکمه ارسال
  const btnScore = (el) => {
    const t = `${el.textContent || ''} ${el.value || ''} ${el.id || ''} ${el.name || ''} ${el.className || ''}`.toLowerCase();
    let s = 0;
    if (el.type === 'submit') s += 6;
    if (/ورود|login|sign ?in|ثبت/.test(t)) s += 5;
    return s;
  };
  const btns = [...document.querySelectorAll('button, input[type=submit], input[type=button], a[onclick]')].filter(vis);
  const submit = btns.slice().sort((a, b) => btnScore(b) - btnScore(a))[0] || null;

  // دکمه/لینک رفرش کپچا — با کلیدواژه یا هر دکمه کنار تصویر کپچا
  const refreshKeyword = (el) => {
    const a = `${el.getAttribute('onclick') || ''} ${el.src || ''} ${el.id || ''} ${el.className || ''} ${el.getAttribute('href') || ''} ${el.title || ''}`.toLowerCase();
    return /captcha.*(reload|refresh|new|change)|(reload|refresh|new|change).*captcha|کد جدید|تعویض|refresh|reload/.test(a);
  };
  let refresh = [...document.querySelectorAll('img[onclick], a[onclick], button, a, span, i')]
    .find(el => vis(el) && refreshKeyword(el)) || null;

  const capEl = capImg || capCanvas;
  if (!refresh && capEl && submit !== null) {
    // دکمه رفرش معمولاً در همان ردیف/کادر تصویر کپچا است (نه دکمه ورود)
    let scope = capEl.parentElement;
    for (let hop = 0; hop < 3 && scope && !refresh; hop++) {
      refresh = [...scope.querySelectorAll('button, a, img[onclick], [role=button], i, span[onclick]')]
        .find(el => vis(el) && el !== capEl && el !== submit && el.contains && !el.contains(submit) && refreshKeyword(el)) || null;
      if (!refresh) {
        // در همان کادر، هر عنصر کلیک‌پذیر کوچک غیر از خود تصویر و دکمه ارسال
        refresh = [...scope.querySelectorAll('button, a, img[onclick], [onclick]')]
          .find(el => vis(el) && el !== capEl && el !== submit) || null;
      }
      scope = scope.parentElement;
    }
  }

  mark(pass, 'password');
  mark(user, 'username');
  mark(capIn, 'captcha-input');
  mark(capImg || capCanvas, 'captcha-img');
  mark(submit, 'submit');
  mark(refresh, 'refresh');

  return {
    found: {
      username: !!user, password: !!pass,
      captchaInput: !!capIn, captchaImg: !!(capImg || capCanvas),
      submit: !!submit, refresh: !!refresh,
    },
  };
};

// ── ۴. یک تلاش ورود کامل ─────────────────────────────────────
async function attemptLogin(page, creds, attemptNo) {
  const sel = CFG.selectors || {};
  const pick = (name) => sel[name] || `[data-bot-field="${name}"]`;

  const found = await page.evaluate(DETECT_FN);
  console.log(`   🔎 فیلدها: ${Object.entries(found.found).filter(([, v]) => v).map(([k]) => k).join(', ')}`);
  if (!found.found.username || !found.found.password) {
    throw new Error('فرم ورود (نام کاربری/رمز) پیدا نشد — سلکتورها را در config.json تنظیم کن');
  }

  await page.fill(pick('username'), creds.username);
  await page.fill(pick('password'), creds.password);

  // تصویر کپچا → حل → پر کردن
  let solved = '';
  if (found.found.captchaImg && found.found.captchaInput) {
    const shot = await page.locator(pick('captcha-img')).screenshot();
    // ذخیره برای دیتاست یادگیری (raw) و دیباگ
    fs.mkdirSync(path.join(__dirname, 'dataset', 'raw'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'dataset', 'raw', `cap-${Date.now()}.png`), shot);
    if (CFG.captcha && CFG.captcha.debug) {
      fs.mkdirSync(path.join(__dirname, 'debug'), { recursive: true });
      fs.writeFileSync(path.join(__dirname, 'debug', `captcha-${attemptNo}.png`), shot);
    }
    const t0 = Date.now();
    // ۱) اولویت: حل با مدل هوش مصنوعی (qwen3.8-flash)
    if (CFG.captcha && CFG.captcha.useAI !== false && aiSolver.isConfigured()) {
      try {
        const r = await aiSolver.solveWithAI(shot);
        solved = r.text;
        console.log(`   🤖 کپچا (AI/${r.model}): «${solved}» (${Date.now() - t0}ms)`);
      } catch (e) {
        console.log(`   ⚠️ حل با AI ناموفق: ${e.message} — fallback به OCR محلی`);
      }
    }
    // ۲) fallback: OCR محلی (Tesseract + اجماع)
    if (!solved) {
      const r = await solveImage(shot, CFG.captcha || {});
      solved = r.text;
      console.log(`   🧩 کپچا (OCR): «${solved}» (اطمینان ${r.confidence}%، ${Date.now() - t0}ms)`);
    }
    await page.fill(pick('captcha-input'), solved);
  } else {
    console.log('   ⚠️ کپچا در صفحه پیدا نشد — فقط نام کاربری/رمز پر شد');
  }

  // ارسال فرم (انتظار برای ناوبری، با سقف زمانی)
  await Promise.race([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: CFG.timeoutMs || 30000 }).catch(() => {}),
    (async () => {
      await page.click(pick('submit'));
      await page.waitForTimeout(1200);
    })(),
  ]);
  await page.waitForTimeout(800);

  // تشخیص نتیجه: فرم هنوز هست؟ متن خطا هست؟ پیام alert چه بود؟
  const result = await page.evaluate((errorTexts) => {
    const passEl = document.querySelector('input[type=password]');
    const stillVisible = !!(passEl && passEl.offsetParent !== null);
    const body = (document.body.innerText || '') + ' ' + (document.title || '');
    const hasError = errorTexts.some(t => body.includes(t));
    const alertMsg = window.__botAlert || '';
    return { stillVisible, hasError, alertMsg, url: location.href };
  }, CFG.errorTexts || []);

  const urlOk = (CFG.successUrlIncludes || []).some(p => result.url.includes(p));
  const success = (!result.stillVisible && !result.hasError) || urlOk;
  return { success, ...result, solved };
}

// ── راه‌اندازی مرورگر: کروم/اجِ نصب‌شده ویندوز → Chromium پلی‌رایت
// (CDN پلی‌رایت در ایران مسدود است؛ به همین دلیل مرورگر سیستم استفاده می‌شود)
async function launchBrowser() {
  const headless = !!args.headless;
  const chain = (CFG.browser && CFG.browser.channel)
    ? [CFG.browser.channel]
    : ['chrome', 'msedge', undefined];
  let lastErr;
  for (const channel of chain) {
    try {
      return await chromium.launch({ headless, channel });
    } catch (e) { lastErr = e; }
  }
  throw new Error('هیچ مرورگری در دسترس نیست. Chrome/Edge نصب کن یا یک‌بار با فیلترشکن اجرا کن: npx playwright install chromium — (' + (lastErr && lastErr.message) + ')');
}

// ── ۵. جریان اصلی با تلاش مجدد ───────────────────────────────
async function main() {
  // حالت‌های کمکی: لیست دانشجویان / تست حل یک تصویر
  if (args.list) {
    const list = loadStudents();
    if (!list.length) return console.log('students.json خالی یا موجود نیست. اول export-students.html را در سایت باز کن.');
    console.log(`📚 ${list.length} دانشجو:`);
    list.forEach((s, i) => console.log(
      `  ${i + 1}. ${s.name || '-'} | شماره: ${s.studentId || '-'} | رمز سامانه: ${s.systemPassword ? 'دارد' : 'ندارد'}`
    ));
    return;
  }
  if (args['solve-img']) {
    const r = await solveImage(args['solve-img'], { ...CFG.captcha, debug: true });
    console.log(`🧩 نتیجه: «${r.text}»`);
    console.log(JSON.stringify(r.candidates, null, 2));
    return;
  }

  const url = args.url || CFG.loginUrl;
  if (!url) {
    console.error('❌ آدرس صفحه ورود را بده: --url "https://..." یا در config.json مقدار loginUrl را پر کن.');
    process.exit(1);
  }
  const creds = resolveCredentials();
  const maxAttempts = parseInt(args.attempts || CFG.attempts || 5, 10);
  console.log(`🚀 شروع — ${creds.source}`);
  console.log(`   آدرس: ${url}`);

  const browser = await launchBrowser();
  const context = await browser.newContext({ locale: 'fa-IR', viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // دیالوگ‌های alert/confirm سامانه را ببند و پیام را ذخیره کن
  page.on('dialog', async (d) => {
    await page.evaluate((m) => { window.__botAlert = m; }, d.message()).catch(() => {});
    await d.dismiss().catch(() => {});
  });

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`\n━━━ تلاش ${attempt}/${maxAttempts} ━━━`);
      if (attempt === 1) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CFG.timeoutMs || 30000 });
      }

      let res;
      try {
        res = await attemptLogin(page, creds, attempt);
      } catch (e) {
        console.log(`   ⚠️ ${e.message}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
        continue;
      }

      if (res.alertMsg) console.log(`   💬 پیام سامانه: ${res.alertMsg}`);
      if (res.success) {
        console.log(`\n✅ ورود موفق! آدرس فعلی: ${res.url}`);
        if (args.saveSession) {
          await context.storageState({ path: path.join(__dirname, args.saveSession) });
          console.log(`   💾 نشست ذخیره شد: ${args.saveSession}`);
        }
        if (args.keepOpen) {
          console.log('   👀 مرورگر باز ماند — برای خروج Ctrl+C');
          await new Promise(() => {});
        }
        return;
      }
      console.log(`   ❌ ناموفق (کد واردشده: ${res.solved || '-'})`);

      // رفرش کپچا اگر دکمه‌اش هست، وگرنه رفرش کامل صفحه برای کد جدید
      const refreshSrc = await page.evaluate(() => {
        const r = document.querySelector('[data-bot-field="refresh"]');
        const img = document.querySelector('[data-bot-field="captcha-img"]');
        if (r) { r.click(); return img ? img.src : ''; }
        return null;
      });
      await page.waitForTimeout(1500);
      if (refreshSrc === null) {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(1000);
      }
    }
    console.error(`\n⛔ بعد از ${maxAttempts} تلاش ورود انجام نشد. تصاویر در پوشه debug/ ذخیره شده‌اند.`);
    process.exitCode = 2;
  } finally {
    if (!args.keepOpen) await browser.close().catch(() => {});
  }
}

// اجرای مستقیم از خط فرمان
if (require.main === module) {
  main().catch((e) => { console.error('❌ خطا:', e.message); process.exit(1); });
}



