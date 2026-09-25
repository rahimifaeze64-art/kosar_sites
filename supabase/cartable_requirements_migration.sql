-- ============================================================
-- cartable_requirements_migration.sql
-- دو تغییر برای کارتابل کارمند و ملزومات هر دانشجو:
--
--   ۱) employee_tasks.attached_file
--      فایل ضمیمه‌شده به هر وظیفهٔ کارتابل (سنجاق). ساختار JSON:
--      { name, size, type, category, storagePath, displayUrl, data }
--      - category : دستهٔ مقصد در بخش «فایل ها»ی پروفایل دانشجو
--      - data     : base64 فقط وقتی آپلود به Storage ممکن نشده باشد
--        (آفلاین) — در غیر این صورت خالی/null است.
--
--   ۲) profiles.requirements_excluded
--      آرایهٔ نامِ ملزومه‌هایی که برای این دانشجو «لازم نیست».
--      زیرمجموعه‌ای از فهرست ملزومات سراسری (getDefaultRequirementsSteps).
--      فقط ملزومه‌هایی که در این آرایه نیستند به کارمندان ارسال می‌شوند.
--
-- اجرا در: Supabase Dashboard → SQL Editor
-- ایمن برای اجرای مجدد (idempotent)
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ۱. ستون فایل ضمیمهٔ وظیفه
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS attached_file JSONB;

COMMENT ON COLUMN public.employee_tasks.attached_file IS
    'فایل ضمیمه‌شده به وظیفه (سنجاق کارتابل) — { name, size, type, category, storagePath, displayUrl, data }';

-- ════════════════════════════════════════════════════════════
-- ۲. ستون ملزومات لازم‌نبودهٔ هر دانشجو
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS requirements_excluded JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.requirements_excluded IS
    'آرایهٔ نام ملزومه‌هایی که برای این دانشجو لازم نیستند — بقیه به کارمندان ارسال می‌شود';

-- ════════════════════════════════════════════════════════════
-- ۳. تأیید
-- ════════════════════════════════════════════════════════════
SELECT
    'cartable_requirements_migration ready ✓' AS status,
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'employee_tasks'
        AND column_name = 'attached_file')     AS employee_tasks_attached_file,
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name = 'requirements_excluded') AS profiles_requirements_excluded;
