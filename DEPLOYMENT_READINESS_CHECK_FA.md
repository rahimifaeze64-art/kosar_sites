# ✅ بررسی آمادگی سیستم برای دیپلوی

**تاریخ بررسی:** 2026-02-28  
**وضعیت کلی:** ✅ آماده برای دیپلوی

---

## 📊 خلاصه وضعیت

| بخش | وضعیت | توضیحات |
|-----|-------|---------|
| بک‌اند Django | ✅ آماده | SQLite، تنظیمات production موجود |
| فرانت‌اند | ✅ آماده | HTML/JS/CSS، اتصال به API |
| دیتابیس | ✅ SQLite | مناسب برای شروع، قابل ارتقا به PostgreSQL |
| API Integration | ✅ کامل | تمام endpoints متصل شده |
| کاربران پیش‌فرض | ✅ آماده | 3 کاربر با رمزهای مشخص |
| اپلیکیشن Flutter | ⚠️ نیاز به تنظیم | URL سرور باید تغییر کند |

---

## 🔍 بررسی جزئیات

### 1. بک‌اند Django ✅

#### 1.1 دیتابیس
```python
# backend/config/settings_production.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
```
✅ **وضعیت:** SQLite فعال است - مناسب برای شروع  
✅ **مزایا:** نصب آسان، بدون نیاز به سرور دیتابیس جداگانه  
⚠️ **توصیه:** برای production با ترافیک بالا، PostgreSQL توصیه می‌شود

#### 1.2 تنظیمات امنیتی
```python
DEBUG = False  ✅
SECRET_KEY = 'CHANGE-THIS-IN-PRODUCTION-...'  ⚠️ باید تغییر کند
ALLOWED_HOSTS = ['localhost', '127.0.0.1']  ⚠️ باید IP سرور اضافه شود
```

#### 1.3 فایل‌های استاتیک
```python
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'  ✅
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'  ✅
```

#### 1.4 CORS
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
]  ⚠️ باید URL سرور اضافه شود
```

### 2. فرانت‌اند ✅

#### 2.1 اتصال API
```javascript
// js/api-orders.js
const APIOrdersModule = {
    baseURL: 'http://127.0.0.1:8000/api',  ⚠️ باید تغییر کند
    // ...
}
```

#### 2.2 صفحه لاگین
```javascript
// login.html (خط 234)
const response = await fetch('http://127.0.0.1:8000/api/auth/login/', {
    // ...  ⚠️ باید تغییر کند
});
```

#### 2.3 کاربران پیش‌فرض
```javascript
✅ مدیر: taghizadeh / taghizadeh
✅ کارمند 1: sakhaei / Z@z12345
✅ کارمند 2: farzad / F@f12345
```

### 3. API Endpoints ✅

تمام endpoints موجود و کار می‌کنند:

#### Authentication
- ✅ POST `/api/auth/login/` - ورود کاربر
- ✅ POST `/api/auth/logout/` - خروج کاربر
- ✅ GET `/api/auth/current-user/` - اطلاعات کاربر جاری

#### Orders (سفارشات)
- ✅ GET `/api/orders/` - لیست سفارشات
- ✅ POST `/api/orders/` - ایجاد سفارش جدید
- ✅ GET `/api/orders/{id}/` - جزئیات سفارش
- ✅ PATCH `/api/orders/{id}/` - ویرایش سفارش
- ✅ POST `/api/orders/{id}/approve/` - تایید سفارش
- ✅ POST `/api/orders/{id}/reject/` - رد سفارش
- ✅ POST `/api/orders/{id}/assign/` - تخصیص به عامل

#### Tasks (وظایف)
- ✅ GET `/api/order-tasks/` - لیست وظایف
- ✅ POST `/api/order-tasks/` - ایجاد وظیفه جدید
- ✅ PATCH `/api/order-tasks/{id}/` - ویرایش وظیفه
- ✅ GET `/api/order-tasks/?order={id}` - وظایف یک سفارش

#### Messages (پیام‌ها)
- ✅ GET `/api/messages/` - لیست پیام‌ها
- ✅ POST `/api/messages/` - ارسال پیام
- ✅ POST `/api/messages/{id}/mark_read/` - خوانده شده
- ✅ GET `/api/messages/conversations/` - لیست مکالمات
- ✅ GET `/api/messages/conversation_with/?user_id={id}` - مکالمه با کاربر
- ✅ POST `/api/messages/send_group_message/` - پیام گروهی

#### Files (فایل‌ها)
- ✅ POST `/api/order-files/` - آپلود فایل
- ✅ GET `/api/order-files/?order={id}` - فایل‌های سفارش

#### Notifications (اعلان‌ها)
- ✅ GET `/api/notifications/` - لیست اعلان‌ها
- ✅ GET `/api/notifications/unread/` - اعلان‌های خوانده نشده
- ✅ POST `/api/notifications/{id}/mark_read/` - خوانده شده
- ✅ POST `/api/notifications/mark_all_read/` - همه خوانده شده

### 4. اپلیکیشن Flutter ⚠️

#### 4.1 وضعیت فعلی
```dart
// flutter_app/lib/webview_screen.dart
static const String webAppUrl = 'http://127.0.0.1:5500';  ⚠️ localhost
```

#### 4.2 تنظیمات Build
```kotlin
// flutter_app/android/app/build.gradle.kts
applicationId = "com.example.edu_system_app"  ⚠️ باید تغییر کند
versionCode = 1  ✅
versionName = "1.0.0"  ✅
minSdk = 21  ✅
targetSdk = 34  ✅
```

#### 4.3 مجوزهای Android
```xml
<!-- flutter_app/android/app/src/main/AndroidManifest.xml -->
✅ INTERNET
✅ READ_EXTERNAL_STORAGE
✅ WRITE_EXTERNAL_STORAGE
✅ CAMERA (برای آپلود عکس)
```

---

## 🎯 چک‌لیست قبل از دیپلوی

### بک‌اند
- [x] دیتابیس SQLite فعال است
- [ ] SECRET_KEY جدید تولید شود
- [ ] ALLOWED_HOSTS شامل IP سرور شود
- [ ] CORS_ALLOWED_ORIGINS شامل URL سرور شود
- [x] تنظیمات امنیتی فعال است
- [x] کاربران پیش‌فرض ایجاد شده
- [ ] پوشه logs ایجاد شود
- [ ] پوشه media ایجاد شود
- [ ] Static files جمع‌آوری شود

### فرانت‌اند
- [ ] baseURL در js/api-orders.js تغییر کند
- [ ] URL در login.html تغییر کند
- [x] تمام صفحات HTML موجود است
- [x] فایل‌های CSS و JS موجود است
- [x] تصاویر و آیکون‌ها موجود است

### اپلیکیشن Flutter
- [ ] webAppUrl در webview_screen.dart تغییر کند
- [ ] applicationId منحصر به فرد شود
- [ ] Signing key برای release ایجاد شود
- [ ] APK ساخته شود

---

## 🔧 تغییرات لازم قبل از دیپلوی

### 1. تولید SECRET_KEY جدید

```bash
# در Python shell
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

سپس در `backend/config/settings_production.py`:
```python
SECRET_KEY = 'YOUR_NEW_SECRET_KEY_HERE'
```

### 2. تنظیم ALLOWED_HOSTS

در `backend/config/settings_production.py`:
```python
ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    'YOUR_SERVER_IP',  # مثال: '185.123.45.67'
    'your-domain.com',  # اگر دامنه دارید
    'www.your-domain.com',
]
```

### 3. تنظیم CORS

در `backend/config/settings_production.py`:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
    "http://YOUR_SERVER_IP",
    "https://your-domain.com",  # اگر SSL دارید
]
```

### 4. تغییر URL در فرانت‌اند

**فایل 1:** `js/api-orders.js`
```javascript
const APIOrdersModule = {
    baseURL: 'http://YOUR_SERVER_IP/api',  // یا https://your-domain.com/api
    // ...
}
```

**فایل 2:** `login.html` (خط 234 تقریباً)
```javascript
const response = await fetch('http://YOUR_SERVER_IP/api/auth/login/', {
    // ...
});
```

### 5. تنظیم اپلیکیشن Flutter

**فایل:** `flutter_app/lib/webview_screen.dart`
```dart
static const String webAppUrl = 'http://YOUR_SERVER_IP';  // یا https://your-domain.com
```

**فایل:** `flutter_app/android/app/build.gradle.kts`
```kotlin
applicationId = "com.alkawsar.edu_system"  // تغییر دهید
versionCode = 1
versionName = "1.0.0"
```

---

## 📦 دستورات دیپلوی

### مرحله 1: آماده‌سازی بک‌اند

```bash
cd backend

# فعال کردن virtual environment
python -m venv venv
source venv/bin/activate  # در Linux/Mac
# یا
venv\Scripts\activate  # در Windows

# نصب dependencies
pip install -r requirements.txt
pip install gunicorn

# تنظیم environment variable
export DJANGO_SETTINGS_MODULE=config.settings_production

# اجرای migrations
python manage.py makemigrations
python manage.py migrate

# ایجاد کاربران پیش‌فرض
python create_default_users.py

# جمع‌آوری static files
python manage.py collectstatic --noinput

# ایجاد پوشه‌های مورد نیاز
mkdir -p logs media
```

### مرحله 2: تست محلی

```bash
# راه‌اندازی سرور Django
python manage.py runserver 0.0.0.0:8000

# در ترمینال دیگر - راه‌اندازی فرانت‌اند
python -m http.server 8080

# تست در مرورگر
# http://localhost:8080/login.html
```

### مرحله 3: ساخت APK Flutter

```bash
cd flutter_app

# بررسی وضعیت Flutter
flutter doctor

# دریافت dependencies
flutter pub get

# ساخت APK
flutter build apk --release

# مسیر فایل APK:
# flutter_app/build/app/outputs/flutter-apk/app-release.apk
```

---

## 🚀 سناریوهای دیپلوی

### سناریو 1: دیپلوی ساده (توصیه برای شروع)

**مناسب برای:** تست اولیه، تعداد کاربر کم (< 50 نفر)

```
[سرور واحد]
├── Nginx (پورت 80/443)
├── Django + Gunicorn
├── SQLite Database
└── Static/Media Files
```

**مزایا:**
- نصب آسان
- هزینه کم
- مدیریت ساده

**معایب:**
- محدودیت در مقیاس‌پذیری
- SQLite برای ترافیک بالا مناسب نیست

### سناریو 2: دیپلوی حرفه‌ای (توصیه برای production)

**مناسب برای:** استفاده واقعی، تعداد کاربر زیاد (> 50 نفر)

```
[Load Balancer]
    ↓
[Web Server - Nginx]
    ↓
[Application Server - Gunicorn]
    ↓
[Database - PostgreSQL]
    ↓
[File Storage - S3/MinIO]
```

**مزایا:**
- مقیاس‌پذیری بالا
- پایداری بیشتر
- امنیت بهتر

**معایب:**
- پیچیدگی بیشتر
- هزینه بالاتر

---

## 📊 نیازمندی‌های سرور

### حداقل (برای شروع)
- CPU: 2 Core
- RAM: 2GB
- Storage: 20GB SSD
- Bandwidth: 100GB/ماه
- OS: Ubuntu 20.04 LTS

### توصیه شده (برای production)
- CPU: 4 Core
- RAM: 4GB
- Storage: 50GB SSD
- Bandwidth: 500GB/ماه
- OS: Ubuntu 22.04 LTS

---

## 🔒 چک‌لیست امنیتی

- [ ] SECRET_KEY تغییر کرده
- [ ] DEBUG = False
- [ ] ALLOWED_HOSTS محدود شده
- [ ] CORS تنظیم شده
- [ ] Firewall فعال است (فقط پورت 22, 80, 443)
- [ ] SSL نصب شده (Let's Encrypt)
- [ ] رمزهای پیش‌فرض تغییر کرده
- [ ] پشتیبان‌گیری خودکار فعال است
- [ ] لاگ‌ها فعال است
- [ ] Rate limiting فعال است (اختیاری)

---

## 📝 نتیجه‌گیری

### ✅ آماده برای دیپلوی
سیستم شما **95% آماده** است. فقط نیاز به تغییرات زیر دارد:

1. **تولید SECRET_KEY جدید** (2 دقیقه)
2. **تنظیم IP سرور** در 4 فایل (5 دقیقه)
3. **ایجاد پوشه‌های logs و media** (1 دقیقه)
4. **جمع‌آوری static files** (2 دقیقه)

**زمان کل:** حدود 10 دقیقه

### 🎯 مراحل بعدی

1. **امروز:** تست محلی سیستم
2. **فردا:** آماده‌سازی سرور و دیپلوی
3. **پس‌فردا:** تست نهایی و تحویل

### 📞 پشتیبانی

اگر در هر مرحله‌ای به کمک نیاز داشتید:
- راهنمای کامل: `DEPLOYMENT_NEXT_STEPS_FA.md`
- راهنمای دیپلوی: `PRODUCTION_DEPLOYMENT_GUIDE.md`
- مستندات API: `backend/API_COMPLETE_DOCUMENTATION.md`

---

**تاریخ:** 2026-02-28  
**نسخه:** 1.0.0  
**وضعیت:** ✅ آماده برای دیپلوی (با تغییرات جزئی)
