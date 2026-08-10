-- ============================================================
-- door_logs_migration.sql
-- جدول تاریخچه باز/بسته شدن در شرکت
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.door_logs (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    action      text        NOT NULL CHECK (action IN ('open', 'close')),
    user_name   text        NOT NULL DEFAULT 'نامشخص',
    user_role   text,
    created_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE public.door_logs IS 'تاریخچه باز و بسته شدن در شرکت';

-- ایندکس برای مرتب‌سازی سریع
CREATE INDEX IF NOT EXISTS idx_door_logs_created ON public.door_logs (created_at DESC);

-- RLS
ALTER TABLE public.door_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "door_logs_anon" ON public.door_logs;
CREATE POLICY "door_logs_anon"
    ON public.door_logs FOR ALL TO anon
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "door_logs_auth" ON public.door_logs;
CREATE POLICY "door_logs_auth"
    ON public.door_logs FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- تأیید
SELECT 'door_logs table created ✓' AS status;
