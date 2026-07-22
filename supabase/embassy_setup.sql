-- ============================================================
-- embassy_setup.sql
-- در Supabase Dashboard → SQL Editor اجرا کن
-- ============================================================

-- ── ۱. جدول اصلی ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.embassy_records (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name        text        NOT NULL,
    work_type           text        NOT NULL,
    receive_date        date,
    send_method         text,
    send_date           date,
    acknowledgment      text,
    settlement          text,
    sajad_code          text,
    translation_office  text,
    file_paths          text[]      DEFAULT '{}',
    created_by          text,
    created_by_name     text,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- ── ۲. ایندکس‌ها ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_embassy_student   ON public.embassy_records (student_name);
CREATE INDEX IF NOT EXISTS idx_embassy_work_type ON public.embassy_records (work_type);
CREATE INDEX IF NOT EXISTS idx_embassy_created   ON public.embassy_records (created_at DESC);

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

-- ── ۴. فعال‌سازی RLS ─────────────────────────────────────────
ALTER TABLE public.embassy_records ENABLE ROW LEVEL SECURITY;

-- ── ۵. پالیسی‌های RLS ────────────────────────────────────────
-- خواندن: مدیر و کارمندان (anon چون سیستم token ندارد)
DROP POLICY IF EXISTS "embassy_select" ON public.embassy_records;
CREATE POLICY "embassy_select"
    ON public.embassy_records FOR SELECT
    TO anon
    USING (true);

-- ثبت: همه کاربران anon
DROP POLICY IF EXISTS "embassy_insert" ON public.embassy_records;
CREATE POLICY "embassy_insert"
    ON public.embassy_records FOR INSERT
    TO anon
    WITH CHECK (true);

-- ویرایش: همه کاربران anon
DROP POLICY IF EXISTS "embassy_update" ON public.embassy_records;
CREATE POLICY "embassy_update"
    ON public.embassy_records FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- حذف: همه کاربران anon
DROP POLICY IF EXISTS "embassy_delete" ON public.embassy_records;
CREATE POLICY "embassy_delete"
    ON public.embassy_records FOR DELETE
    TO anon
    USING (true);

-- ── ۶. Storage bucket برای فایل‌ها ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'embassy-files',
    'embassy-files',
    false,
    5242880,  -- 5 MB
    ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- پالیسی آپلود فایل
DROP POLICY IF EXISTS "embassy_files_insert" ON storage.objects;
CREATE POLICY "embassy_files_insert"
    ON storage.objects FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'embassy-files');

-- پالیسی خواندن فایل
DROP POLICY IF EXISTS "embassy_files_select" ON storage.objects;
CREATE POLICY "embassy_files_select"
    ON storage.objects FOR SELECT
    TO anon
    USING (bucket_id = 'embassy-files');

-- پالیسی حذف فایل
DROP POLICY IF EXISTS "embassy_files_delete" ON storage.objects;
CREATE POLICY "embassy_files_delete"
    ON storage.objects FOR DELETE
    TO anon
    USING (bucket_id = 'embassy-files');

-- ── تأیید ────────────────────────────────────────────────────
SELECT 'embassy_records table ready ✓' AS status;
