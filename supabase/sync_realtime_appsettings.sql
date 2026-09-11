-- ============================================================
-- sync_realtime_appsettings.sql — نسخهٔ نهایی
-- اجرا در: Supabase Dashboard → SQL Editor
--
-- این فایل دو کار حیاتی انجام می‌دهد:
--   ۱. فعال‌سازی Realtime برای student_progress — تا toggleهای نمای شیت
--      ظرف ~۱ ثانیه به مرورگرها/نقش‌های دیگر برسد (بدون نیاز به رفرش)
--   ۲. ساخت جدول app_settings — برای ذخیرهٔ ترتیب ستون‌ها و سطرهای نمای شیت
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ۱. Realtime برای student_progress
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
    -- اگر جدول قبلاً در publication باشد خطا ندهد
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname    = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename  = 'student_progress'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_progress;
    END IF;
END $$;

-- REPLICA IDENTITY FULL: تا payload رویداد شامل مقادیر کامل ردیف باشد
-- (برای حذف/آپدیت‌های دلتا لازم است)
ALTER TABLE public.student_progress REPLICA IDENTITY FULL;

-- ════════════════════════════════════════════════════════════
-- ۲. جدول app_settings (ترتیب ستون‌ها/سطرهای نمای شیت)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.app_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL DEFAULT 'null',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_app_settings" ON public.app_settings;
CREATE POLICY "allow_all_app_settings"
    ON public.app_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- ۳. بررسی نهایی (باید هر دو سطر برگردند)
-- ════════════════════════════════════════════════════════════
SELECT 'student_progress' AS object, 'در Realtime فعال است ✅' AS status
WHERE EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'student_progress'
)
UNION ALL
SELECT 'app_settings', 'جدول ساخته شد ✅'
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_settings'
);
