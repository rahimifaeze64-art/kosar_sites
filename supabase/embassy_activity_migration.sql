-- ============================================================
-- embassy_activity_migration.sql
-- اضافه کردن ستون‌های ردیابی فعالیت به جدول embassy_records
-- ============================================================

-- ستون آخرین ویرایشگر
ALTER TABLE public.embassy_records
    ADD COLUMN IF NOT EXISTS updated_by       text,
    ADD COLUMN IF NOT EXISTS updated_by_name  text,
    ADD COLUMN IF NOT EXISTS last_action      text;  -- توضیح آخرین اکشن

-- جدول لاگ فعالیت‌ها برای هر رکورد
CREATE TABLE IF NOT EXISTS public.embassy_activity_log (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id     uuid        NOT NULL REFERENCES public.embassy_records(id) ON DELETE CASCADE,
    user_id       text,
    user_name     text,
    action        text        NOT NULL,   -- 'create' | 'update' | 'file_upload' | ...
    action_label  text,                   -- توضیح فارسی: 'ثبت رکورد' | 'بارگزاری فایل' | ...
    changed_fields text[],               -- فیلدهایی که تغییر کردن
    created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emb_act_record ON public.embassy_activity_log (record_id, created_at DESC);

-- RLS
ALTER TABLE public.embassy_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embassy_activity_read" ON public.embassy_activity_log;
CREATE POLICY "embassy_activity_read"
    ON public.embassy_activity_log FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "embassy_activity_insert" ON public.embassy_activity_log;
CREATE POLICY "embassy_activity_insert"
    ON public.embassy_activity_log FOR INSERT
    WITH CHECK (true);
