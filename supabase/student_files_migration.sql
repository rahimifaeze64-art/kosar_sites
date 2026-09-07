-- ============================================================
-- student_files_migration.sql
-- جدول «فایل ها» برای بخش ویرایش پروفایل دانشجو
-- (دسته‌بندی فایل‌ها: اولیه، تعدیل شده، تنضیدها، مقاله، استماره، پاسپورت، ...)
--
-- ⚠️ نکته: این جدول با جدول‌های «بایگانی» (archived_files) و «مدارک»
--   (student_documents) متفاوت است:
--   - archived_files    → بایگانی عمومی فایل‌های دریافتی از نویسندگان
--   - student_documents → مدارک و تصاویر ثابت پروفایل (یک رکورد per دانشجو)
--   - student_files     → فایل‌های دسته‌بندی‌شده per دانشجو (یک رکورد per دسته)
--
-- اجرا در: Supabase Dashboard → SQL Editor
-- ایمن برای اجرای مجدد (idempotent)
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ۱. جدول student_files
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.student_files (
    id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id       TEXT        NOT NULL,   -- همان id در profiles
    category         TEXT        NOT NULL,   -- دسته: اولیه، تعدیل شده، تنضید قبل دفاع، ...، مقاله، استماره 1، استماره 2، پاسپورت، مباشره و قبول، سایر
    file_name        TEXT,                   -- نام اصلی فایل
    file_path        TEXT,                   -- path در Storage bucket
    display_url      TEXT,                   -- URL نمایش/دانلود
    file_type        TEXT,                   -- پسوند: pdf, jpg, ...
    file_size_text   TEXT,                   -- حجم خوانا (اختیاری)
    uploaded_by      TEXT,
    uploaded_by_name TEXT,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE (student_id, category)
);

-- ════════════════════════════════════════════════════════════
-- ۲. تریگر updated_at (از تابع مشترک موجود استفاده می‌کند)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_student_files_updated_at ON public.student_files;
CREATE TRIGGER trg_student_files_updated_at
    BEFORE UPDATE ON public.student_files
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════
-- ۳. ایندکس‌ها
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_student_files_student_id
    ON public.student_files (student_id);

CREATE INDEX IF NOT EXISTS idx_student_files_category
    ON public.student_files (category);

-- ════════════════════════════════════════════════════════════
-- ۴. RLS — همسو با student_documents (سیستم با anon key کار می‌کند)
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.student_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_files_select" ON public.student_files;
CREATE POLICY "student_files_select"
    ON public.student_files FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "student_files_insert" ON public.student_files;
CREATE POLICY "student_files_insert"
    ON public.student_files FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "student_files_update" ON public.student_files;
CREATE POLICY "student_files_update"
    ON public.student_files FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "student_files_delete" ON public.student_files;
CREATE POLICY "student_files_delete"
    ON public.student_files FOR DELETE TO anon USING (true);

-- ════════════════════════════════════════════════════════════
-- ۵. Storage bucket — از bucket مشترک student-documents استفاده می‌شود
--    (اگر bucket وجود ندارد ایجاد می‌شود)
-- ════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-documents',
    'student-documents',
    false,
    52428800,  -- 50 MB (فایل‌های مقاله و استماره می‌توانند حجیم باشند)
    ARRAY[
        'image/jpeg','image/png','image/webp','image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 52428800;

-- Storage RLS — اگر از قبل نبود
DROP POLICY IF EXISTS "student_docs_storage_insert" ON storage.objects;
CREATE POLICY "student_docs_storage_insert"
    ON storage.objects FOR INSERT TO anon
    WITH CHECK (bucket_id = 'student-documents');

DROP POLICY IF EXISTS "student_docs_storage_select" ON storage.objects;
CREATE POLICY "student_docs_storage_select"
    ON storage.objects FOR SELECT TO anon
    USING (bucket_id = 'student-documents');

DROP POLICY IF EXISTS "student_docs_storage_update" ON storage.objects;
CREATE POLICY "student_docs_storage_update"
    ON storage.objects FOR UPDATE TO anon
    USING (bucket_id = 'student-documents');

DROP POLICY IF EXISTS "student_docs_storage_delete" ON storage.objects;
CREATE POLICY "student_docs_storage_delete"
    ON storage.objects FOR DELETE TO anon
    USING (bucket_id = 'student-documents');

-- ════════════════════════════════════════════════════════════
-- ۶. تأیید
-- ════════════════════════════════════════════════════════════
SELECT
    'student_files table ready ✓' AS status,
    count(*) AS existing_records
FROM public.student_files;