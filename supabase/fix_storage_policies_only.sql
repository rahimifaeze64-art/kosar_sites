-- ============================================================
-- fix_storage_policies_only.sql
-- این SQL را فقط بعد از اینکه bucket را دستی ساختی اجرا کن
--
-- مراحل:
--   1. Supabase Dashboard → Storage → New bucket
--      Name: student-documents
--      Public bucket: ON (تیک بزن)
--      → Create bucket
--
--   2. بعد این SQL را در SQL Editor اجرا کن
-- ============================================================

-- حذف policy های قدیمی (اگر وجود دارند)
DROP POLICY IF EXISTS "allow_anon_upload"          ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_read"   ON storage.objects;
DROP POLICY IF EXISTS "student_docs_anon_insert"   ON storage.objects;
DROP POLICY IF EXISTS "student_docs_anon_select"   ON storage.objects;
DROP POLICY IF EXISTS "student_docs_anon_update"   ON storage.objects;
DROP POLICY IF EXISTS "student_docs_anon_all"      ON storage.objects;
DROP POLICY IF EXISTS "student_docs_auth_all"      ON storage.objects;

-- Policy: هر کسی (anon) می‌تواند آپلود کند
CREATE POLICY "student_docs_anon_insert"
    ON storage.objects
    FOR INSERT TO anon
    WITH CHECK (bucket_id = 'student-documents');

-- Policy: هر کسی می‌تواند فایل‌ها را بخواند
CREATE POLICY "student_docs_anon_select"
    ON storage.objects
    FOR SELECT TO anon
    USING (bucket_id = 'student-documents');

-- Policy: authenticated دسترسی کامل
CREATE POLICY "student_docs_auth_all"
    ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'student-documents')
    WITH CHECK (bucket_id = 'student-documents');

-- ============================================================
-- تمام ✓
-- ============================================================
