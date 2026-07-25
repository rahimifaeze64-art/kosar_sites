-- ============================================================
-- embassy_setup.sql  v3
-- در Supabase Dashboard → SQL Editor اجرا کن
-- ============================================================

-- ── ۱. جدول اصلی ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.embassy_records (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- اطلاعات پایه
    student_name         text        NOT NULL,
    work_type            text        NOT NULL,
    phone                text,                        -- شماره تماس
    receive_date         date,
    send_method          text,
    send_date            date,
    -- وضعیت ارسال و دریافت
    send_status          text        DEFAULT 'ارسال نشده',  -- ارسال شده / ارسال نشده
    receive_status       text        DEFAULT 'نشده',        -- شده / نشده
    -- اعلام وصول + تصویر
    acknowledgment       text,
    acknowledgment_imgs  text[]      DEFAULT '{}',
    -- تسویه (۳ مرحله مستقل با مبلغ)
    settlement_agreed    numeric     DEFAULT 0,
    settlement_deposit   numeric     DEFAULT 0,
    settlement_final     numeric     DEFAULT 0,
    settlement           text        DEFAULT 'تومان',  -- واحد پولی
    -- وکالت‌نامه + تصویر
    vekalat              text        DEFAULT 'ندارد',  -- دارد / ندارد
    vekalat_imgs         text[]      DEFAULT '{}',
    -- کد سجاد + تصویر
    sajad_code           text,
    sajad_imgs           text[]      DEFAULT '{}',
    -- فایل‌های پیوست
    file_paths           text[]      DEFAULT '{}',
    -- متادیتا
    created_by           text,
    created_by_name      text,
    created_at           timestamptz DEFAULT now(),
    updated_at           timestamptz DEFAULT now()
);

-- ── ۲. ایندکس‌ها ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_embassy_student      ON public.embassy_records (student_name);
CREATE INDEX IF NOT EXISTS idx_embassy_work_type    ON public.embassy_records (work_type);
CREATE INDEX IF NOT EXISTS idx_embassy_created      ON public.embassy_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_embassy_send_status  ON public.embassy_records (send_status);
CREATE INDEX IF NOT EXISTS idx_embassy_recv_status  ON public.embassy_records (receive_status);
CREATE INDEX IF NOT EXISTS idx_embassy_sajad        ON public.embassy_records (sajad_code);

-- ── ۳. تریگر updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_embassy_updated_at ON public.embassy_records;
CREATE TRIGGER trg_embassy_updated_at
    BEFORE UPDATE ON public.embassy_records
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── ۴. Migration: اگر جدول قبلاً وجود داشت ستون‌های جدید اضافه کن ──
ALTER TABLE public.embassy_records
    -- فیلدهای جدید v3
    ADD COLUMN IF NOT EXISTS phone               text,
    ADD COLUMN IF NOT EXISTS send_status         text    DEFAULT 'ارسال نشده',
    ADD COLUMN IF NOT EXISTS receive_status      text    DEFAULT 'نشده',
    ADD COLUMN IF NOT EXISTS vekalat_imgs        text[]  DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS sajad_imgs          text[]  DEFAULT '{}',
    -- فیلدهای قبلی (برای سازگاری)
    ADD COLUMN IF NOT EXISTS acknowledgment_imgs text[]  DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS settlement_agreed   numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS settlement_deposit  numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS settlement_final    numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS settlement          text    DEFAULT 'تومان',
    ADD COLUMN IF NOT EXISTS vekalat             text    DEFAULT 'ندارد',
    ADD COLUMN IF NOT EXISTS file_paths          text[]  DEFAULT '{}';

-- آپدیت مقدار پیش‌فرض برای ردیف‌های قبلی که NULL دارند
UPDATE public.embassy_records
SET
    send_status    = 'ارسال نشده' WHERE send_status    IS NULL;
UPDATE public.embassy_records
SET
    receive_status = 'نشده'       WHERE receive_status IS NULL;

-- ── ۵. فعال‌سازی RLS ─────────────────────────────────────────
ALTER TABLE public.embassy_records ENABLE ROW LEVEL SECURITY;

-- ── ۶. پالیسی‌های RLS ────────────────────────────────────────
DROP POLICY IF EXISTS "embassy_select" ON public.embassy_records;
CREATE POLICY "embassy_select"
    ON public.embassy_records FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "embassy_insert" ON public.embassy_records;
CREATE POLICY "embassy_insert"
    ON public.embassy_records FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "embassy_update" ON public.embassy_records;
CREATE POLICY "embassy_update"
    ON public.embassy_records FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "embassy_delete" ON public.embassy_records;
CREATE POLICY "embassy_delete"
    ON public.embassy_records FOR DELETE TO anon USING (true);

-- ── ۷. Storage bucket ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'embassy-files', 'embassy-files', false, 10485760,
    ARRAY['image/jpeg','image/png','image/webp','application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 10485760;

DROP POLICY IF EXISTS "embassy_files_insert" ON storage.objects;
CREATE POLICY "embassy_files_insert"
    ON storage.objects FOR INSERT TO anon
    WITH CHECK (bucket_id = 'embassy-files');

DROP POLICY IF EXISTS "embassy_files_select" ON storage.objects;
CREATE POLICY "embassy_files_select"
    ON storage.objects FOR SELECT TO anon
    USING (bucket_id = 'embassy-files');

DROP POLICY IF EXISTS "embassy_files_delete" ON storage.objects;
CREATE POLICY "embassy_files_delete"
    ON storage.objects FOR DELETE TO anon
    USING (bucket_id = 'embassy-files');

-- ── تأیید ────────────────────────────────────────────────────
SELECT
    'embassy_records table ready ✓  (v3)' AS status,
    count(*) AS existing_records
FROM public.embassy_records;
