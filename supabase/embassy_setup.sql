-- ============================================================
-- embassy_setup.sql  v2
-- در Supabase Dashboard → SQL Editor اجرا کن
-- ============================================================

-- ── ۱. جدول اصلی ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.embassy_records (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- اطلاعات پایه
    student_name         text        NOT NULL,
    work_type            text        NOT NULL,
    receive_date         date,
    send_method          text,
    send_date            date,
    -- اعلام وصول + تصویر
    acknowledgment       text,
    acknowledgment_imgs  text[]      DEFAULT '{}',
    -- تسویه (عدد مورد اتفاق / بیعانه / تسویه)
    settlement           text,
    -- کد سجاد
    sajad_code           text,
    -- دار الترجمه: تاریخ + توضیح + تصاویر
    translation_office   text,
    translation_date     date,
    translation_imgs     text[]      DEFAULT '{}',
    -- آپلود ۳گانه
    emp1_files           text[]      DEFAULT '{}',
    emp2_files           text[]      DEFAULT '{}',
    sajad_imgs           text[]      DEFAULT '{}',
    -- فایل‌های عمومی (legacy)
    file_paths           text[]      DEFAULT '{}',
    -- متادیتا
    created_by           text,
    created_by_name      text,
    created_at           timestamptz DEFAULT now(),
    updated_at           timestamptz DEFAULT now()
);

-- ── ۲. ایندکس‌ها ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_embassy_student    ON public.embassy_records (student_name);
CREATE INDEX IF NOT EXISTS idx_embassy_work_type  ON public.embassy_records (work_type);
CREATE INDEX IF NOT EXISTS idx_embassy_created    ON public.embassy_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_embassy_settlement ON public.embassy_records (settlement);
CREATE INDEX IF NOT EXISTS idx_embassy_sajad      ON public.embassy_records (sajad_code);

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
    ADD COLUMN IF NOT EXISTS acknowledgment_imgs text[]  DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS translation_date    date,
    ADD COLUMN IF NOT EXISTS translation_imgs    text[]  DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS emp1_files          text[]  DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS emp2_files          text[]  DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS sajad_imgs          text[]  DEFAULT '{}';

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
    ARRAY['image/jpeg','image/png','image/webp','application/pdf']
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
    'embassy_records table ready ✓' AS status,
    count(*) AS existing_records
FROM public.embassy_records;
