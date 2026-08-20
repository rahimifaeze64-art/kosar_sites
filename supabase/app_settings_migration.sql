-- ============================================================
-- app_settings_migration.sql
-- جدول تنظیمات عمومی اپلیکیشن (key-value store)
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL DEFAULT 'null',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: همه می‌توانند بخوانند، فقط با نشست معتبر می‌توانند بنویسند
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_app_settings" ON public.app_settings;
CREATE POLICY "allow_all_app_settings"
    ON public.app_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ایجاد ردیف پیش‌فرض برای empAccAllowedIds
INSERT INTO public.app_settings (key, value)
VALUES ('empAccAllowedIds', '[]')
ON CONFLICT (key) DO NOTHING;

SELECT * FROM public.app_settings;
