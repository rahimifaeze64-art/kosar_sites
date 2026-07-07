# راهنمای کامل اتصال فرانت به بک‌اند

## 📋 خلاصه تغییرات

این سند تمام تغییرات انجام شده برای اتصال فرانت‌اند به بک‌اند Django را شرح می‌دهد.

---

## 🎯 فایل‌های جدید ایجاد شده

### 1. `js/api-orders.js`
ماژول اصلی برای ارتباط با API بک‌اند

**قابلیت‌ها:**
- مدیریت CSRF Token
- درخواست‌های HTTP با احراز هویت
- مدیریت سفارشات (CRUD)
- مدیریت وظایف عامل‌ها
- آپلود فایل
- مدیریت اعلان‌ها

**توابع اصلی:**
```javascript
// سفارشات
APIOrdersModule.getOrders()
APIOrdersModule.createOrder(orderData)
APIOrdersModule.approveOrder(orderId)
APIOrdersModule.rejectOrder(orderId, reason)
APIOrdersModule.assignOrder(orderId, agentId)

// وظایف
APIOrdersModule.getTasks()
APIOrdersModule.createTask(taskData)
APIOrdersModule.updateTaskStatus(taskId, status)

// فایل‌ها
APIOrdersModule.uploadOrderFile(orderId, file, fileType)
APIOrdersModule.getOrderFiles(orderId)

// اعلان‌ها
APIOrdersModule.getNotifications()
APIOrdersModule.markNotificationRead(notificationId)
```

### 2. `test-backend-integration.html`
صفحه تست کامل برای بررسی اتصال فرانت به بک‌اند

**تست‌های موجود:**
1. ✅ تست احراز هویت (Login)
2. ✅ تست دریافت لیست سفارشات
3. ✅ تست ایجاد سفارش جدید
4. ✅ تست دریافت وظایف
5. ✅ تست ایجاد وظیفه جدید
6. ✅ تست به‌روزرسانی وضعیت وظیفه
7. ✅ تست تایید سفارش
8. ✅ تست دریافت اعلان‌ها

---

## 🔄 فایل‌های به‌روزرسانی شده

### 1. `js/orders.js`
**تغییرات:**
- تابع `getFilteredOrders()` به `async` تبدیل شد
- اضافه شدن `convertBackendOrder()` برای تبدیل فرمت بک‌اند به فرانت
- اضافه شدن توابع `createOrder()`, `approveOrder()`, `rejectOrder()`, `assignOrder()`
- پشتیبانی از fallback به localStorage در صورت عدم دسترسی به API

**مثال استفاده:**
```javascript
// ایجاد سفارش جدید
await OrdersModule.createOrder({
    university: 'دانشگاه قم',
    field: 'حقوق',
    degree: 'ارشد',
    type: 'نوشتن رساله',
    deadline: '2026-12-31',
    total_amount: 5000000,
    student: studentId
});
```

### 2. `js/agent.js`
**تغییرات:**
- تابع `getMyTasks()` به `async` تبدیل شد
- اضافه شدن `convertBackendTask()` برای تبدیل فرمت
- تابع `updateTaskStatus()` به `async` تبدیل شد و به API متصل شد
- اضافه شدن `updateTaskButton()` برای به‌روزرسانی UI

**مثال استفاده:**
```javascript
// به‌روزرسانی وضعیت وظیفه
await AgentModule.updateTaskStatus(taskId, userId, event);
```

### 3. `js/tasks.js`
**تغییرات:**
- تابع `createTask()` به `async` تبدیل شد
- اتصال به API برای ایجاد وظیفه در بک‌اند
- پشتیبانی از fallback به localStorage

**مثال استفاده:**
```javascript
// ایجاد وظیفه جدید
await TasksModule.createTask();
```

### 4. `index.html`
**تغییرات:**
- اضافه شدن `<script src="js/api-orders.js"></script>` بعد از `js/api.js`

---

## 🔌 نقاط اتصال API

### Backend Endpoints (Django)

#### احراز هویت
```
POST   /api/auth/login/          - ورود کاربر
POST   /api/auth/logout/         - خروج کاربر
GET    /api/auth/current-user/   - دریافت کاربر فعلی
```

#### سفارشات
```
GET    /api/orders/              - لیست سفارشات (فیلتر شده بر اساس نقش)
POST   /api/orders/              - ایجاد سفارش جدید
GET    /api/orders/{id}/         - جزئیات سفارش
PATCH  /api/orders/{id}/         - به‌روزرسانی سفارش
POST   /api/orders/{id}/approve/ - تایید سفارش
POST   /api/orders/{id}/reject/  - رد سفارش
POST   /api/orders/{id}/assign/  - تخصیص به عامل
```

#### وظایف
```
GET    /api/order-tasks/         - لیست وظایف (فیلتر شده بر اساس نقش)
POST   /api/order-tasks/         - ایجاد وظیفه جدید
GET    /api/order-tasks/{id}/    - جزئیات وظیفه
PATCH  /api/order-tasks/{id}/    - به‌روزرسانی وظیفه
```

#### فایل‌ها
```
GET    /api/order-files/         - لیست فایل‌های سفارش
POST   /api/order-files/         - آپلود فایل جدید
GET    /api/order-files/{id}/    - دانلود فایل
```

#### اعلان‌ها
```
GET    /api/notifications/           - لیست اعلان‌ها
GET    /api/notifications/unread/    - اعلان‌های خوانده نشده
POST   /api/notifications/{id}/mark_read/ - علامت‌گذاری به عنوان خوانده شده
POST   /api/notifications/mark_all_read/  - علامت‌گذاری همه به عنوان خوانده شده
```

#### آمار داشبورد
```
GET    /api/dashboard/stats/     - آمار داشبورد بر اساس نقش کاربر
```

---

## 🚀 نحوه استفاده

### مرحله 1: راه‌اندازی Backend
```bash
cd backend
python manage.py runserver 8000
```

### مرحله 2: باز کردن Frontend
فایل `index.html` را در مرورگر باز کنید یا از یک سرور محلی استفاده کنید:
```bash
# با Python
python -m http.server 8080

# یا با Node.js
npx http-server -p 8080
```

### مرحله 3: تست اتصال
فایل `test-backend-integration.html` را باز کنید و روی "اجرای تمام تست‌ها" کلیک کنید.

---

## 🔄 جریان کار (Workflow)

### ایجاد سفارش جدید

```
Frontend (index.html)
    ↓
User fills form
    ↓
OrdersModule.createOrder()
    ↓
APIOrdersModule.createOrder()
    ↓
POST /api/orders/
    ↓
Backend (OrderViewSet.perform_create)
    ↓
Save to Database (SQLite)
    ↓
Create ActivityLog
    ↓
Return order data
    ↓
Update Frontend UI
```

### تخصیص سفارش به عامل

```
Frontend (Manager Dashboard)
    ↓
Manager clicks "تخصیص"
    ↓
OrdersModule.assignOrder(orderId, agentId)
    ↓
APIOrdersModule.assignOrder()
    ↓
POST /api/orders/{id}/assign/
    ↓
Backend updates order
    ↓
Create notification for agent
    ↓
Log activity
    ↓
Return updated order
    ↓
Refresh Frontend
```

### عامل به‌روزرسانی وضعیت وظیفه

```
Frontend (Agent Dashboard)
    ↓
Agent clicks status button
    ↓
AgentModule.updateTaskStatus()
    ↓
APIOrdersModule.updateTaskStatus()
    ↓
PATCH /api/order-tasks/{id}/
    ↓
Backend updates task status
    ↓
Return updated task
    ↓
Update button UI
    ↓
Refresh task list
```

---

## 💾 ذخیره‌سازی داده‌ها

### در Backend (Django + SQLite)
تمام داده‌ها در دیتابیس SQLite ذخیره می‌شوند:
- `backend/db.sqlite3`

### در Frontend (localStorage)
داده‌ها به عنوان cache در localStorage ذخیره می‌شوند:
- فقط زمانی استفاده می‌شود که API در دسترس نباشد
- به صورت خودکار با backend همگام‌سازی می‌شود

---

## 🔒 امنیت

### CSRF Protection
- تمام درخواست‌های POST/PATCH/DELETE شامل CSRF Token هستند
- Token از cookie دریافت می‌شود

### Authentication
- تمام API endpoints نیاز به احراز هویت دارند (به جز login)
- Session-based authentication
- Cookie credentials در تمام درخواست‌ها ارسال می‌شود

### Authorization
- فیلتر بر اساس نقش کاربر در backend
- مدیر: دسترسی به همه چیز
- کارمند: دسترسی به سفارشات pending و in_progress
- عامل: دسترسی به سفارشات تخصیص داده شده
- دانشجو: دسترسی به سفارشات خودش

---

## 🐛 عیب‌یابی

### خطای CORS
اگر خطای CORS دریافت کردید:
```python
# در backend/config/settings.py
CORS_ALLOW_ALL_ORIGINS = True  # فقط برای development
```

### خطای 403 Forbidden
- مطمئن شوید که وارد سیستم شده‌اید
- CSRF Token را بررسی کنید
- Cookie credentials را فعال کنید

### خطای 404 Not Found
- مطمئن شوید که Django server در حال اجرا است
- URL را بررسی کنید (باید `http://127.0.0.1:8000` باشد)

### داده‌ها ذخیره نمی‌شوند
1. بررسی کنید که Django server اجرا شده باشد
2. Console browser را برای خطاها بررسی کنید
3. فایل `test-backend-integration.html` را اجرا کنید
4. لاگ‌های Django را بررسی کنید

---

## ✅ چک‌لیست تست

- [ ] Django server در حال اجرا است (`python manage.py runserver 8000`)
- [ ] ورود به سیستم کار می‌کند
- [ ] لیست سفارشات نمایش داده می‌شود
- [ ] ایجاد سفارش جدید کار می‌کند
- [ ] سفارش در Django Admin نمایش داده می‌شود
- [ ] تایید/رد سفارش کار می‌کند
- [ ] تخصیص سفارش به عامل کار می‌کند
- [ ] عامل می‌تواند وظایف خود را ببیند
- [ ] به‌روزرسانی وضعیت وظیفه کار می‌کند
- [ ] اعلان‌ها نمایش داده می‌شوند
- [ ] تمام تست‌های `test-backend-integration.html` موفق هستند

---

## 📊 وضعیت فعلی

### ✅ کامل شده
- اتصال API سفارشات
- اتصال API وظایف عامل‌ها
- احراز هویت و مجوزدهی
- ایجاد و مدیریت سفارشات
- تخصیص سفارش به عامل
- به‌روزرسانی وضعیت وظایف
- دریافت اعلان‌ها
- Fallback به localStorage

### 🚧 در حال توسعه
- آپلود فایل (API آماده است، UI نیاز به تکمیل دارد)
- پرداخت‌ها (backend آماده است، frontend نیاز به اتصال دارد)
- گزارش‌گیری پیشرفته
- WebSocket برای به‌روزرسانی real-time

---

## 📞 پشتیبانی

اگر مشکلی داشتید:
1. فایل `test-backend-integration.html` را اجرا کنید
2. لاگ‌های تفصیلی را بررسی کنید
3. Console مرورگر را برای خطاهای JavaScript بررسی کنید
4. لاگ‌های Django را بررسی کنید

---

**تاریخ آخرین به‌روزرسانی:** 2026-02-28
**نسخه:** 1.0.0
