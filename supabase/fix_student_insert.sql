-- ============================================================
-- fix_student_insert.sql  v2
-- فقط روی جدول profiles کار می‌کند — بدون ALTER TYPE
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── ۱. بررسی ساختار فعلی profiles ───────────────────────────
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ── ۲. بررسی constraints روی profiles ───────────────────────
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
ORDER BY contype;

-- ── ۳. حذف UNIQUE از username (اگر وجود داشت) ──────────────
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_username_key;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_username_unique;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS uq_profiles_username;

-- username رو nullable کن
ALTER TABLE public.profiles
    ALTER COLUMN username DROP NOT NULL;

-- ── ۴. RLS — دسترسی کامل برای anon ──────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all"              ON public.profiles;
DROP POLICY IF EXISTS "allow_all_profiles"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_all"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_full_access"  ON public.profiles;

CREATE POLICY "profiles_full_access"
    ON public.profiles FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- ── ۵. تست insert ────────────────────────────────────────────
DO $$
DECLARE
    v_err TEXT;
BEGIN
    INSERT INTO public.profiles (id, name, username, role, active)
    VALUES (
        'test_ins_' || extract(epoch from now())::bigint::text,
        'تست دانشجو',
        'testuser_' || extract(epoch from now())::bigint::text,
        'student',
        true
    );
    RAISE NOTICE '✅ INSERT موفق بود — جدول profiles درست کار می‌کند';
EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    RAISE NOTICE '❌ INSERT خطا: %', v_err;
END $$;

-- پاک کردن رکوردهای تست
DELETE FROM public.profiles WHERE id LIKE 'test_ins_%';

-- ── ۶. وضعیت نهایی ───────────────────────────────────────────
SELECT
    count(*) AS total,
    count(*) FILTER (WHERE role='student')  AS students,
    count(*) FILTER (WHERE role='employee') AS employees,
    count(*) FILTER (WHERE role='manager')  AS managers
FROM public.profiles;
