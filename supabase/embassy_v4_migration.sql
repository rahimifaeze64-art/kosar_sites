-- ============================================================
-- embassy_v4_migration.sql
-- migration کامل: فیلدهای تسویه چندمرحله‌ای + activity log
-- در Supabase Dashboard → SQL Editor اجرا کن
-- ============================================================

-- ── ۱. فیلدهای تسویه چندمرحله‌ای (JSONB array) ──────────────
ALTER TABLE public.embassy_records
    -- لیست پرداخت‌های مرحله‌ای هر بخش → [{amount: 1000, currency: "تومان"}, ...]
    ADD COLUMN IF NOT EXISTS settlement_agreed_list  jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS settlement_deposit_list jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS settlement_final_list   jsonb DEFAULT '[]'::jsonb;

-- ── ۲. فیلدهای ردیابی فعالیت ────────────────────────────────
ALTER TABLE public.embassy_records
    ADD COLUMN IF NOT EXISTS updated_by       text,
    ADD COLUMN IF NOT EXISTS updated_by_name  text,
    ADD COLUMN IF NOT EXISTS last_action      text;

-- ── ۳. مهاجرت داده‌های قدیمی به فرمت جدید ──────────────────
-- رکوردهایی که settlement_agreed داشتن ولی لیست ندارن
UPDATE public.embassy_records
SET settlement_agreed_list = jsonb_build_array(
    jsonb_build_object('amount', settlement_agreed, 'currency', COALESCE(settlement, 'تومان'))
)
WHERE settlement_agreed > 0
  AND (settlement_agreed_list IS NULL OR settlement_agreed_list = '[]'::jsonb);

UPDATE public.embassy_records
SET settlement_deposit_list = jsonb_build_array(
    jsonb_build_object('amount', settlement_deposit, 'currency', COALESCE(settlement, 'تومان'))
)
WHERE settlement_deposit > 0
  AND (settlement_deposit_list IS NULL OR settlement_deposit_list = '[]'::jsonb);

UPDATE public.embassy_records
SET settlement_final_list = jsonb_build_array(
    jsonb_build_object('amount', settlement_final, 'currency', COALESCE(settlement, 'تومان'))
)
WHERE settlement_final > 0
  AND (settlement_final_list IS NULL OR settlement_final_list = '[]'::jsonb);

-- ── ۴. جدول لاگ فعالیت ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.embassy_activity_log (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id     uuid        NOT NULL REFERENCES public.embassy_records(id) ON DELETE CASCADE,
    user_id       text,
    user_name     text,
    action        text        NOT NULL,
    action_label  text,
    changed_fields text[],
    created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emb_act_record
    ON public.embassy_activity_log (record_id, created_at DESC);

-- ── ۵. RLS برای جدول لاگ ────────────────────────────────────
ALTER TABLE public.embassy_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embassy_activity_all" ON public.embassy_activity_log;
CREATE POLICY "embassy_activity_all"
    ON public.embassy_activity_log FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- ── ۶. تأیید ─────────────────────────────────────────────────
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name   = 'embassy_records'
  AND table_schema = 'public'
ORDER BY ordinal_position;
