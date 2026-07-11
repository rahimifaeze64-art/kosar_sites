-- ============================================================
-- Migration: افزودن ستون‌های آرشیو عمومی به جدول archived_files
-- این اسکریپت را در: Supabase Dashboard > SQL Editor اجرا کن
-- ============================================================

-- ۱. افزودن ستون‌های جدید (اگر وجود ندارند)
ALTER TABLE public.archived_files
    ADD COLUMN IF NOT EXISTS category    TEXT,          -- دسته‌بندی: form1, thesis-original, ...
    ADD COLUMN IF NOT EXISTS author      TEXT,          -- نام آپلودکننده (نمایشی)
    ADD COLUMN IF NOT EXISTS file_type   TEXT,          -- پسوند: pdf, docx, ...
    ADD COLUMN IF NOT EXISTS display_url TEXT,          -- URL نمایش/دانلود (Storage public URL)
    ADD COLUMN IF NOT EXISTS file_size_text TEXT;       -- حجم خوانا: "2.5 MB"

-- ۲. index برای جستجو سریع بر اساس category
CREATE INDEX IF NOT EXISTS idx_archived_files_category
    ON public.archived_files(category);

-- ۳. Storage bucket برای فایل‌های آرشیو
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'archive-files',
    'archive-files',
    true,           -- public bucket — لینک مستقیم دسترسی دارند
    52428800,       -- 50MB حداکثر
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'text/plain',
        'application/zip',
        'application/x-rar-compressed'
    ]
) ON CONFLICT (id) DO NOTHING;

-- ۴. Storage Policies — آپلود برای authenticated، خواندن public
DROP POLICY IF EXISTS "archive_upload_authenticated" ON storage.objects;
CREATE POLICY "archive_upload_authenticated"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'archive-files');

DROP POLICY IF EXISTS "archive_read_public" ON storage.objects;
CREATE POLICY "archive_read_public"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'archive-files');

DROP POLICY IF EXISTS "archive_delete_manager" ON storage.objects;
CREATE POLICY "archive_delete_manager"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'archive-files' AND public.get_user_role() = 'manager');

-- تمام ✓
