/* ============================================================
   sw-tadilat.js — Service Worker سبک برای مینی‌اپ تعدیلات
   
   چرا این فایل وجود دارد؟
     بدون Service Worker، اندروید آیکون صفحهٔ خانه را «بوکمارک» می‌سازد
     و ممکن است صفحهٔ دلخواه (نه مینی‌اپ) باز شود. با این فایل، مرورگر
     آن را یک «اپ نصب‌شده» می‌شناسد و همیشه start_url را باز می‌کند.

   ⚠️ عمداً هیچ فایلی کش نمی‌شود.
     استراتژی «فقط شبکه» است تا هرگز نسخهٔ قدیمی گیر نکند.
     اگر روزی خواستید آفلاین کار کند، همین‌جا لایهٔ کش اضافه کنید.
   ============================================================ */

self.addEventListener('install', function (event) {
  // بی‌درنگ فعال شود، بدون انتظار برای بستن تب‌های قدیمی
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    // کش‌های احتمالی نسخه‌های قبلی را پاک کن
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) { /* نادیده */ }
    await self.clients.claim();
  })());
});

// بدون respondWith → مرورگر مستقیم از شبکه می‌گیرد (هیچ کشی)
self.addEventListener('fetch', function () { /* network only */ });
