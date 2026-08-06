-- ============================================================
-- student_documents_migration.sql
-- ایجاد جدول مدارک دانشجویان + Storage bucket
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ۱. جدول student_documents
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.student_documents (
    id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id      TEXT        NOT NULL,   -- همان id در profiles
    -- فیلدهای مدارک (path در storage bucket)
    admin_order_image   TEXT,   -- تصویر امر اداری
    savorg_code         TEXT,   -- کد رهگیری سائورگ
    sajad_result        TEXT,   -- نتیجه سامانه سجاد
    similarity_cert     TEXT,   -- گواهی همانند جویی
    passport_image      TEXT,   -- تصویر پاسپورت
    typesetting_doc     TEXT,   -- تنضید
    binding_doc         TEXT,   -- تجلید
    estelal_doc         TEXT,   -- استلال
    language_cert       TEXT,   -- مدرک لغت
    language_upload     TEXT,   -- بارگزاری لغت
    azfa_doc            TEXT,   -- آزفا
    tasdiq_doc          TEXT,   -- تصدیق
    vasiqe_doc          TEXT,   -- وثیقه
    irandoc_khate       TEXT,   -- ایران داک خطه
    -- متادیتا
    updated_by      TEXT,
    updated_by_name TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (student_id)
);

-- ════════════════════════════════════════════════════════════
-- ۲. تریگر updated_at
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_student_docs_updated_at ON public.student_documents;
CREATE TRIGGER trg_student_docs_updated_at
    BEFORE UPDATE ON public.student_documents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════
-- ۳. ایندکس
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_student_docs_student_id
    ON public.student_documents (student_id);

-- ════════════════════════════════════════════════════════════
-- ۴. RLS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_docs_select" ON public.student_documents;
CREATE POLICY "student_docs_select"
    ON public.student_documents FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "student_docs_insert" ON public.student_documents;
CREATE POLICY "student_docs_insert"
    ON public.student_documents FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "student_docs_update" ON public.student_documents;
CREATE POLICY "student_docs_update"
    ON public.student_documents FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "student_docs_delete" ON public.student_documents;
CREATE POLICY "student_docs_delete"
    ON public.student_documents FOR DELETE TO anon USING (true);

-- ════════════════════════════════════════════════════════════
-- ۵. Storage bucket: student-documents
-- ════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-documents',
    'student-documents',
    false,
    10485760,  -- 10 MB
    ARRAY[
        'image/jpeg','image/png','image/webp','image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 10485760;

-- Storage RLS
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
    'student_documents table + storage bucket ready ✓' AS status,
    count(*) AS existing_records
FROM public.student_documents;
