-- ============================================================
-- employee_accounting_migration.sql
-- جداول جدید: هدایا، کسورات و تسویه‌حساب کارمندان
-- در Supabase Dashboard → SQL Editor اجرا کن
-- ============================================================

-- ── ۱. جدول هدایا (work_gifts) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_gifts (
    id              text        PRIMARY KEY DEFAULT ('gift_' || extract(epoch from now())::bigint::text),
    employee_id     text        NOT NULL,
    employee_name   text,
    date            date        NOT NULL,
    amount          numeric     NOT NULL DEFAULT 0,
    reason          text,
    created_at      timestamptz DEFAULT now()
);

-- ── ۲. جدول کسورات (work_deductions) ────────────────────────
CREATE TABLE IF NOT EXISTS public.work_deductions (
    id              text        PRIMARY KEY DEFAULT ('ded_' || extract(epoch from now())::bigint::text),
    employee_id     text        NOT NULL,
    employee_name   text,
    date            date        NOT NULL,
    amount          numeric     NOT NULL DEFAULT 0,
    reason          text,
    created_at      timestamptz DEFAULT now()
);

-- ── ۳. جدول تسویه‌حساب‌ها (work_settlements) ─────────────────
CREATE TABLE IF NOT EXISTS public.work_settlements (
    id              text        PRIMARY KEY DEFAULT ('settle_' || extract(epoch from now())::bigint::text),
    employee_id     text        NOT NULL,
    employee_name   text,
    date            date        NOT NULL,
    amount          numeric     NOT NULL DEFAULT 0,
    note            text,
    created_at      timestamptz DEFAULT now()
);

-- ── ۴. ایندکس‌ها ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gifts_employee      ON public.work_gifts (employee_id);
CREATE INDEX IF NOT EXISTS idx_gifts_date          ON public.work_gifts (date DESC);
CREATE INDEX IF NOT EXISTS idx_deductions_employee ON public.work_deductions (employee_id);
CREATE INDEX IF NOT EXISTS idx_deductions_date     ON public.work_deductions (date DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_employee ON public.work_settlements (employee_id);
CREATE INDEX IF NOT EXISTS idx_settlements_date    ON public.work_settlements (date DESC);

-- ── ۵. RLS ───────────────────────────────────────────────────
ALTER TABLE public.work_gifts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_deductions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_settlements ENABLE ROW LEVEL SECURITY;

-- هدایا
DROP POLICY IF EXISTS "gifts_select" ON public.work_gifts;
CREATE POLICY "gifts_select" ON public.work_gifts FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "gifts_insert" ON public.work_gifts;
CREATE POLICY "gifts_insert" ON public.work_gifts FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "gifts_delete" ON public.work_gifts;
CREATE POLICY "gifts_delete" ON public.work_gifts FOR DELETE TO anon USING (true);

-- کسورات
DROP POLICY IF EXISTS "deductions_select" ON public.work_deductions;
CREATE POLICY "deductions_select" ON public.work_deductions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "deductions_insert" ON public.work_deductions;
CREATE POLICY "deductions_insert" ON public.work_deductions FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "deductions_delete" ON public.work_deductions;
CREATE POLICY "deductions_delete" ON public.work_deductions FOR DELETE TO anon USING (true);

-- تسویه‌حساب
DROP POLICY IF EXISTS "settlements_select" ON public.work_settlements;
CREATE POLICY "settlements_select" ON public.work_settlements FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "settlements_insert" ON public.work_settlements;
CREATE POLICY "settlements_insert" ON public.work_settlements FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "settlements_delete" ON public.work_settlements;
CREATE POLICY "settlements_delete" ON public.work_settlements FOR DELETE TO anon USING (true);

-- ── ۶. تأیید ─────────────────────────────────────────────────
SELECT
    (SELECT count(*) FROM public.work_gifts)       AS gifts_count,
    (SELECT count(*) FROM public.work_deductions)  AS deductions_count,
    (SELECT count(*) FROM public.work_settlements) AS settlements_count,
    'tables created ✓' AS status;
