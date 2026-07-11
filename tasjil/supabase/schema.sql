-- ============================================================
-- KOSAR SITE - Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1. TABLE: student_registrations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_registrations (
    id                      BIGSERIAL PRIMARY KEY,
    registration_id         TEXT UNIQUE NOT NULL,           -- مثل REG-20240101123456

    -- اطلاعات شخصی
    middle_name             TEXT NOT NULL,                  -- الاسم الثلاثي
    last_name               TEXT NOT NULL,                  -- لقب العائلة
    religion                TEXT NOT NULL,                  -- الديانة
    phone                   TEXT NOT NULL,                  -- رقم الهاتف
    email                   TEXT NOT NULL,                  -- البريد الإلكتروني
    address_iraq            TEXT NOT NULL,                  -- العنوان في العراق
    job                     TEXT NOT NULL,                  -- الوظيفة
    marital_status          TEXT NOT NULL CHECK (marital_status IN ('أعزب', 'متزوج')),
    children_count          INTEGER,                        -- عدد الأطفال (اختیاری)

    -- اطلاعات دانشگاهی
    university_type         TEXT NOT NULL CHECK (university_type IN ('نفقة خاصة', 'ابتعاث')),
    degree                  TEXT NOT NULL CHECK (degree IN ('master', 'phd')),
    major                   TEXT NOT NULL,                  -- التخصص
    previous_university     TEXT NOT NULL,                  -- الجامعة السابقة (بكالوريوس)
    master_university       TEXT,                           -- جامعة الماجستير (للدكتوراه فقط)
    bachelor_gpa            TEXT NOT NULL,                  -- معدل البكالوريوس
    master_gpa              TEXT,                           -- معدل الماجستير (للدكتوراه فقط)

    -- لینک فایل‌ها در Supabase Storage
    passport_url            TEXT,                           -- صورة جواز السفر
    personal_photo_url      TEXT,                           -- صورة الشخصية
    transcript_url          TEXT,                           -- كشف البكالوريوس
    master_transcript_url   TEXT,                           -- كشف الماجستير
    master_certificate_url  TEXT,                           -- وثيقة الماجستير

    -- متادیتا
    status                  TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. INDEXES برای سرعت جستجو
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_student_reg_email         ON public.student_registrations(email);
CREATE INDEX IF NOT EXISTS idx_student_reg_phone         ON public.student_registrations(phone);
CREATE INDEX IF NOT EXISTS idx_student_reg_degree        ON public.student_registrations(degree);
CREATE INDEX IF NOT EXISTS idx_student_reg_status        ON public.student_registrations(status);
CREATE INDEX IF NOT EXISTS idx_student_reg_created_at   ON public.student_registrations(created_at DESC);

-- ============================================================
-- 3. تابع auto-update برای updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.student_registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.student_registrations ENABLE ROW LEVEL SECURITY;

-- فقط insert عمومی مجاز است (ثبت‌نام) - بدون نیاز به لاگین
CREATE POLICY "allow_public_insert"
    ON public.student_registrations
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- خواندن فقط برای ادمین‌های احراز هویت‌شده
CREATE POLICY "allow_authenticated_select"
    ON public.student_registrations
    FOR SELECT
    TO authenticated
    USING (true);

-- آپدیت و حذف فقط برای ادمین
CREATE POLICY "allow_authenticated_update"
    ON public.student_registrations
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "allow_authenticated_delete"
    ON public.student_registrations
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================================
-- 5. STORAGE BUCKET برای فایل‌ها
-- ============================================================
-- این رو در Supabase Dashboard > Storage بساز یا با SQL:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-documents',
    'student-documents',
    false,                          -- private bucket (لینک‌ها signed URL خواهند بود)
    2097152,                        -- 2MB حداکثر سایز فایل
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Policy برای آپلود فایل توسط کاربر ناشناس
CREATE POLICY "allow_anon_upload"
    ON storage.objects
    FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'student-documents');

-- Policy برای خواندن فایل توسط ادمین
CREATE POLICY "allow_authenticated_read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'student-documents');

-- ============================================================
-- 6. VIEW برای پنل ادمین (خوانا‌تر)
-- ============================================================
CREATE OR REPLACE VIEW public.admin_registrations AS
SELECT
    id,
    registration_id,
    middle_name || ' ' || last_name                         AS full_name,
    CASE degree WHEN 'master' THEN 'ماجستير' ELSE 'دكتوراه' END AS degree_label,
    university_type,
    major,
    phone,
    email,
    status,
    created_at::DATE                                        AS registration_date
FROM public.student_registrations
ORDER BY created_at DESC;
