-- ============================================================
-- work_late_requests_migration.sql  (v2 — fixed UUID cast)
-- جدول درخواست‌های مهلت مجدد کارمندان
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── ۱. جدول ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_late_requests (
    id              text        PRIMARY KEY DEFAULT ('lr_' || extract(epoch from now())::bigint::text),
    employee_id     text        NOT NULL,
    employee_name   text,
    requested_date  text        NOT NULL,   -- YYYY-MM-DD ذخیره می‌شود
    entry_type      text        NOT NULL,   -- 'work' | 'expense'
    start_time      text,
    end_time        text,
    amount          numeric     DEFAULT 0,
    reason          text        NOT NULL DEFAULT '',
    status          text        NOT NULL DEFAULT 'pending',
    reviewed_by     text,
    reviewed_at     timestamptz,
    created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE public.work_late_requests IS
    'درخواست کارمندان برای ثبت سوابق کاری فراموش‌شده';

-- ── ۲. ایندکس‌ها ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lr_employee      ON public.work_late_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_lr_status        ON public.work_late_requests (status);
CREATE INDEX IF NOT EXISTS idx_lr_created_at    ON public.work_late_requests (created_at DESC);

-- ── ۳. RLS ────────────────────────────────────────────────────
ALTER TABLE public.work_late_requests ENABLE ROW LEVEL SECURITY;

-- anon: دسترسی کامل (سیستم بدون auth کار می‌کند)
DROP POLICY IF EXISTS "lr_anon_all" ON public.work_late_requests;
CREATE POLICY "lr_anon_all"
    ON public.work_late_requests
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- authenticated: دسترسی کامل
DROP POLICY IF EXISTS "lr_auth_all" ON public.work_late_requests;
CREATE POLICY "lr_auth_all"
    ON public.work_late_requests
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- ── ۴. تأیید ──────────────────────────────────────────────────
SELECT
    (SELECT count(*) FROM public.work_late_requests) AS count,
    'work_late_requests OK' AS status;
