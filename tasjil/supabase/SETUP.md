# راهنمای اتصال به Supabase

## مرحله ۱ — اجرای SQL

1. وارد [supabase.com/dashboard](https://supabase.com/dashboard) شو
2. پروژه‌ات رو انتخاب کن
3. برو به **SQL Editor** (آیکون پایگاه داده در سایدبار)
4. محتوای فایل `supabase/schema.sql` رو کپی کن و **Run** بزن

---

## مرحله ۲ — گرفتن کلیدها

1. در داشبورد برو به **Settings > API**
2. دو مقدار رو کپی کن:
   - **Project URL** → مثل `https://abcdefgh.supabase.co`
   - **anon public** key

---

## مرحله ۳ — جایگذاری در کد

فایل `assets/js/supabase-client.js` رو باز کن و دو خط رو ویرایش کن:

```js
const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';  // ← Project URL
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';                 // ← anon public key
```

---

## مرحله ۴ — تأیید Storage Bucket

1. در داشبورد برو به **Storage**
2. باید bucket با نام `student-documents` ساخته شده باشه
3. اگر نبود: کلیک **New Bucket** → نام `student-documents` → غیرعمومی (private)

---

## ساختار جدول‌ها

| فیلد | نوع | توضیح |
|---|---|---|
| `registration_id` | TEXT | شناسه یکتا (REG-YYYYMMDDHHMMSS) |
| `middle_name` | TEXT | الاسم الثلاثي |
| `last_name` | TEXT | لقب العائلة |
| `religion` | TEXT | الديانة |
| `phone` | TEXT | رقم الهاتف |
| `email` | TEXT | البريد الإلكتروني |
| `address_iraq` | TEXT | العنوان في العراق |
| `job` | TEXT | الوظيفة |
| `marital_status` | TEXT | أعزب / متزوج |
| `children_count` | INTEGER | عدد الأطفال |
| `university_type` | TEXT | نفقة خاصة / ابتعاث |
| `degree` | TEXT | master / phd |
| `major` | TEXT | التخصص |
| `previous_university` | TEXT | جامعة البكالوريوس |
| `master_university` | TEXT | جامعة الماجستير (للدكتوراه) |
| `bachelor_gpa` | TEXT | معدل البكالوريوس |
| `master_gpa` | TEXT | معدل الماجستير (للدكتوراه) |
| `passport_url` | TEXT | مسیر فایل در Storage |
| `personal_photo_url` | TEXT | مسیر فایل در Storage |
| `transcript_url` | TEXT | مسیر فایل در Storage |
| `master_transcript_url` | TEXT | مسیر فایل در Storage |
| `master_certificate_url` | TEXT | مسیر فایل در Storage |
| `status` | TEXT | pending / reviewed / accepted / rejected |
| `created_at` | TIMESTAMPTZ | تاریخ ثبت |

---

## مشاهده داده‌ها (پنل ادمین)

برای دیدن ثبت‌نام‌ها:

```sql
SELECT * FROM admin_registrations;
```

یا مستقیم در **Table Editor** داشبورد Supabase.

---

## نکته امنیتی

- `anon key` در فرانت‌اند قابل استفاده است — RLS آن را کنترل می‌کند
- `service_role key` را **هرگز** در فرانت‌اند نگذار
- Storage bucket روی private تنظیم شده، فایل‌ها فقط با signed URL قابل دسترس هستند
