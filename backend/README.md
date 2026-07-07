# سیستم مدیریت تحصیلی - بک‌اند Django

این بک‌اند Django برای مدیریت کامل سیستم تحصیلی دانشجویان بین‌المللی طراحی شده است.

## ویژگی‌ها

### مدل‌های پایگاه داده

#### 1. **Accounts (کاربران)**
- CustomUser: مدیریت کاربران با نقش‌های مختلف (مدیر، کارمند، عامل، دانشجو)
- فیلدها: نام، نام کاربری، رمز عبور، نقش، تلفن، تخصص، بخش

#### 2. **Students (دانشجویان)**
- StudentProfile: پروفایل کامل دانشجو با 18 فیلد
- فیلدها شامل: دانشگاه، شماره دانشجویی، رشته، مقطع، علاقه، سفارش، وضعیت لجنه، ایران‌داک، استاد، نویسنده، تحویل، امورداری، تنضید، تلخیص، همتند، مقاله 1، مقاله 2

#### 3. **Orders (سفارشات)**
- Order: مدیریت سفارشات (رساله، مقاله، ترجمه، تلخیص)
- OrderTask: وظایف مربوط به هر سفارش
- OrderRejection: تاریخچه رد سفارشات
- فیلدها: دانشجو، دانشگاه، رشته، مقطع، نوع سفارش، وضعیت، پیشرفت، عامل تخصیص داده شده، مبلغ، سهم عامل، سهم مدیر

#### 4. **Files (فایل‌ها)**
- OrderFile: فایل‌های مربوط به سفارشات
- ProfileDocument: اسناد پروفایل (پاسپورت، گواهینامه)
- FileDownloadLog: لاگ دانلود فایل‌ها

#### 5. **Dashboard (داشبورد)**
- Message: سیستم پیام‌رسانی (مستقیم، گروهی، مدیریت)
- MessageAttachment: پیوست‌های پیام
- Notification: اعلان‌های سیستم
- ActivityLog: لاگ فعالیت‌های کاربران
- SystemSettings: تنظیمات سیستم

#### 6. **Accounting (حسابداری)**
- Transaction: تراکنش‌های مالی (درآمد، هزینه، پرداخت، بازگشت وجه)
- Invoice: فاکتورها
- PaymentSchedule: برنامه پرداخت (اقساط)
- AccountingEntry: ثبت‌های حسابداری (دوطرفه)
- FinancialReport: گزارش‌های مالی

### API Endpoints

#### Authentication
- `POST /api/auth/login/` - ورود کاربر
- `POST /api/auth/logout/` - خروج کاربر
- `GET /api/auth/current-user/` - دریافت کاربر فعلی

#### Users
- `GET /api/users/` - لیست کاربران
- `POST /api/users/` - ایجاد کاربر جدید
- `GET /api/users/{id}/` - جزئیات کاربر
- `PUT /api/users/{id}/` - بروزرسانی کاربر
- `DELETE /api/users/{id}/` - حذف کاربر
- `GET /api/users/by_role/?role=student` - فیلتر بر اساس نقش

#### Student Profiles
- `GET /api/student-profiles/` - لیست پروفایل‌های دانشجویی
- `POST /api/student-profiles/` - ایجاد پروفایل
- `GET /api/student-profiles/{id}/` - جزئیات پروفایل
- `PUT /api/student-profiles/{id}/` - بروزرسانی پروفایل

#### Orders
- `GET /api/orders/` - لیست سفارشات
- `POST /api/orders/` - ایجاد سفارش جدید
- `GET /api/orders/{id}/` - جزئیات سفارش
- `PUT /api/orders/{id}/` - بروزرسانی سفارش
- `POST /api/orders/{id}/approve/` - تایید سفارش
- `POST /api/orders/{id}/reject/` - رد سفارش
- `POST /api/orders/{id}/assign/` - تخصیص سفارش به عامل

#### Order Tasks
- `GET /api/order-tasks/?order_id={id}` - وظایف یک سفارش
- `POST /api/order-tasks/` - ایجاد وظیفه جدید
- `PUT /api/order-tasks/{id}/` - بروزرسانی وظیفه

#### Files
- `GET /api/order-files/?order_id={id}` - فایل‌های یک سفارش
- `POST /api/order-files/` - آپلود فایل
- `GET /api/order-files/{id}/` - دانلود فایل
- `DELETE /api/order-files/{id}/` - حذف فایل

#### Messages
- `GET /api/messages/?type=direct` - لیست پیام‌ها
- `POST /api/messages/` - ارسال پیام
- `POST /api/messages/{id}/mark_read/` - علامت‌گذاری به عنوان خوانده شده

#### Notifications
- `GET /api/notifications/` - لیست اعلان‌ها
- `GET /api/notifications/unread/` - اعلان‌های خوانده نشده
- `POST /api/notifications/{id}/mark_read/` - علامت‌گذاری به عنوان خوانده شده
- `POST /api/notifications/mark_all_read/` - علامت‌گذاری همه به عنوان خوانده شده

#### Accounting
- `GET /api/transactions/` - لیست تراکنش‌ها
- `POST /api/transactions/` - ثبت تراکنش جدید
- `GET /api/invoices/` - لیست فاکتورها
- `POST /api/invoices/` - ایجاد فاکتور
- `GET /api/payment-schedules/` - برنامه‌های پرداخت
- `GET /api/financial-reports/` - گزارش‌های مالی

#### Dashboard
- `GET /api/dashboard/stats/` - آمار داشبورد

## نصب و راه‌اندازی

### 1. نصب وابستگی‌ها
```bash
cd backend
pip install -r requirements.txt
```

### 2. ایجاد دیتابیس
```bash
python manage.py makemigrations
python manage.py migrate
```

### 3. ایجاد سوپریوزر
```bash
python manage.py createsuperuser
```

### 4. اجرای سرور
```bash
python manage.py runserver
```

سرور روی `http://127.0.0.1:8000/` اجرا می‌شود.

### 5. دسترسی به پنل ادمین
```
http://127.0.0.1:8000/admin/
```

## ساختار پروژه

```
backend/
├── accounts/           # مدیریت کاربران
├── students/           # پروفایل دانشجویان
├── orders/             # مدیریت سفارشات
├── files/              # مدیریت فایل‌ها
├── dashboard/          # داشبورد و پیام‌رسانی
├── accounting/         # سیستم حسابداری
├── api/                # API endpoints
├── config/             # تنظیمات Django
├── media/              # فایل‌های آپلود شده
├── static/             # فایل‌های استاتیک
└── manage.py
```

## نقش‌های کاربری

### 1. Manager (مدیر)
- دسترسی کامل به تمام بخش‌ها
- مدیریت کاربران
- تایید/رد سفارشات
- تخصیص سفارشات به عامل‌ها
- مشاهده گزارش‌های مالی

### 2. employee (کارمند)
- مشاهده سفارشات در انتظار و در حال انجام
- تایید/رد سفارشات
- تخصیص سفارشات
- مدیریت دانشجویان
- گفتگو با مدیر

### 3. Agent (عامل)
- مشاهده سفارشات تخصیص داده شده
- بروزرسانی پیشرفت کار
- آپلود فایل‌ها
- دریافت پرداخت‌ها

### 4. Student (دانشجو)
- ایجاد سفارش جدید
- مشاهده سفارشات خود
- دانلود فایل‌ها
- پرداخت هزینه‌ها

## امنیت

- احراز هویت با Session و Token
- CORS برای اتصال فرانت‌اند
- محدودیت دسترسی بر اساس نقش
- لاگ تمام فعالیت‌ها
- اعتبارسنجی فایل‌های آپلودی

## توسعه

برای توسعه بیشتر:
1. مدل‌های جدید در `models.py` هر اپلیکیشن
2. Serializers در `api/serializers.py`
3. Views در `api/views.py`
4. URLs در `api/urls.py`

## تست

```bash
python manage.py test
```

## مستندات API

پس از اجرای سرور، مستندات API در آدرس زیر قابل دسترسی است:
```
http://127.0.0.1:8000/api/
```

## پشتیبانی

برای سوالات و مشکلات، با تیم توسعه تماس بگیرید.
