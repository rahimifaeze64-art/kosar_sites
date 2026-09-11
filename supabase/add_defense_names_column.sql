-- ── افزودن ستون «داورها» به جدول profiles ──────────────────────────
-- آرایه‌ای از نام داورها (معمولاً ۲ نفر، برای دکتری ۴ نفر)
-- این فایل را یک‌بار در Supabase SQL Editor اجرا کنید.
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS defense_names jsonb NOT NULL DEFAULT '[]'::jsonb;
