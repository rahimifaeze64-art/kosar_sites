-- ============================================================
-- add_sajad_credentials.sql
-- اضافه کردن ایمیل و رمز عبور سجاد به جدول embassy_records
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.embassy_records
    ADD COLUMN IF NOT EXISTS sajad_email    text DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS sajad_password text DEFAULT NULL;

COMMENT ON COLUMN public.embassy_records.sajad_email    IS 'ایمیل حساب سجاد دانشجو';
COMMENT ON COLUMN public.embassy_records.sajad_password IS 'رمز عبور حساب سجاد دانشجو';

-- تأیید
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'embassy_records'
  AND table_schema = 'public'
  AND column_name IN ('sajad_code', 'sajad_email', 'sajad_password')
ORDER BY ordinal_position;
