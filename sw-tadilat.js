/* ============================================================
   sw-tadilat.js — Service Worker تلگرام «تعدیلات»
   
   چرا؟
     لود اول تلگرام روی موبایل گاهی تا ~۱ دقیقه طول می‌کشد، چون
     درخواست‌ها به CDN می‌روند و اگر کش CDN سرد باشد، واکشی از مبدأ
     (GitHub Pages) روی شبکهٔ موبایل کند/معلق می‌شود.
     این فایل، دارایی‌های تلگرام را روی خود گوشی کش می‌کند تا
     از دیدار دوم به بعد، اپ فوری بالا بیاید — حتی اگر شبکه کند باشد.

   ⚠️ دامنهٔ اثر محدود است:
     فقط مسیرهای تلگرام کش می‌شوند. بقیهٔ سایت (داشبورد و …) دست‌نخورده
     و مستقیم از شبکه می‌آید.
   ============================================================ */

var CACHE = 'tadilat-shell-v1';

/* دارایی‌های ثابت تلگرام — الگوی مسیر */
var APP_PATHS = [
  '/tadilat-app.html',
  '/manifest-tadilat.json',
  '/css/tadilat-app.css',
  '/js/tadilat-app.js',
  '/js/supabase-config.js',
  '/assets/fonts/',
  '/assets/libs/fontawesome/',
  '/assets/icons/'
];

/* این‌ها هنگام نصب پیش‌کش می‌شوند (مسیرهای ثابت بدون نسخه) */
var PRECACHE = [
  './tadilat-app.html',
  './manifest-tadilat.json',
  './assets/icons/tadilat-192.png',
  './assets/icons/tadilat-180.png',
  './assets/fonts/vazirmatn/vazirmatn.css',
  './assets/libs/fontawesome/css/all.min.css'
];

function isAppAsset(url) {
  if (url.origin !== self.location.origin) return false;
  var p = url.pathname;
  for (var i = 0; i < APP_PATHS.length; i++) {
    if (p.indexOf(APP_PATHS[i]) !== -1) return true;
  }
  return false;
}

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    try {
      var c = await caches.open(CACHE);
      // هر کدام جدا؛ اگر یکی نشد بقیه ادامه دهند
      await Promise.all(PRECACHE.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () { /* بی‌اهمیت */ });
      }));
    } catch (e) { /* نادیده */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    } catch (e) { /* نادیده */ }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }

  // ── ناوبری (خودِ صفحه) → شبکه با مهلت کوتاه، در غیر این صورت کش ──
  if (req.mode === 'navigate') {
    event.respondWith((async function () {
      var cache = await caches.open(CACHE);
      try {
        var fresh = await Promise.race([
          fetch(req),
          new Promise(function (_, rej) {
            setTimeout(function () { rej(new Error('timeout')); }, 3500);
          })
        ]);
        if (fresh && fresh.ok) {
          cache.put(req, fresh.clone()).catch(function () {});
          return fresh;
        }
        throw new Error('bad');
      } catch (e) {
        var hit = await cache.match(req) || await cache.match('./tadilat-app.html');
        if (hit) return hit;
        return fetch(req).catch(function () {
          return new Response('<h1>اتصال برقرار نشد</h1>', {
            status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        });
      }
    })());
    return;
  }

  // ── دارایی‌های تلگرام → اول کش، بعد شبکه (و کش را تازه کن) ──
  if (isAppAsset(url)) {
    event.respondWith((async function () {
      var cache = await caches.open(CACHE);
      var hit = await cache.match(req);
      if (hit) {
        // در پس‌زمینه تازه‌سازی کن (نسخهٔ بعدی)
        fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone()).catch(function () {});
        }).catch(function () {});
        return hit;
      }
      try {
        var res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone()).catch(function () {});
        return res;
      } catch (e) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // ── بقیه (Supabase، تلگرام، سایت اصلی) → مستقیم از شبکه ──
});
