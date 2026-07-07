# ✅ کارهای باقی‌مانده قبل از دیپلوی

**وضعیت:** 95% آماده - فقط 5 کار باقی مانده!

---

## 🎯 کارهای ضروری (باید انجام شود)

### ✅ کار 1: تولید SECRET_KEY جدید (2 دقیقه)

```bash
# اجرا کنید:
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

خروجی یک رشته مثل این می‌دهد:
```
django-insecure-a8f#2k$9m@x7!p3q&w5e*r1t^y6u(i0o)p-l+k=j~h`g
```

**این رشته را کپی کنید** و در فایل زیر جایگزین کنید:

**فایل:** `backend/config/settings_production.py`  
**خط:** 10 تقریباً

```python
# قبل:
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'CHANGE-THIS-IN-PRODUCTION-' + 'vs%gctxh3p6uh_2qd9jcyg8--fs$)ah-i+yvpy$@-$+ned@_)2')

# بعد:
SECRET_KEY = 'PASTE_YOUR_NEW_SECRET_KEY_HERE'
```

---

### ✅ کار 2: تنظیم IP سرور (3 دقیقه)

**شما باید IP سرور خود را داشته باشید. مثال: `185.123.45.67`**

#### 2.1 فایل اول: `backend/config/settings_production.py`

**خط 16 تقریباً:**
```python
# قبل:
ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    # Add your server IP here
]

# بعد:
ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '185.123.45.67',  # IP سرور شما
    # 'your-domain.com',  # اگر دامنه دارید
]
```

**خط 60 تقریباً:**
```python
# قبل:
CORS_ALLOWED_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
]

# بعد:
CORS_ALLOWED_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
    "http://185.123.45.67",  # IP سرور شما
]
```

#### 2.2 فایل دوم: `js/api-orders.js`

**خط 3 تقریباً:**
```javascript
// قبل:
const APIOrdersModule = {
    baseURL: 'http://127.0.0.1:8000/api',

// بعد:
const APIOrdersModule = {
    baseURL: 'http://185.123.45.67/api',  // IP سرور شما (بدون پورت 8000)
```

#### 2.3 فایل سوم: `login.html`

**خط 234 تقریباً:**
```javascript
// قبل:
const response = await fetch('http://127.0.0.1:8000/api/auth/login/', {

// بعد:
const response = await fetch('http://185.123.45.67/api/auth/login/', {  // IP سرور شما
```

---

### ✅ کار 3: تنظیم اپلیکیشن Flutter (2 دقیقه)

#### 3.1 فایل اول: `flutter_app/lib/webview_screen.dart`

**خط 18 تقریباً:**
```dart
// قبل:
static const String webAppUrl = 'http://127.0.0.1:5500';

// بعد:
static const String webAppUrl = 'http://185.123.45.67';  // IP سرور شما
```

#### 3.2 فایل دوم: `flutter_app/android/app/build.gradle.kts`

**خط 20 تقریباً:**
```kotlin
// قبل:
applicationId = "com.example.edu_system_app"

// بعد:
applicationId = "com.alkawsar.edu_system"  // یا هر نام منحصر به فرد دیگر
```

---

### ✅ کار 4: ایجاد پوشه‌های مورد نیاز (1 دقیقه)

```bash
# در پوشه backend
cd backend
mkdir logs
mkdir media
```

یا در Windows:
```cmd
cd backend
mkdir logs
mkdir media
```

---

### ✅ کار 5: جمع‌آوری Static Files (2 دقیقه)

```bash
cd backend

# فعال کردن virtual environment
venv\Scripts\activate  # Windows
# یا
source venv/bin/activate  # Linux/Mac

# جمع‌آوری static files
python manage.py collectstatic --noinput
```

---

## 🎯 کارهای اختیاری (توصیه می‌شود)

### ⭐ کار 6: تغییر رمزهای پیش‌فرض (اختیاری)

اگر می‌خواهید رمزهای کاربران پیش‌فرض را تغییر دهید:

**فایل:** `backend/create_default_users.py`

```python
# خط 10-30 تقریباً
users_data = [
    {
        'username': 'taghizadeh',
        'password': 'NEW_PASSWORD_HERE',  # تغییر دهید
        # ...
    },
    # ...
]
```

سپس دوباره اجرا کنید:
```bash
python create_default_users.py
```

### ⭐ کار 7: نصب SSL (اختیاری - برای HTTPS)

بعد از دیپلوی، اگر دامنه دارید:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 📋 چک‌لیست نهایی

قبل از دیپلوی، این موارد را بررسی کنید:

### بک‌اند
- [ ] SECRET_KEY جدید تولید شد
- [ ] ALLOWED_HOSTS شامل IP سرور است
- [ ] CORS_ALLOWED_ORIGINS شامل IP سرور است
- [ ] پوشه logs ایجاد شد
- [ ] پوشه media ایجاد شد
- [ ] Static files جمع‌آوری شد

### فرانت‌اند
- [ ] baseURL در js/api-orders.js تغییر کرد
- [ ] URL در login.html تغییر کرد

### اپلیکیشن Flutter
- [ ] webAppUrl در webview_screen.dart تغییر کرد
- [ ] applicationId منحصر به فرد شد

---

## 🚀 مراحل بعد از انجام کارها

### 1. تست محلی (قبل از دیپلوی)

```bash
# ترمینال 1: راه‌اندازی Django
cd backend
venv\Scripts\activate
python manage.py runserver 0.0.0.0:8000

# ترمینال 2: راه‌اندازی فرانت‌اند
python -m http.server 8080

# مرورگر: http://localhost:8080/login.html
# ورود با: taghizadeh / taghizadeh
```

### 2. ساخت APK Flutter

```bash
cd flutter_app
flutter pub get
flutter build apk --release

# فایل APK در:
# flutter_app/build/app/outputs/flutter-apk/app-release.apk
```

### 3. دیپلوی روی سرور

مراحل کامل در فایل `DEPLOYMENT_NEXT_STEPS_FA.md` موجود است.

---

## 📞 اگر مشکلی پیش آمد

### مشکل: SECRET_KEY تولید نمی‌شود

```bash
# روش جایگزین:
python
>>> from django.core.management.utils import get_random_secret_key
>>> print(get_random_secret_key())
>>> exit()
```

### مشکل: Static files جمع‌آوری نمی‌شود

```bash
# مطمئن شوید virtual environment فعال است
venv\Scripts\activate

# مطمئن شوید در پوشه backend هستید
cd backend

# دوباره تلاش کنید
python manage.py collectstatic --noinput
```

### مشکل: Flutter build خطا می‌دهد

```bash
# پاک کردن cache
flutter clean

# دریافت مجدد dependencies
flutter pub get

# تلاش مجدد
flutter build apk --release
```

---

## 📊 زمان‌بندی پیشنهادی

| کار | زمان | اولویت |
|-----|------|--------|
| تولید SECRET_KEY | 2 دقیقه | ضروری |
| تنظیم IP سرور | 3 دقیقه | ضروری |
| تنظیم Flutter | 2 دقیقه | ضروری |
| ایجاد پوشه‌ها | 1 دقیقه | ضروری |
| جمع‌آوری Static | 2 دقیقه | ضروری |
| **جمع کل** | **10 دقیقه** | - |

---

## ✅ بعد از انجام همه کارها

سیستم شما **100% آماده** برای دیپلوی خواهد بود!

مراحل بعدی:
1. تست محلی
2. آپلود به سرور
3. نصب و راه‌اندازی
4. تست نهایی

**موفق باشید! 🎉**

---

**تاریخ:** 2026-02-28  
**نسخه:** 1.0.0
