# خلاصه تغییرات Status ها

## تغییرات انجام شده

### 1. فایل `js/config.js`
✅ Status های اضافی حذف شدند:
- ❌ `approved` (تایید شده) - حذف شد
- ❌ `rejected` (رد شده) - حذف شد  
- ❌ `cancelled` (لغو شده) - حذف شد

✅ فقط 3 Status باقی ماند:
- ✓ `pending` (در انتظار)
- ✓ `in_progress` (در حال انجام)
- ✓ `completed` (تکمیل شده)

### 2. فایل `js/orders.js`
✅ فیلتر Status ها به 3 حالت کاهش یافت
✅ توابع `getStatusClass` و `getStatusText` آپدیت شدند

### 3. فایل `js/dashboard.js`
✅ توابع `getStatusClass` و `getStatusText` آپدیت شدند

## فایل‌هایی که نیاز به بررسی دارند

### ⚠️ فایل‌های Workflow (نیاز به بررسی دستی)
این فایل‌ها از status های `rejected` و `terminated` استفاده می‌کنند که مربوط به workflow مراحل رساله هستند:

1. **js/thesis-workflow.js**
   - استفاده از `rejected` برای رد کردن مراحل
   - استفاده از `terminated` برای خاتمه دادن workflow
   - این status ها ممکن است برای workflow لازم باشند

2. **js/thesis-progress-ui.js**
   - نمایش مراحل رد شده
   - نمایش مراحل خاتمه یافته

### ⚠️ فایل‌های Modal (نیاز به حذف توابع)
این فایل‌ها توابع `approveOrder` و `rejectOrder` دارند که دیگر لازم نیستند:

1. **js/modals.js**
   - تابع `approveOrder()` - باید حذف شود
   - تابع `rejectOrder()` - باید حذف شود
   - این توابع status را به `approved` یا `rejected` تغییر می‌دهند

### ⚠️ فایل‌های Data (نیاز به بررسی)
1. **js/data.js**
   - داده‌های نمونه با status `approved`
   - باید به `in_progress` تغییر یابند

## توصیه‌ها

### برای Workflow مراحل رساله:
اگر می‌خواهید قابلیت رد کردن مراحل را حفظ کنید، می‌توانید:
- از یک فیلد جداگانه مثل `stepStatus` استفاده کنید
- یا از همان 3 status اصلی استفاده کنید و فقط یک فیلد `rejectionReason` اضافه کنید

### برای تایید/رد سفارشات:
به جای status های `approved` و `rejected`:
- سفارش جدید با status `pending` ایجاد می‌شود
- مدیر می‌تواند مستقیماً آن را به `in_progress` تغییر دهد (یعنی تایید کرده)
- یا می‌تواند سفارش را حذف کند (به جای رد کردن)

## مراحل بعدی

1. ✅ تصمیم بگیرید که آیا workflow مراحل رساله نیاز به status های اضافی دارد یا نه
2. ✅ توابع `approveOrder` و `rejectOrder` را از modals.js حذف کنید
3. ✅ داده‌های نمونه در data.js را آپدیت کنید
4. ✅ تست کنید که همه صفحات به درستی کار می‌کنند
