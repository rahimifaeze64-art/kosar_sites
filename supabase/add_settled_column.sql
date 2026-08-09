-- ============================================================
-- add_settled_column.sql
-- افزودن ستون تسویه شده به جدول حسابداری شخصی
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ستون is_settled: آیا این بدهکاری/بستانکاری تسویه شده؟
ALTER TABLE public.company_accounting
    ADD COLUMN IF NOT EXISTS is_settled  boolean     DEFAULT false;

-- تاریخ تسویه
ALTER TABLE public.company_accounting
    ADD COLUMN IF NOT EXISTS settled_at  timestamptz;

-- ایندکس برای فیلتر سریع
CREATE INDEX IF NOT EXISTS idx_ca_is_settled ON public.company_accounting (is_settled);

-- تأیید
SELECT
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'company_accounting'
  AND column_name IN ('is_settled', 'settled_at');
