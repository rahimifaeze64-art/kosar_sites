-- ============================================================
-- student_status_migration.sql
-- اضافه کردن ستون‌های وضعیت تحصیلی دانشجو به جدول profiles
--   • graduated        — فارغ‌التحصیل شده
--   • graduated_date   — تاریخ فارغ‌التحصیلی
--   • current_path     — مسیر فعلی (defense/educational/requirements)
--   • finished_date    — تاریخ اتمام کار (خاتمه یافته)
--   • students_data    — JSONB ذخیره کامل داده محلی (fallback)
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── ۱. ستون‌های جدید به profiles ─────────────────────────────

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS graduated       BOOLEAN     DEFAULT false;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS graduated_date  timestamptz;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS current_path    TEXT
        CHECK (current_path IN ('defense','educational','requirements') OR current_path IS NULL);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS finished_date   timestamptz;

-- ستون JSONB برای ذخیره کامل students_data (backup / fallback)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS students_meta   JSONB       DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.graduated      IS 'آیا دانشجو فارغ‌التحصیل شده / Whether student has graduated';
COMMENT ON COLUMN public.profiles.graduated_date IS 'تاریخ فارغ‌التحصیلی / Graduation date';
COMMENT ON COLUMN public.profiles.current_path   IS 'مسیر فعلی تحصیلی: defense | educational | requirements';
COMMENT ON COLUMN public.profiles.finished_date  IS 'تاریخ اتمام کار (خاتمه یافته) / Date student work ended';
COMMENT ON COLUMN public.profiles.students_meta  IS 'داده‌های تکمیلی دانشجو به صورت JSON (مراحل، یادداشت‌ها، ...)';

-- ── ۲. ایندکس برای کوئری سریع ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_graduated
    ON public.profiles (graduated)
    WHERE graduated = true;

CREATE INDEX IF NOT EXISTS idx_profiles_current_path
    ON public.profiles (current_path)
    WHERE current_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active_path
    ON public.profiles (active, current_path);

-- ── ۳. View کمکی برای لیست دانشجویان با وضعیت ───────────────
CREATE OR REPLACE VIEW public.v_student_status AS
SELECT
    p.id,
    p.name,
    p.username,
    p.university,
    p.field,
    p.degree,
    p.active,
    p.graduated,
    p.graduated_date,
    p.current_path,
    p.finished_date,
    p.created_at,
    -- وضعیت محاسبه‌شده
    CASE
        WHEN p.graduated                          THEN 'graduated'
        WHEN NOT p.active AND p.finished_date IS NOT NULL THEN 'finished'
        WHEN p.active AND p.current_path = 'educational'  THEN 'educational'
        WHEN p.active AND p.current_path = 'defense'      THEN 'defense'
        WHEN p.active AND p.current_path = 'requirements' THEN 'requirements'
        WHEN p.active                             THEN 'active'
        ELSE 'inactive'
    END AS computed_status
FROM public.profiles p
WHERE p.role = 'student';

COMMENT ON VIEW public.v_student_status IS
    'نمایه وضعیت دانشجویان با محاسبه خودکار مرحله فعلی';

-- ── ۴. به‌روزرسانی RLS برای ستون‌های جدید ────────────────────
-- پالیسی موجود "profiles_full_access" و "anon_all" همه عملیات را
-- پوشش می‌دهند — نیازی به تغییر نیست

-- ── ۵. تأیید نهایی ───────────────────────────────────────────
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'profiles'
  AND column_name  IN ('graduated','graduated_date','current_path','finished_date','students_meta')
ORDER BY column_name;
