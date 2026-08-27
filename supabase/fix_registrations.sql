-- ============================================================
-- fix_registrations.sql
-- مشکلات شناسایی‌شده:
--   1. جدول student_registrations شاید وجود نداشته باشد
--   2. status فقط pending/reviewed/accepted/rejected می‌پذیرد
--      اما پنل داخلی: new/result/registered/cancelled می‌فرستد
--   3. RLS فقط به authenticated اجازه SELECT/UPDATE می‌دهد
--      ولی پنل با anon key کار می‌کند (بدون Supabase Auth)
--   4. Storage bucket شاید policy کافی نداشته باشد
--
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================


-- ============================================================
-- 1. ایجاد جدول (اگر وجود ندارد)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_registrations (
    id                      BIGSERIAL PRIMARY KEY,
    registration_id         TEXT UNIQUE NOT NULL,

    middle_name             TEXT NOT NULL,
    last_name               TEXT NOT NULL,
    religion                TEXT NOT NULL,
    phone                   TEXT NOT NULL,
    email                   TEXT NOT NULL,
    address_iraq            TEXT NOT NULL,
    job                     TEXT NOT NULL,
    marital_status          TEXT NOT NULL,
    children_count          INTEGER,

    university_type         TEXT NOT NULL,
    degree                  TEXT NOT NULL,
    major                   TEXT NOT NULL,
    previous_university     TEXT NOT NULL,
    master_university       TEXT,
    bachelor_gpa            TEXT NOT NULL,
    master_gpa              TEXT,

    passport_url            TEXT,
    personal_photo_url      TEXT,
    transcript_url          TEXT,
    master_transcript_url   TEXT,
    master_certificate_url  TEXT,

    status                  TEXT DEFAULT 'new',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 2. اصلاح CHECK constraint روی status
--    (مقادیر قدیمی pending/reviewed/accepted/rejected حذف)
--    (مقادیر جدید new/result/registered/cancelled اضافه)
-- ============================================================
ALTER TABLE public.student_registrations
    DROP CONSTRAINT IF EXISTS student_registrations_status_check;

ALTER TABLE public.student_registrations
    ADD CONSTRAINT student_registrations_status_check
    CHECK (status IN ('new', 'result', 'registered', 'cancelled', 'pending', 'reviewed', 'accepted', 'rejected'));

-- مقادیر قدیمی pending را به new تبدیل کن
UPDATE public.student_registrations
    SET status = 'new'
    WHERE status = 'pending';


-- ============================================================
-- 3. اصلاح CHECK constraint روی marital_status
--    (هر دو فرمت عربی و فارسی را قبول کن)
-- ============================================================
ALTER TABLE public.student_registrations
    DROP CONSTRAINT IF EXISTS student_registrations_marital_status_check;


-- ============================================================
-- 4. اصلاح CHECK constraint روی university_type
-- ============================================================
ALTER TABLE public.student_registrations
    DROP CONSTRAINT IF EXISTS student_registrations_university_type_check;


-- ============================================================
-- 5. اصلاح CHECK constraint روی degree
-- ============================================================
ALTER TABLE public.student_registrations
    DROP CONSTRAINT IF EXISTS student_registrations_degree_check;


-- ============================================================
-- 6. RLS — دسترسی کامل برای anon
--    (پنل داخلی با anon key کار می‌کند، نه Supabase Auth)
-- ============================================================
ALTER TABLE public.student_registrations ENABLE ROW LEVEL SECURITY;

-- حذف policy‌های قدیمی
DROP POLICY IF EXISTS "allow_public_insert"          ON public.student_registrations;
DROP POLICY IF EXISTS "allow_authenticated_select"   ON public.student_registrations;
DROP POLICY IF EXISTS "allow_authenticated_update"   ON public.student_registrations;
DROP POLICY IF EXISTS "allow_authenticated_delete"   ON public.student_registrations;
DROP POLICY IF EXISTS "registrations_anon_all"       ON public.student_registrations;

-- policy جدید: anon دسترسی کامل دارد
CREATE POLICY "registrations_anon_all"
    ON public.student_registrations
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- authenticated هم دسترسی کامل دارد
CREATE POLICY "registrations_auth_all"
    ON public.student_registrations
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);


-- ============================================================
-- 7. تابع و trigger برای auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.student_registrations;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.student_registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- 8. ایجاد Storage bucket (اگر وجود ندارد)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-documents',
    'student-documents',
    false,
    5242880,   -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
) ON CONFLICT (id) DO UPDATE SET
    file_size_limit    = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];


-- ============================================================
-- 9. Storage policies — anon می‌تواند آپلود و دانلود کند
-- ============================================================
DROP POLICY IF EXISTS "allow_anon_upload"        ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_read"  ON storage.objects;
DROP POLICY IF EXISTS "student_docs_anon_insert"  ON storage.objects;
DROP POLICY IF EXISTS "student_docs_anon_select"  ON storage.objects;
DROP POLICY IF EXISTS "student_docs_anon_all"     ON storage.objects;

-- آپلود برای anon (فرم عمومی)
CREATE POLICY "student_docs_anon_insert"
    ON storage.objects
    FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'student-documents');

-- خواندن/دانلود برای anon (پنل داخلی)
CREATE POLICY "student_docs_anon_select"
    ON storage.objects
    FOR SELECT
    TO anon
    USING (bucket_id = 'student-documents');

-- دسترسی کامل برای authenticated (ادمین)
CREATE POLICY "student_docs_auth_all"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (bucket_id = 'student-documents')
    WITH CHECK (bucket_id = 'student-documents');


-- ============================================================
-- 10. INDEX‌ها
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_student_reg_email      ON public.student_registrations(email);
CREATE INDEX IF NOT EXISTS idx_student_reg_phone      ON public.student_registrations(phone);
CREATE INDEX IF NOT EXISTS idx_student_reg_degree     ON public.student_registrations(degree);
CREATE INDEX IF NOT EXISTS idx_student_reg_status     ON public.student_registrations(status);
CREATE INDEX IF NOT EXISTS idx_student_reg_created_at ON public.student_registrations(created_at DESC);


-- ============================================================
-- 11. VIEW برای پنل ادمین
-- ============================================================
CREATE OR REPLACE VIEW public.admin_registrations AS
SELECT
    id,
    registration_id,
    middle_name || ' ' || last_name                              AS full_name,
    CASE degree WHEN 'master' THEN 'ماجستير' ELSE 'دكتوراه' END AS degree_label,
    university_type,
    major,
    phone,
    email,
    address_iraq,
    job,
    marital_status,
    bachelor_gpa,
    status,
    passport_url,
    personal_photo_url,
    transcript_url,
    created_at::DATE AS registration_date
FROM public.student_registrations
ORDER BY created_at DESC;


-- ============================================================
-- تمام ✓
-- بعد از اجرا:
--   - فرم ثبت‌نام می‌تواند INSERT کند
--   - پنل داخلی می‌تواند SELECT و UPDATE کند
--   - فایل‌ها آپلود و دانلود می‌شوند
--   - status های جدید (new/result/registered/cancelled) قبول می‌شوند
-- ============================================================
