# 📦 راهنمای نصب وابستگی‌های آفلاین

## فایل‌های مورد نیاز

برای استفاده آفلاین، این فایل‌ها را دانلود و در پوشه‌های مشخص شده قرار دهید:

### 1. Alpine.js
```
URL: https://unpkg.com/alpinejs@3.13.3/dist/cdn.min.js
مسیر: assets/libs/alpine.min.js
```

### 2. Font Awesome CSS
```
URL: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css
مسیر: assets/libs/fontawesome/css/all.min.css
```

### 3. Font Awesome Webfonts
```
دانلود از: https://use.fontawesome.com/releases/v6.0.0/fontawesome-free-6.0.0-web.zip
استخراج پوشه webfonts به: assets/libs/fontawesome/webfonts/
```

### 4. Vazirmatn Font
```
دانلود از: https://github.com/rastikerdar/vazirmatn/releases
استخراج فایل‌های woff2 به: assets/fonts/vazirmatn/
```

### 5. Tailwind CSS (موجود است ✅)
```
مسیر: assets/libs/tailwindcss.js
```

## دستورات دانلود سریع

### Windows PowerShell:
```powershell
# ایجاد پوشه‌ها
New-Item -ItemType Directory -Force -Path "assets/libs/fontawesome/css"
New-Item -ItemType Directory -Force -Path "assets/libs/fontawesome/webfonts"
New-Item -ItemType Directory -Force -Path "assets/fonts/vazirmatn"

# دانلود Alpine.js
Invoke-WebRequest -Uri "https://unpkg.com/alpinejs@3.13.3/dist/cdn.min.js" -OutFile "assets/libs/alpine.min.js"

# دانلود Font Awesome CSS
Invoke-WebRequest -Uri "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" -OutFile "assets/libs/fontawesome/css/all.min.css"
```

### Linux/Mac:
```bash
# ایجاد پوشه‌ها
mkdir -p assets/libs/fontawesome/css
mkdir -p assets/libs/fontawesome/webfonts
mkdir -p assets/fonts/vazirmatn

# دانلود Alpine.js
curl -o assets/libs/alpine.min.js https://unpkg.com/alpinejs@3.13.3/dist/cdn.min.js

# دانلود Font Awesome CSS
curl -o assets/libs/fontawesome/css/all.min.css https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css
```

## بروزرسانی index.html

بعد از دانلود فایل‌ها، خطوط زیر در `index.html` را تغییر دهید:

### قبل:
```html
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### بعد:
```html
<script src="assets/libs/tailwindcss.js"></script>
<script src="assets/libs/alpine.min.js" defer></script>
<link href="assets/libs/fontawesome/css/all.min.css" rel="stylesheet">
<link href="assets/fonts/vazirmatn/vazirmatn.css" rel="stylesheet">
```

## ساختار نهایی پوشه‌ها

```
assets/
├── css/
│   └── styles.css
├── fonts/
│   └── vazirmatn/
│       ├── vazirmatn.css
│       ├── Vazirmatn-Regular.woff2
│       ├── Vazirmatn-Medium.woff2
│       ├── Vazirmatn-SemiBold.woff2
│       └── Vazirmatn-Bold.woff2
├── libs/
│   ├── tailwindcss.js ✅
│   ├── alpine.min.js
│   └── fontawesome/
│       ├── css/
│       │   └── all.min.css
│       └── webfonts/
│           ├── fa-solid-900.woff2
│           ├── fa-regular-400.woff2
│           └── fa-brands-400.woff2
└── icons/
```

## تست آفلاین

1. اتصال اینترنت را قطع کنید
2. فایل `index.html` را باز کنید
3. بررسی کنید:
   - ✅ Tailwind CSS کار می‌کند
   - ✅ Alpine.js کار می‌کند
   - ✅ آیکون‌های Font Awesome نمایش داده می‌شوند
   - ✅ فونت فارسی صحیح است

## نکات مهم

- Font Awesome نیاز به فایل‌های webfonts دارد
- مسیرهای فونت در CSS باید صحیح باشند
- Tailwind CSS از نسخه standalone استفاده می‌کند
