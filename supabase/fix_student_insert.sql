-- ============================================================
-- fix_student_insert.sql  v3
-- رفع مشکل profiles_degree_check
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── ۱. نمایش CHECK constraints فعلی روی profiles ─────────────
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
ORDER BY contype, conname;

-- ── ۲. حذف degree CHECK constraint و جایگزینی با نسخه کامل ──
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_degree_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_degree_check
    CHECK (degree IN ('bachelor','masters','phd','كارشناسي','کارشناسی','ارشد','دکتری','کارشناسی ارشد') OR degree IS NULL);

-- ── ۳. RLS ───────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all"             ON public.profiles;
DROP POLICY IF EXISTS "allow_all_profiles"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_all"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_full_access" ON public.profiles;

CREATE POLICY "profiles_full_access"
    ON public.profiles FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- ── ۴. تست insert با مقادیر مختلف degree ─────────────────────
DO $$
DECLARE v_err TEXT;
BEGIN
    -- تست با bachelor
    INSERT INTO public.profiles (id, name, username, role, degree, active)
    VALUES ('_test_b', 'تست کارشناسی', '_test_b_user', 'student', 'bachelor', true);

    -- تست با masters
    INSERT INTO public.profiles (id, name, username, role, degree, active)
    VALUES ('_test_m', 'تست ارشد', '_test_m_user', 'student', 'masters', true);

    -- تست با phd
    INSERT INTO public.profiles (id, name, username, role, degree, active)
    VALUES ('_test_p', 'تست دکتری', '_test_p_user', 'student', 'phd', true);

    RAISE NOTICE '✅ همه INSERT ها موفق بودند';
EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    RAISE NOTICE '❌ خطا: %', v_err;
END $$;

-- پاک‌سازی
DELETE FROM public.profiles WHERE id IN ('_test_b','_test_m','_test_p');

-- ── ۵. وضعیت نهایی ───────────────────────────────────────────
SELECT
    count(*) AS total,
    count(*) FILTER (WHERE role='student')  AS students
FROM public.profiles;
