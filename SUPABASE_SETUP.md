# راه‌اندازی Supabase — دستورالعمل نصب

## ۱. ایجاد پروژه Supabase

1. به [supabase.com](https://supabase.com) بروید و یک پروژه جدید بسازید.
2. بعد از ساخت پروژه، به **Settings > API** بروید.
3. مقادیر زیر را کپی کنید:
   - **Project URL** (مثال: `https://xyzabc.supabase.co`)
   - **anon/public key** (کلید طولانی که با `eyJ` شروع می‌شود)

## ۲. تنظیم اعتبارنامه‌ها

فایل `js/supabase-config.js` را باز کنید و دو خط اول را ویرایش کنید:

```js
const SUPABASE_URL      = 'https://xyzabc.supabase.co';       // ← مقدار واقعی
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...'; // ← مقدار واقعی
```

## ۳. اجرای اسکریپت دیتابیس

1. در داشبورد Supabase به **SQL Editor** بروید.
2. محتوای فایل `schema_ksr_full.sql` را کپی و اجرا کنید.
3. اسکریپت idempotent است — اجرای مجدد آسیبی نمی‌رساند.

## ۴. ساخت باکت Storage

در داشبورد Supabase > **Storage**:
- نام باکت: `student-files`
- Public bucket: **OFF**
- File size limit: 50MB
- Allowed MIME: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/jpeg`, `image/png`

## ۵. ایجاد کاربران اولیه

چون `signUp` نیاز به تأیید ایمیل دارد، دو گزینه دارید:

**گزینه الف — غیرفعال کردن تأیید ایمیل (توصیه شده برای شروع):**
- در داشبورد Supabase > **Authentication > Settings**
- گزینه "Confirm email" را **غیرفعال** کنید.

**گزینه ب — ساخت دستی از طریق داشبورد:**
- در **Authentication > Users** کاربران را با ایمیل `username@kowsar.local` بسازید.
- در `profiles` table پروفایل هر کاربر را وارد کنید.

## ۶. بررسی وضعیت

بعد از تنظیم، صفحه `index.html` را باز کنید. اگر اتصال موفق باشد، بنر سبز رنگ
**«☁️ متصل به Supabase»** در پایین صفحه ظاهر می‌شود.

---

## نکات مهم

- **offline mode**: اگر Supabase در دسترس نباشد، برنامه به صورت خودکار از localStorage استفاده می‌کند.
- **agent share/manager share**: این مقادیر توسط trigger دیتابیس محاسبه می‌شوند — در کد JS محاسبه نشوند.
- **نقش "doctor"**: در دیتابیس وجود ندارد — همیشه `"agent"` ذخیره شود. "دکتر" فقط label نمایشی است.
- **درجه تحصیلی**: در DB به شکل انگلیسی (`bachelor`/`masters`/`phd`) ذخیره می‌شود.
