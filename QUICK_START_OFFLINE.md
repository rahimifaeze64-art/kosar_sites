# 🚀 راهنمای سریع استفاده آفلاین

## گام 1: دانلود وابستگی‌ها

### روش خودکار (توصیه می‌شود):
```
دابل کلیک روی: download-offline-assets.bat
```

### روش دستی:
مراجعه به فایل `OFFLINE_SETUP.md`

## گام 2: بررسی فایل‌ها

پس از دانلود، این فایل‌ها باید موجود باشند:

```
✅ assets/libs/tailwindcss.js (از قبل موجود)
✅ assets/libs/alpine.min.js
✅ assets/libs/fontawesome/css/all.min.css
✅ assets/libs/fontawesome/webfonts/fa-solid-900.woff2
✅ assets/libs/fontawesome/webfonts/fa-regular-400.woff2
✅ assets/libs/fontawesome/webfonts/fa-brands-400.woff2
✅ assets/fonts/vazirmatn/vazirmatn.css (ایجاد شده)
⚠️  assets/fonts/vazirmatn/*.woff2 (نیاز به دانلود دستی)
```

## گام 3: دانلود فونت وزیرمتن

1. به این لینک بروید:
   https://github.com/rastikerdar/vazirmatn/releases/latest

2. فایل `Vazirmatn-font-vXX.XXX.zip` را دانلود کنید

3. فایل را استخراج کنید

4. فایل‌های `.woff2` را از پوشه `webfonts` کپی کنید به:
   `assets/fonts/vazirmatn/`

## گام 4: تست

1. اتصال اینترنت را قطع کنید
2. فایل `index.html` را باز کنید
3. بررسی کنید:
   - ✅ صفحه به درستی بارگذاری می‌شود
   - ✅ استایل‌ها اعمال شده‌اند
   - ✅ آیکون‌ها نمایش داده می‌شوند
   - ✅ فونت فارسی صحیح است

## وضعیت فعلی

✅ **index.html بروزرسانی شده است**
- تمام لینک‌های CDN به فایل‌های لوکال تغییر کرده‌اند
- سیستم آماده استفاده آفلاین است

## در صورت مشکل

### مشکل: آیکون‌ها نمایش داده نمی‌شوند
**حل**: 
- بررسی کنید فایل‌های webfonts دانلود شده‌اند
- مسیر در `all.min.css` را بررسی کنید

### مشکل: فونت فارسی کار نمی‌کند
**حل**:
- فایل‌های `.woff2` را در `assets/fonts/vazirmatn/` قرار دهید
- فایل `vazirmatn.css` را بررسی کنید

### مشکل: Tailwind کار نمی‌کند
**حل**:
- فایل `assets/libs/tailwindcss.js` موجود است؟
- کنسول مرورگر را بررسی کنید

## نکات مهم

- ⚠️ فونت وزیرمتن باید به صورت دستی دانلود شود (حجم زیاد)
- ✅ بقیه فایل‌ها با اسکریپت دانلود می‌شوند
- ✅ پس از دانلود، نیازی به اینترنت نیست

## حجم فایل‌ها

```
Alpine.js:        ~15 KB
Font Awesome CSS: ~70 KB
FA Webfonts:      ~500 KB
Vazirmatn Fonts:  ~2 MB
Tailwind:         ~300 KB (موجود)
---
جمع:              ~3 MB
```

## پشتیبانی

در صورت بروز مشکل:
1. کنسول مرورگر را بررسی کنید (F12)
2. Network tab را چک کنید
3. مسیرهای فایل‌ها را تایید کنید
