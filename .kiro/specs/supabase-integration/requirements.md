# سند نیازمندی‌ها - یکپارچه‌سازی Supabase

## Introduction

این سند، نیازمندی‌های یکپارچه‌سازی سیستم مدیریت تحصیلی با Supabase را به عنوان Backend-as-a-Service تعریف می‌کند. هدف، جایگزینی ذخیره‌سازی مبتنی بر localStorage با یک پایگاه داده ابری واقعی، احراز هویت امن، و پشتیبانی از به‌روزرسانی‌های بلادرنگ (Realtime) است.

در حال حاضر، تمام داده‌های سیستم در localStorage مرورگر ذخیره می‌شوند و هیچ همگام‌سازی بین کاربران مختلف وجود ندارد. این ویژگی، سیستم را به یک BaaS واقعی متصل می‌کند تا داده‌ها بین تمام کاربران و دستگاه‌ها به اشتراک گذاشته شوند.

---

## واژه‌نامه (Glossary)

- **Supabase**: پلتفرم Backend-as-a-Service مبتنی بر PostgreSQL که احراز هویت، پایگاه داده، ذخیره‌سازی فایل و قابلیت Realtime را فراهم می‌کند.
- **Supabase_Client**: شیء JavaScript ایجادشده از کتابخانه `@supabase/supabase-js` که تمام ارتباطات با Supabase را مدیریت می‌کند.
- **Supabase_Auth**: سرویس احراز هویت Supabase که جایگزین سیستم لاگین مبتنی بر localStorage می‌شود.
- **Realtime_Channel**: کانال اشتراک Supabase برای دریافت تغییرات پایگاه داده به صورت بلادرنگ.
- **RLS**: سیاست Row Level Security در PostgreSQL که دسترسی به سطر داده را بر اساس نقش کاربر محدود می‌کند.
- **Storage_Bucket**: فضای ذخیره‌سازی فایل در Supabase برای آرشیو اسناد و فایل‌های دانشجویان.
- **Migration_Script**: اسکریپت JavaScript که داده‌های موجود در localStorage را به جداول Supabase منتقل می‌کند.
- **System**: سیستم مدیریت تحصیلی (کد JavaScript سمت کلاینت).
- **SupabaseDataModule**: ماژول JavaScript جدید که عملیات CRUD را از طریق Supabase انجام می‌دهد.
- **MigrationModule**: ماژول JavaScript برای انتقال یک‌باره داده‌ها از localStorage به Supabase.
- **Manager**: کاربر با نقش مدیر که به تمام داده‌ها دسترسی کامل دارد.
- **Employee**: کاربر با نقش کارمند که به سفارشات و اطلاعات دانشجویان دسترسی دارد.
- **Agent**: کاربر با نقش عامل که فقط به سفارشات تخصیص‌یافته به خود دسترسی دارد.
- **Student**: کاربر با نقش دانشجو که فقط به داده‌های خود دسترسی دارد.

---

## Requirements

### Requirement 1

**User Story:** به عنوان توسعه‌دهنده، می‌خواهم یک فایل تنظیمات مرکزی برای اتصال به Supabase داشته باشم تا تمام ماژول‌ها از یک نقطه واحد به BaaS متصل شوند.

#### Acceptance Criteria

1. THE System SHALL کتابخانه Supabase JS SDK را از طریق CDN در تمام صفحات HTML بارگذاری کند.
2. THE System SHALL فایل `js/supabase-config.js` ایجاد کند که `SUPABASE_URL` و `SUPABASE_ANON_KEY` را به عنوان ثابت تعریف نماید.
3. THE System SHALL یک نمونه واحد (singleton) از `Supabase_Client` ایجاد و آن را در متغیر سراسری `supabaseClient` قرار دهد.
4. WHEN بارگذاری صفحه انجام می‌شود، THE System SHALL اتصال به Supabase را در کمتر از ۳ ثانیه برقرار کند.
5. IF اتصال به Supabase ناموفق باشد، THEN THE System SHALL پیام خطای فارسی نمایش دهد و حالت آفلاین را فعال کند.
6. THE System SHALL ثابت `CONFIG.API_ENABLED` را از `false` به `true` تغییر دهد تا ماژول‌های موجود از Supabase استفاده کنند.

---

### Requirement 2

**User Story:** به عنوان کاربر، می‌خواهم با نام کاربری و رمز عبور وارد سیستم شوم تا داده‌هایم به صورت امن ذخیره و قابل دسترس از هر دستگاهی باشد.

#### Acceptance Criteria

1. WHEN کاربر نام کاربری و رمز عبور وارد کند، THE Supabase_Auth SHALL کاربر را با جدول `profiles` تطبیق داده و JWT صادر کند.
2. THE Supabase_Auth SHALL نشست (session) کاربر را در localStorage مرورگر ذخیره کند تا پس از بازآوری صفحه، لاگین حفظ شود.
3. WHEN کاربر درخواست خروج دهد، THE Supabase_Auth SHALL نشست را باطل کند و توکن‌های JWT را حذف نماید.
4. WHEN نشست کاربر منقضی شود، THE System SHALL به صورت خودکار توکن را تجدید کند بدون اینکه کاربر متوجه قطع ارتباط شود.
5. THE System SHALL نقش کاربر (manager, employee, agent, student) را از جدول `profiles` بازیابی و در حافظه نگه دارد.
6. IF کاربر با اعتبارنامه اشتباه وارد شود، THEN THE Supabase_Auth SHALL پیام خطای فارسی «نام کاربری یا رمز عبور اشتباه است» را برگرداند.
7. WHERE کاربر نقش student داشته باشد، THE System SHALL پس از ورود موفق، فقط صفحات مجاز برای دانشجو را نمایش دهد.

---

### Requirement 3

**User Story:** به عنوان توسعه‌دهنده، می‌خواهم ساختار جداول PostgreSQL در Supabase را تعریف کنم تا تمام داده‌های سیستم به درستی ذخیره و بازیابی شوند.

#### Acceptance Criteria

1. THE System SHALL جدول `profiles` را با فیلدهای `id`, `name`, `username`, `role`, `email`, `phone`, `active`, `created_at`, `department`, `university`, `student_id`, `field`, `degree`, `passport_number`, `bachelor_field` ایجاد کند.
2. THE System SHALL جدول `orders` را با فیلدهای `id`, `student_id`, `status`, `stage`, `progress`, `assigned_agent_id`, `total_amount`, `paid_amount`, `payment_status`, `description`, `tasks`, `work_log`, `created_at`, `updated_at` ایجاد کند.
3. THE System SHALL جدول `student_progress` را با فیلدهای `id`, `student_id`, `path_type`, `step_index`, `status`, `updated_at` ایجاد کند.
4. THE System SHALL جدول `messages` را با فیلدهای `id`, `sender_id`, `receiver_id`, `order_id`, `content`, `created_at`, `read_at` ایجاد کند.
5. THE System SHALL جدول `accounting_transactions` را با فیلدهای `id`, `order_id`, `type`, `amount`, `description`, `created_by`, `created_at` ایجاد کند.
6. THE System SHALL جدول `archived_files` را با فیلدهای `id`, `student_id`, `order_id`, `file_name`, `file_path`, `file_size`, `uploaded_by`, `created_at` ایجاد کند.
7. THE System SHALL برای تمام جداول، کلید خارجی (Foreign Key) مناسب با رفتار `CASCADE` یا `SET NULL` تعریف کند.
8. THE System SHALL ایندکس‌های لازم را بر روی ستون‌های `student_id`, `role`, `status`, `created_at` ایجاد کند تا زمان پرس‌وجو زیر ۱۰۰ میلی‌ثانیه باشد.

---

### Requirement 4

**User Story:** به عنوان مدیر سیستم، می‌خواهم هر کاربر فقط به داده‌هایی که مجاز است دسترسی داشته باشد تا امنیت اطلاعات تضمین شود.

#### Acceptance Criteria

1. THE System SHALL RLS را بر روی تمام جداول فعال کند.
2. WHILE کاربر نقش manager داشته باشد، THE System SHALL دسترسی کامل به تمام سطرهای تمام جداول را مجاز بداند.
3. WHILE کاربر نقش employee داشته باشد، THE System SHALL دسترسی SELECT و UPDATE به جداول `orders`, `profiles`, `student_progress`, `messages` را مجاز بداند.
4. WHILE کاربر نقش agent داشته باشد، THE System SHALL فقط دسترسی به سطرهایی از `orders` که `assigned_agent_id` برابر شناسه کاربر جاری است را مجاز بداند.
5. WHILE کاربر نقش student داشته باشد، THE System SHALL فقط دسترسی به سطرهایی از `orders` و `student_progress` که `student_id` برابر شناسه کاربر جاری است را مجاز بداند.
6. IF کاربر تلاش کند به سطری دسترسی داشته باشد که RLS آن را محدود کرده، THEN THE System SHALL خطای ۴۰۳ برگرداند.
7. THE System SHALL سیاست INSERT را به گونه‌ای تنظیم کند که Student فقط بتواند سفارش جدید با `student_id` خودش ایجاد کند.

---

### Requirement 5

**User Story:** به عنوان توسعه‌دهنده، می‌خواهم یک ماژول JavaScript جدید داشته باشم که تمام عملیات CRUD را از طریق Supabase انجام دهد تا `DataModule` موجود به تدریج جایگزین شود.

#### Acceptance Criteria

1. THE System SHALL فایل `js/supabase-data.js` را ایجاد کند که `SupabaseDataModule` با همان امضای API توابع `DataModule` موجود را پیاده‌سازی نماید.
2. WHEN تابع `getUsers()` فراخوانی شود، THE SupabaseDataModule SHALL داده‌ها را از جدول `profiles` در Supabase بازیابی کند.
3. WHEN تابع `saveUsers(users)` فراخوانی شود، THE SupabaseDataModule SHALL از عملیات `upsert` در Supabase برای درج یا به‌روزرسانی سطرها استفاده کند.
4. WHEN تابع `getOrders()` فراخوانی شود، THE SupabaseDataModule SHALL داده‌ها را از جدول `orders` به همراه اطلاعات `profiles` بازیابی کند.
5. WHEN تابع `saveOrders(orders)` فراخوانی شود، THE SupabaseDataModule SHALL از عملیات `upsert` در Supabase استفاده کند.
6. THE SupabaseDataModule SHALL توابع مجزا برای خواندن و نوشتن `student_progress` ارائه دهد.
7. IF عملیاتی در Supabase با خطا مواجه شود، THEN THE SupabaseDataModule SHALL خطا را با پیام فارسی مناسب ثبت و به لایه بالاتر منتقل کند.
8. THE SupabaseDataModule SHALL یک لایه کش (cache) با TTL قابل تنظیم برای کاهش تعداد درخواست‌ها پیاده‌سازی کند.

---

### Requirement 6

**User Story:** به عنوان مدیر سیستم، می‌خواهم داده‌های موجود در localStorage را به Supabase منتقل کنم تا هیچ داده‌ای از دست نرود.

#### Acceptance Criteria

1. THE System SHALL فایل `js/migration.js` ایجاد کند که `MigrationModule` برای انتقال داده‌ها از localStorage به Supabase را شامل می‌شود.
2. WHEN `MigrationModule.run()` فراخوانی شود، THE MigrationModule SHALL ابتدا داده‌های localStorage را استخراج، سپس به فرمت جداول Supabase تبدیل، و در نهایت `upsert` کند.
3. THE MigrationModule SHALL مهاجرت را به ترتیب انجام دهد: ابتدا `profiles`، سپس `orders`، سپس `student_progress`.
4. WHEN مهاجرت با موفقیت کامل شود، THE MigrationModule SHALL وضعیت `migration_done: true` را در localStorage ذخیره کند تا از اجرای مجدد جلوگیری شود.
5. IF در حین مهاجرت خطا رخ دهد، THEN THE MigrationModule SHALL عملیات را متوقف کند، خطا را ثبت نماید، و localStorage را دست‌نخورده باقی بگذارد.
6. THE MigrationModule SHALL یک گزارش مهاجرت شامل تعداد کاربران، سفارشات و پیشرفت‌های منتقل‌شده را در کنسول نمایش دهد.

---

### Requirement 7

**User Story:** به عنوان کارمند سیستم، می‌خواهم تغییرات داده‌ها بلافاصله در صفحه‌ام نمایش داده شود بدون نیاز به بارگذاری مجدد صفحه.

#### Acceptance Criteria

1. THE System SHALL `Realtime_Channel` را برای جداول `orders`, `profiles`, `messages` در Supabase راه‌اندازی کند.
2. WHEN یک سفارش جدید درج شود، THE System SHALL رویداد `ORDERS_CHANGED` را emit کند و UI را در کمتر از ۲ ثانیه به‌روزرسانی نماید.
3. WHEN وضعیت یک سفارش تغییر کند، THE System SHALL تغییر را در تمام صفحات باز منعکس کند.
4. WHEN پیام چت جدیدی دریافت شود، THE System SHALL نوتیفیکیشن بلادرنگ نمایش دهد.
5. IF اتصال Realtime قطع شود، THEN THE System SHALL به صورت خودکار با فاصله ۵ ثانیه تلاش مجدد کند.
6. THE System SHALL Realtime Channel را با `RealtimeEvents` موجود در کد ادغام کند.

---

### Requirement 8

**User Story:** به عنوان کارمند، می‌خواهم فایل‌های دانشجویان را در Supabase Storage آپلود و دانلود کنم تا فایل‌ها در فضای ابری ذخیره شوند.

#### Acceptance Criteria

1. THE System SHALL یک `Storage_Bucket` با نام `student-files` در Supabase ایجاد کند.
2. WHEN فایلی آپلود شود، THE System SHALL فایل را در مسیر `{student_id}/{order_id}/{filename}` ذخیره کند.
3. THE System SHALL اندازه فایل‌های آپلودی را به حداکثر ۵۰ مگابایت محدود کند.
4. THE System SHALL فقط فرمت‌های `pdf`, `doc`, `docx`, `jpg`, `png` را برای آپلود مجاز بداند.
5. WHEN درخواست دانلود فایل داده شود، THE System SHALL URL امضاشده (signed URL) با اعتبار ۱ ساعته تولید کند.
6. WHILE کاربر نقش student داشته باشد، THE System SHALL فقط دسترسی به فایل‌های مرتبط با `student_id` خودش را مجاز بداند.
7. IF آپلود فایل ناموفق باشد، THEN THE System SHALL پیام خطای فارسی به همراه دلیل شکست نمایش دهد.

---

### Requirement 9

**User Story:** به عنوان توسعه‌دهنده، می‌خواهم تغییرات لازم در فایل‌های موجود را با حداقل تخریب انجام دهم تا تمام ماژول‌های موجود بدون بازنویسی کامل کار کنند.

#### Acceptance Criteria

1. THE System SHALL در فایل `js/config.js`، مقدار `API_ENABLED` را از `false` به `true` و `API_BASE_URL` را به آدرس Supabase تغییر دهد.
2. THE System SHALL در فایل `js/auth.js`، متد `login()` را به گونه‌ای اصلاح کند که از `Supabase_Auth.signInWithPassword()` استفاده کند.
3. THE System SHALL در فایل `js/auth.js`، متد `logout()` را به گونه‌ای اصلاح کند که از `Supabase_Auth.signOut()` استفاده کند.
4. THE System SHALL در فایل `js/data.js`، توابع `getUsers()`, `saveUsers()`, `getOrders()`, `saveOrders()` را به گونه‌ای اصلاح کند که ابتدا `SupabaseDataModule` را فراخوانی کند و در صورت خطا به localStorage fallback کند.
5. THE System SHALL تمام فایل‌های HTML را به گونه‌ای به‌روزرسانی کند که `js/supabase-config.js` قبل از سایر اسکریپت‌های JS بارگذاری شود.
6. WHEN `CONFIG.API_ENABLED` برابر `true` باشد، THE System SHALL از `SupabaseDataModule` استفاده کند، در غیر این صورت از `DataModule` استفاده نماید.

---

### Requirement 10

**User Story:** به عنوان کاربر، می‌خواهم در صورت قطعی اینترنت، سیستم همچنان کار کند و داده‌های من از دست نرود.

#### Acceptance Criteria

1. WHEN اتصال به Supabase قطع شود، THE System SHALL به صورت خودکار به حالت localStorage fallback تغییر کند.
2. WHILE سیستم در حالت آفلاین است، THE System SHALL یک نوار اطلاع‌رسانی فارسی «حالت آفلاین - داده‌ها به صورت محلی ذخیره می‌شوند» نمایش دهد.
3. WHEN اتصال به Supabase بازگردد، THE System SHALL داده‌های ذخیره‌شده در حالت آفلاین را با Supabase همگام‌سازی کند.
4. THE System SHALL تمام خطاهای Supabase را به فارسی ترجمه و به کاربر نمایش دهد.
5. IF عملیات نوشتن در Supabase ناموفق باشد، THEN THE System SHALL داده را در localStorage ذخیره کند و عملیات را در صف همگام‌سازی قرار دهد.

---

### Requirement 11

**User Story:** به عنوان توسعه‌دهنده، می‌خواهم یک فایل SQL کامل داشته باشم که با اجرا در Supabase SQL Editor، تمام جداول، RLS و دسترسی‌ها را به صورت خودکار ایجاد کند.

#### Acceptance Criteria

1. THE System SHALL فایل `supabase/schema.sql` را ایجاد کند که شامل دستورات `CREATE TABLE IF NOT EXISTS` برای تمام جداول است.
2. THE System SHALL دستورات `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` برای تمام جداول را در فایل SQL قرار دهد.
3. THE System SHALL دستورات `CREATE POLICY` برای تمام ترکیب‌های نقش-جدول را در فایل SQL قرار دهد.
4. THE System SHALL دستورات `CREATE INDEX` برای ستون‌های پرکاربرد را در فایل SQL قرار دهد.
5. THE System SHALL یک تابع PostgreSQL برای اعتبارسنجی نقش کاربر (`get_user_role()`) ایجاد کند که در سیاست‌های RLS استفاده شود.
6. THE System SHALL یک Trigger ایجاد کند که پس از ایجاد کاربر جدید در `auth.users`، به صورت خودکار یک سطر در جدول `profiles` درج کند.
7. THE System SHALL تمام دستورات SQL را به صورت idempotent بنویسد تا اجرای مکرر بدون خطا انجام شود.

---

### Requirement 12

**User Story:** به عنوان توسعه‌دهنده یا مدیر سیستم، می‌خواهم یک راهنمای مرحله‌به‌مرحله داشته باشم تا بتوانم پروژه را به Supabase متصل کنم.

#### Acceptance Criteria

1. THE System SHALL فایل `SUPABASE_SETUP.md` را ایجاد کند که شامل راهنمای کامل نصب و راه‌اندازی به فارسی است.
2. THE System SHALL در `SUPABASE_SETUP.md` مراحل ایجاد پروژه در Supabase، اجرای SQL Schema، تنظیم متغیرهای محیطی و آزمایش اتصال را شرح دهد.
3. THE System SHALL در `SUPABASE_SETUP.md` نمونه کد JavaScript برای آزمایش اتصال و تأیید RLS را شامل کند.
4. THE System SHALL در `SUPABASE_SETUP.md` لیست تمام متغیرهایی که باید در `js/supabase-config.js` تنظیم شوند را مشخص کند.
