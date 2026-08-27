-- ============================================================
-- fix_storage_bucket.sql
-- مشکل: آپلود فایل با خطای 404 / ERR_HTTP2_PROTOCOL_ERROR
-- علت: bucket وجود ندارد یا policy anon تنظیم نشده
--
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================


-- ============================================================
-- 1. ساخت bucket (یا آپدیت اگر وجود دارد)
--    public = false → فایل‌ها مستقیم قابل دسترس نیستند
--    اما policy زیر به anon اجازه آپلود می‌دهد
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-documents',
    'student-documents',
    true,       -- public=true تا بدون signed URL هم بشه read کرد
    10485760,   -- 10MB
    NULL        -- NULL = همه نوع فایل مجاز است
) ON CONFLICT (id) DO UPDATE SET
    public             = true,
    file_size_limit    = 10485760,
    allowed_mime_types = NULL;


-- ============================================================
-- 2. حذف policy‌های قدیمی Storage
-- ============================================================
DROP POLICY IF EXISTS "allow_anon_upload"          ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_read"   ON storage.objects;
DROP POLICY IF EXISTS "student_docs_anon_insert"   ON storage.objects;
DROP POLICY IF EXISTS "student_docs_anon_select"   ON storage.objects;
DROP POLICY IF EXISTS "student_docs_anon_all"      ON storage.objects;
DROP POLICY IF EXISTS "student_docs_auth_all"      ON storage.objects;
DROP POLICY IF EXISTS "archive_anon_all"           ON storage.objects;


-- ============================================================
-- 3. Policy جدید: anon می‌تواند در bucket آپلود کند
-- ============================================================
CREATE POLICY "student_docs_anon_insert"
    ON storage.objects
    FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'student-documents');

-- ============================================================
-- 4. Policy: anon می‌تواند فایل‌ها را بخواند
-- ============================================================
CREATE POLICY "student_docs_anon_select"
    ON storage.objects
    FOR SELECT
    TO anon
    USING (bucket_id = 'student-documents');

-- ============================================================
-- 5. Policy: anon می‌تواند فایل‌ها را حذف/آپدیت کند (اختیاری)
-- ============================================================
CREATE POLICY "student_docs_anon_update"
    ON storage.objects
    FOR UPDATE
    TO anon
    USING (bucket_id = 'student-documents')
    WITH CHECK (bucket_id = 'student-documents');

-- ============================================================
-- 6. Policy: authenticated دسترسی کامل دارد
-- ============================================================
CREATE POLICY "student_docs_auth_all"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (bucket_id = 'student-documents')
    WITH CHECK (bucket_id = 'student-documents');

-- ============================================================
-- 7. Policy: archive-files هم برای anon (در صورت وجود)
-- ============================================================
DROP POLICY IF EXISTS "archive_anon_insert" ON storage.objects;
CREATE POLICY "archive_anon_insert"
    ON storage.objects
    FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'archive-files');

DROP POLICY IF EXISTS "archive_anon_select" ON storage.objects;
CREATE POLICY "archive_anon_select"
    ON storage.objects
    FOR SELECT
    TO anon
    USING (bucket_id = 'archive-files');


-- ============================================================
-- تمام ✓
-- بعد از اجرا فرم می‌تواند فایل آپلود کند
-- ============================================================
