-- ============================================================
-- migrate_all_students_to_educational.sql
-- انتقال مسیر فعال «همهٔ» دانشجویان به فاز «در حال تحصیل» ('studying')
-- (دانشجوی پیش از دفاع؛ مسیر مستقل جدید)
--   • همهٔ مقادیر فعلی (defense / requirements / educational / NULL / ...) → 'studying'
--   • فقط پروفایل‌های role='student' که فارغ‌التحصیل نشده‌اند
--   • Idempotent — اجرای چندباره امن است
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

UPDATE public.profiles
SET current_path = 'studying',
    updated_at   = now()
WHERE role = 'student'
  AND graduated IS NOT TRUE           -- فارغ‌التحصیل‌ها دست نمی‌خورند
  AND current_path IS DISTINCT FROM 'studying';

-- ── تأیید ──
SELECT
    count(*) FILTER (WHERE current_path = 'studying')                     AS students_on_studying,
    count(*) FILTER (WHERE current_path IS DISTINCT FROM 'studying'
                       AND graduated IS NOT TRUE)                         AS students_not_yet_migrated,
    count(*) AS total_students
FROM public.profiles
WHERE role = 'student';

-- برای افزودن خود فاز «در حال تحصیل» و زیرمرحله‌هایش به آرایهٔ
-- مراحل، فایل کامل add_currently_studying_step.sql را اجرا کنید.