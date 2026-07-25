-- ============================================================
-- embassy_migration_v3.sql
-- فقط این فایل رو در Supabase SQL Editor اجرا کن
-- برای اضافه کردن ستون‌های جدید به جدول موجود
-- ============================================================

ALTER TABLE public.embassy_records
    ADD COLUMN IF NOT EXISTS phone               text,
    ADD COLUMN IF NOT EXISTS send_status         text    DEFAULT 'ارسال نشده',
    ADD COLUMN IF NOT EXISTS receive_status      text    DEFAULT 'نشده',
    ADD COLUMN IF NOT EXISTS vekalat_imgs        text[]  DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS sajad_imgs          text[]  DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS acknowledgment_imgs text[]  DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS settlement_agreed   numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS settlement_deposit  numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS settlement_final    numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS settlement          text    DEFAULT 'تومان',
    ADD COLUMN IF NOT EXISTS vekalat             text    DEFAULT 'ندارد',
    ADD COLUMN IF NOT EXISTS file_paths          text[]  DEFAULT '{}';

-- مقداردهی پیش‌فرض به ردیف‌های قبلی
UPDATE public.embassy_records SET send_status    = 'ارسال نشده' WHERE send_status    IS NULL;
UPDATE public.embassy_records SET receive_status = 'نشده'       WHERE receive_status IS NULL;

-- تأیید
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'embassy_records'
  AND table_schema = 'public'
ORDER BY ordinal_position;
