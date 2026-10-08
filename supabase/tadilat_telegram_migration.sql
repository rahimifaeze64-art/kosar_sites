-- ============================================================
-- tadilat_telegram_migration.sql
-- پل ارتباطی «ربات تلگرام» با «صفحهٔ تعدیلات نویسنده‌ها (دکترها)»
--
-- دو جدول جدید می‌سازد:
--   tadilat_requests → یک درخواست تعدیلات (هر دانشجو در تلگرام یک درخواست)
--   tadilat_files    → فایل‌های همان درخواست (ویس، عکس، PDF)
--
-- نکات مهم این پروژه که در طراحی لحاظ شده:
--   • profiles.id در این دیتابیس TEXT است (مثل new052) و UUID نیست.
--   • سیستم با کلید anon کار می‌کند؛ پس RLS مثل student_documents
--     سیاست بازِ anon می‌گیرد (هم‌راستا با بقیهٔ ماژول‌ها).
--   • فایل‌ها در همان باکت موجود student-documents ذخیره می‌شوند؛
--     باکت دیگری لازم نیست.
--
-- اجرا در: Supabase Dashboard → SQL Editor  (کل فایل را یک‌جا اجرا کنید)
-- ایمن برای اجرای مجدد (idempotent)
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- ۱. جدول درخواست‌های تعدیلات
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tadilat_requests (
    id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,

    -- ── منبع ارسال ──────────────────────────────────────────
    -- mini_app = تلگرام تلگرام | telegram_bot = گفتگوی ربات
    source              TEXT        NOT NULL DEFAULT 'mini_app'
                        CHECK (source IN ('mini_app','telegram_bot')),

    -- ── هویت فرستنده در تلگرام ──────────────────────────────
    -- اگر صفحه در مرورگر معمولی (نه تلگرام) باز شود، این مقدار NULL است
    telegram_user_id    BIGINT,
    telegram_username   TEXT,
    telegram_name       TEXT,        -- first_name + last_name در تلگرام

    -- ── اتصال به پروفایل دانشجو ─────────────────────────────
    student_id          TEXT,        -- همان id در profiles (TEXT، نه UUID)
    student_name        TEXT        NOT NULL,   -- نامی که خود دانشجو فرستاده
    student_no          TEXT,        -- شمارهٔ دانشجویی در صورت اعلام
    name_source         TEXT        DEFAULT 'text'
                        CHECK (name_source IN ('text','voice','voice_stt')),

    -- مسیر ویس نام در Storage (اگر دانشجو نام را ویس فرستاده باشد)
    name_audio_path     TEXT,

    note                TEXT,        -- توضیح/کپشن نهایی دانشجو

    -- ── وضعیت گردش کار ──────────────────────────────────────
    -- new=دریافت شد | started=شروع شد | in_progress=در حال انجام
    -- ready=آماده تحویل | completed=تحویل شد | rejected=رد شد
    status              TEXT        NOT NULL DEFAULT 'new'
                        CHECK (status IN ('draft','new','started','in_progress',
                                          'ready','completed','rejected')),

    -- ── تخصیص به نویسنده (دکتر/عامل) ────────────────────────
    assigned_agent_id   TEXT,        -- همان id در profiles
    assigned_agent_name TEXT,
    agent_note          TEXT,

    -- ── مسیریابی خودکار (دانشجو → نویسندهٔ مربوطه) ──────────
    -- auto   = سیستم از روی سفارش دانشجو پیدا کرده
    -- manual = کارمند/مدیر دستی انتخاب کرده
    routed_at           TIMESTAMPTZ,
    routed_by           TEXT        CHECK (routed_by IN ('auto','manual')),
    routed_note         TEXT,        -- توضیح مسیریاب (مثلاً کدام سفارش مبنا بود)

    -- ── زمان‌بندی تحویل ─────────────────────────────────────
    due_at              TIMESTAMPTZ,  -- ساعتی که به دانشجو اعلام می‌شود
    started_at          TIMESTAMPTZ,
    ready_at            TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,

    files_count         INTEGER     DEFAULT 0,
    submitted_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.tadilat_requests IS
    'درخواست‌های تعدیلات ارسالی دانشجویان از تلگرام/ربات تلگرام';
COMMENT ON COLUMN public.tadilat_requests.student_id IS
    'اتصال به profiles.id — در این دیتابیس TEXT است';
COMMENT ON COLUMN public.tadilat_requests.status IS
    'new=دریافت شد | started=شروع شد | in_progress=در حال انجام | ready=آماده تحویل | completed=تحویل شد | rejected=رد شد | draft=ناتمام';
COMMENT ON COLUMN public.tadilat_requests.due_at IS
    'ساعت/تاریخ تحویل اعلام‌شده به دانشجو';
COMMENT ON COLUMN public.tadilat_requests.name_audio_path IS
    'مسیر ویس نام دانشجو در Storage (اختیاری)';


-- ════════════════════════════════════════════════════════════
-- ۲. جدول فایل‌های تعدیلات
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tadilat_files (
    id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    request_id       TEXT        NOT NULL
                     REFERENCES public.tadilat_requests(id) ON DELETE CASCADE,

    -- deliverable = فایل آمادهٔ تحویل که نویسنده آپلود می‌کند
    kind             TEXT        NOT NULL
                     CHECK (kind IN ('voice','photo','document','audio',
                                     'video','deliverable')),
    file_name        TEXT,
    storage_path     TEXT,        -- path داخل باکت student-documents
    mime_type        TEXT,
    file_size        BIGINT,
    duration         INTEGER,     -- ثانیه (برای ویس/صدا)
    caption          TEXT,
    telegram_file_id TEXT,        -- برای ردیابی/بازیابی از تلگرام
    created_at       TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.tadilat_files IS
    'فایل‌های هر درخواست تعدیلات (ویس/عکس/PDF) — مسیر در باکت student-documents';


-- ════════════════════════════════════════════════════════════
-- ۳. تریگر updated_at (از تابع مشترک موجود استفاده می‌کند)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_tadilat_requests_updated_at ON public.tadilat_requests;
CREATE TRIGGER trg_tadilat_requests_updated_at
    BEFORE UPDATE ON public.tadilat_requests
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ════════════════════════════════════════════════════════════
-- ۴. ایندکس‌ها
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_tadilat_requests_status
    ON public.tadilat_requests (status);

CREATE INDEX IF NOT EXISTS idx_tadilat_requests_student
    ON public.tadilat_requests (student_id);

CREATE INDEX IF NOT EXISTS idx_tadilat_requests_agent
    ON public.tadilat_requests (assigned_agent_id);

CREATE INDEX IF NOT EXISTS idx_tadilat_requests_created
    ON public.tadilat_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tadilat_requests_tg
    ON public.tadilat_requests (telegram_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tadilat_requests_source
    ON public.tadilat_requests (source);

CREATE INDEX IF NOT EXISTS idx_tadilat_requests_due
    ON public.tadilat_requests (due_at);

CREATE INDEX IF NOT EXISTS idx_tadilat_files_request
    ON public.tadilat_files (request_id, created_at);


-- ════════════════════════════════════════════════════════════
-- ۵. RLS — هم‌راستا با student_documents و student_files
--    (کلاینت وب و ربات با anon key کار می‌کنند)
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.tadilat_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tadilat_requests_select" ON public.tadilat_requests;
CREATE POLICY "tadilat_requests_select"
    ON public.tadilat_requests FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "tadilat_requests_insert" ON public.tadilat_requests;
CREATE POLICY "tadilat_requests_insert"
    ON public.tadilat_requests FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "tadilat_requests_update" ON public.tadilat_requests;
CREATE POLICY "tadilat_requests_update"
    ON public.tadilat_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tadilat_requests_delete" ON public.tadilat_requests;
CREATE POLICY "tadilat_requests_delete"
    ON public.tadilat_requests FOR DELETE TO anon USING (true);

ALTER TABLE public.tadilat_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tadilat_files_select" ON public.tadilat_files;
CREATE POLICY "tadilat_files_select"
    ON public.tadilat_files FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "tadilat_files_insert" ON public.tadilat_files;
CREATE POLICY "tadilat_files_insert"
    ON public.tadilat_files FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "tadilat_files_update" ON public.tadilat_files;
CREATE POLICY "tadilat_files_update"
    ON public.tadilat_files FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tadilat_files_delete" ON public.tadilat_files;
CREATE POLICY "tadilat_files_delete"
    ON public.tadilat_files FOR DELETE TO anon USING (true);


-- ════════════════════════════════════════════════════════════
-- ۶. Storage — استفاده از باکت موجود student-documents
--    (اگر به هر دلیلی وجود ندارد، اینجا ساخته می‌شود)
--    محدودیت نوع فایل برداشته می‌شود تا «ویس» هم قابل آپلود باشد.
-- ════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-documents',
    'student-documents',
    false,
    52428800,   -- ۵۰ مگابایت
    NULL        -- بدون محدودیت نوع: عکس + PDF + ویس/صدا
)
ON CONFLICT (id) DO UPDATE
    SET file_size_limit   = 52428800,
        allowed_mime_types = NULL;

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
-- ۷. Realtime (اختیاری) — به‌روزرسانی خودکار صفحهٔ تعدیلات
--    اگر باعث خطا شد، این بخش را نادیده بگیرید.
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tadilat_requests;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tadilat_files;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;


-- ════════════════════════════════════════════════════════════
-- ۸. تأیید نصب
-- ════════════════════════════════════════════════════════════
SELECT
    'tadilat tables ready ✓' AS status,
    (SELECT count(*) FROM public.tadilat_requests) AS requests,
    (SELECT count(*) FROM public.tadilat_files)    AS files;
