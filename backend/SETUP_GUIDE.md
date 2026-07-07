# راهنمای نصب و راه‌اندازی بک‌اند Django

## مرحله 1: نصب Python و pip

اطمینان حاصل کنید که Python 3.8 یا بالاتر نصب شده است:
```bash
python --version
```

## مرحله 2: ایجاد محیط مجازی (اختیاری اما توصیه می‌شود)

```bash
# ایجاد محیط مجازی
python -m venv venv

# فعال‌سازی محیط مجازی
# در Windows:
venv\Scripts\activate
# در Linux/Mac:
source venv/bin/activate
```

## مرحله 3: نصب وابستگی‌ها

```bash
cd backend
pip install -r requirements.txt
```

## مرحله 4: ایجاد دیتابیس

```bash
# ایجاد فایل‌های migration
python manage.py makemigrations accounts
python manage.py makemigrations students
python manage.py makemigrations orders
python manage.py makemigrations files
python manage.py makemigrations dashboard
python manage.py makemigrations accounting

# اعمال migrations
python manage.py migrate
```

## مرحله 5: ایجاد داده‌های اولیه

```bash
# اجرای اسکریپت ایجاد داده‌های اولیه
python manage.py shell < create_initial_data.py
```

این اسکریپت موارد زیر را ایجاد می‌کند:
- 1 مدیر (manager)
- 4 کارمند (employees)
- 4 عامل (agents)
- 2 دانشجو (students)
- 3 سفارش نمونه

## مرحله 6: اجرای سرور

```bash
python manage.py runserver
```

سرور روی `http://127.0.0.1:8000/` اجرا می‌شود.

## مرحله 7: دسترسی به پنل ادمین

1. مرورگر را باز کنید و به آدرس زیر بروید:
   ```
   http://127.0.0.1:8000/admin/
   ```

2. با اطلاعات زیر وارد شوید:
   - نام کاربری: `manager`
   - رمز عبور: `123456`

## مرحله 8: تست API

### دریافت لیست کاربران
```bash
curl http://127.0.0.1:8000/api/users/
```

### ورود به سیستم
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "manager", "password": "123456"}'
```

### دریافت آمار داشبورد
```bash
curl http://127.0.0.1:8000/api/dashboard/stats/ \
  -H "Authorization: Token YOUR_TOKEN_HERE"
```

## کاربران پیش‌فرض

### مدیر
- نام کاربری: `manager`
- رمز عبور: `123456`
- نقش: Manager

### هماهنگ‌کنندگان
- نام کاربری: `zahra`, `fatemeh`, `farzad`, `soleiman`
- رمز عبور: `123456`
- نقش: employee

### عامل‌ها
- نام کاربری: `masoumi`, `zoghi`, `rezaei`, `karimi`
- رمز عبور: `123456`
- نقش: Agent

### دانشجویان
- نام کاربری: `qasim`, `hassan`
- رمز عبور: `123456`
- نقش: Student

## مشکلات رایج و راه‌حل‌ها

### خطای "No module named 'rest_framework'"
```bash
pip install djangorestframework
```

### خطای "No module named 'corsheaders'"
```bash
pip install django-cors-headers
```

### خطای Migration
```bash
# حذف فایل‌های migration قبلی
find . -path "*/migrations/*.py" -not -name "__init__.py" -delete
find . -path "*/migrations/*.pyc" -delete

# ایجاد مجدد migrations
python manage.py makemigrations
python manage.py migrate
```

### خطای "Port already in use"
```bash
# استفاده از پورت دیگر
python manage.py runserver 8001
```

## ساختار دیتابیس

### جداول اصلی:
1. **accounts_customuser** - کاربران
2. **students_studentprofile** - پروفایل دانشجویان
3. **orders_order** - سفارشات
4. **orders_ordertask** - وظایف سفارشات
5. **orders_orderrejection** - تاریخچه رد سفارشات
6. **files_orderfile** - فایل‌های سفارشات
7. **files_profiledocument** - اسناد پروفایل
8. **dashboard_message** - پیام‌ها
9. **dashboard_notification** - اعلان‌ها
10. **dashboard_activitylog** - لاگ فعالیت‌ها
11. **accounting_transaction** - تراکنش‌های مالی
12. **accounting_invoice** - فاکتورها
13. **accounting_paymentschedule** - برنامه پرداخت

## توسعه بیشتر

### اضافه کردن فیلد جدید به مدل
1. فیلد را به `models.py` اضافه کنید
2. Migration ایجاد کنید: `python manage.py makemigrations`
3. Migration را اعمال کنید: `python manage.py migrate`

### اضافه کردن API endpoint جدید
1. Serializer را در `api/serializers.py` تعریف کنید
2. View را در `api/views.py` ایجاد کنید
3. URL را در `api/urls.py` اضافه کنید

## پشتیبانی

برای سوالات و مشکلات، به مستندات Django مراجعه کنید:
- https://docs.djangoproject.com/
- https://www.django-rest-framework.org/

## نکات امنیتی برای Production

1. `DEBUG = False` در settings.py
2. تغییر `SECRET_KEY`
3. استفاده از دیتابیس PostgreSQL به جای SQLite
4. تنظیم `ALLOWED_HOSTS`
5. استفاده از HTTPS
6. فعال‌سازی CSRF protection
7. استفاده از environment variables برای تنظیمات حساس
