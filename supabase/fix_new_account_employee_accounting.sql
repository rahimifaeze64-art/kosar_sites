-- ============================================================
-- fix_new_account_employee_accounting.sql
-- رفع مشکلات پس از انتقال پروژه به اکانت جدید Supabase
--   • دلیل صفر بودن داشبورد حسابداری کارمندان: نبود policy آنون روی
--     جداول work_hours / employee_hourly_rates پس از انتقال داده‌ها.
--   • ستون monthly_charge (شارژ ماهانه) — در FINAL_FIX حذف شده بود.
--   • ستون category (نوع هدیه: مناسبتی/فرهنگی) در work_gifts.
--   • جداول work_gifts / work_deductions / work_settlements.
--
-- ⚠️ این اسکریپت را در اکانت Supabase جدید اجرا کن:
--    Dashboard → SQL Editor → New query → کل کد را Run کن.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ۱. work_hours — نوع ستون‌ها به TEXT (سازگار با idهای JS)
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.work_hours DROP CONSTRAINT IF EXISTS work_hours_employee_id_fkey;
ALTER TABLE public.work_hours DROP CONSTRAINT IF EXISTS work_hours_reviewed_by_fkey;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='work_hours'
          AND column_name='id' AND data_type='uuid'
    ) THEN
        ALTER TABLE public.work_hours ALTER COLUMN id DROP DEFAULT;
        ALTER TABLE public.work_hours ALTER COLUMN id TYPE TEXT USING id::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='work_hours'
          AND column_name='employee_id' AND data_type='uuid'
    ) THEN
        ALTER TABLE public.work_hours ALTER COLUMN employee_id TYPE TEXT USING employee_id::text;
    END IF;
END $$;

ALTER TABLE public.work_hours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wh_anon_all" ON public.work_hours;
CREATE POLICY "wh_anon_all"
    ON public.work_hours FOR ALL TO anon
    USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "wh_auth_all" ON public.work_hours;
CREATE POLICY "wh_auth_all"
    ON public.work_hours FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wh_employee ON public.work_hours (employee_id);
CREATE INDEX IF NOT EXISTS idx_wh_date     ON public.work_hours (date DESC);

-- ════════════════════════════════════════════════════════════
-- ۲. employee_hourly_rates — رساندن monthly_charge + TEXT + RLS
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
    IF to_regclass('public.employee_hourly_rates') IS NULL THEN
        CREATE TABLE public.employee_hourly_rates (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            employee_id    TEXT UNIQUE NOT NULL,
            hourly_rate    NUMERIC(12,2) NOT NULL DEFAULT 0,
            monthly_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
            currency       TEXT DEFAULT 'تومان',
            updated_at     TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- افزودن ستون شارژ ماهانه اگر جدول از قبل وجود دارد
ALTER TABLE public.employee_hourly_rates
    ADD COLUMN IF NOT EXISTS monthly_charge NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.employee_hourly_rates.monthly_charge IS
    'شارژ ماهانه ثابت کارمند (علاوه بر حقوق ساعتی)';

-- حذف FK و تبدیل employee_id به TEXT (سازگار با idهای رشته‌ای JS)
ALTER TABLE public.employee_hourly_rates
    DROP CONSTRAINT IF EXISTS employee_hourly_rates_employee_id_fkey;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='employee_hourly_rates'
          AND column_name='employee_id' AND data_type='uuid'
    ) THEN
        ALTER TABLE public.employee_hourly_rates
            ALTER COLUMN employee_id TYPE TEXT USING employee_id::text;
    END IF;
END $$;

ALTER TABLE public.employee_hourly_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ehr_anon_all" ON public.employee_hourly_rates;
CREATE POLICY "ehr_anon_all"
    ON public.employee_hourly_rates FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- جدول پشتیبان با کلید TEXT (اگر کد از آن استفاده کند)
CREATE TABLE IF NOT EXISTS public.employee_hourly_rates_ext (
    id             TEXT PRIMARY KEY,
    hourly_rate    NUMERIC(12,2) NOT NULL DEFAULT 0,
    monthly_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency       TEXT NOT NULL DEFAULT 'تومان',
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_hourly_rates_ext ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ehr_ext_anon_all" ON public.employee_hourly_rates_ext;
CREATE POLICY "ehr_ext_anon_all"
    ON public.employee_hourly_rates_ext FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- ۳. work_gifts — هدایا (با ستون category: مناسبتی/فرهنگی)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.work_gifts (
    id            TEXT PRIMARY KEY,
    employee_id   TEXT NOT NULL,
    employee_name TEXT,
    date          DATE NOT NULL,
    amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    category      TEXT DEFAULT 'مناسبتی',
    reason        TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- اگر جدول قبلاً ساخته شده بود، ستون category را اضافه کن
ALTER TABLE public.work_gifts
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'مناسبتی';

COMMENT ON COLUMN public.work_gifts.category IS
    'نوع هدیه: مناسبتی یا فرهنگی';

ALTER TABLE public.work_gifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gifts_anon_all" ON public.work_gifts;
CREATE POLICY "gifts_anon_all"
    ON public.work_gifts FOR ALL TO anon
    USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_gifts_employee ON public.work_gifts (employee_id);
CREATE INDEX IF NOT EXISTS idx_gifts_date     ON public.work_gifts (date DESC);

-- ════════════════════════════════════════════════════════════
-- ۴. work_deductions — کسورات
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.work_deductions (
    id            TEXT PRIMARY KEY,
    employee_id   TEXT NOT NULL,
    employee_name TEXT,
    date          DATE NOT NULL,
    amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    category      TEXT,
    reason        TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.work_deductions
    ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.work_deductions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deductions_anon_all" ON public.work_deductions;
CREATE POLICY "deductions_anon_all"
    ON public.work_deductions FOR ALL TO anon
    USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_deductions_employee ON public.work_deductions (employee_id);
CREATE INDEX IF NOT EXISTS idx_deductions_date     ON public.work_deductions (date DESC);

-- ════════════════════════════════════════════════════════════
-- ۵. work_settlements — تسویه‌حساب‌ها
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.work_settlements (
    id            TEXT PRIMARY KEY,
    employee_id   TEXT NOT NULL,
    employee_name TEXT,
    date          DATE NOT NULL,
    amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    note          TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.work_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settlements_anon_all" ON public.work_settlements;
CREATE POLICY "settlements_anon_all"
    ON public.work_settlements FOR ALL TO anon
    USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_settlements_employee ON public.work_settlements (employee_id);
CREATE INDEX IF NOT EXISTS idx_settlements_date     ON public.work_settlements (date DESC);

-- ════════════════════════════════════════════════════════════
-- ۶. work_late_requests — jalali_date + RLS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.work_late_requests
    ADD COLUMN IF NOT EXISTS jalali_date TEXT;

DO $$
BEGIN
    IF to_regclass('public.work_late_requests') IS NOT NULL THEN
        ALTER TABLE public.work_late_requests ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname='public' AND tablename='work_late_requests'
              AND policyname='lr_anon_all'
        ) THEN
            CREATE POLICY "lr_anon_all"
                ON public.work_late_requests FOR ALL TO anon
                USING (true) WITH CHECK (true);
        END IF;
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- ۷. profiles — دسترسی anon (برای نام کارمندان)
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "profiles_full_access" ON public.profiles;
CREATE POLICY "profiles_full_access"
    ON public.profiles FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- ۸. تأیید نهایی — این اعداد باید بزرگ‌تر از صفر باشند
-- ════════════════════════════════════════════════════════════
SELECT
    (SELECT count(*)::int FROM public.work_hours)                   AS work_hours_rows,
    (SELECT count(*)::int FROM public.employee_hourly_rates)        AS rates_rows,
    (SELECT count(*)::int FROM public.work_gifts)                   AS gifts_rows,
    (SELECT count(*)::int FROM public.work_deductions)              AS deductions_rows,
    (SELECT count(*)::int FROM public.work_settlements)             AS settlements_rows,
    (SELECT count(*)::int FROM pg_policies
      WHERE schemaname='public'
        AND tablename IN ('work_hours','employee_hourly_rates','work_gifts','work_deductions','work_settlements')
        AND policyname LIKE '%anon%')                               AS anon_policies,
    (SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_hourly_rates'
        AND column_name='monthly_charge')                           AS monthly_charge_col,
    (SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='work_gifts'
        AND column_name='category')                                 AS gift_category_col,
    'fix_new_account_employee_accounting OK ✓'                       AS status;
