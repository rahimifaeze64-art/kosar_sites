-- ============================================================
-- Personal Notes — جدول یادداشت‌های شخصی
-- پشتیبانی از Supabase / PostgreSQL
-- ============================================================

-- ── جدول اصلی یادداشت‌ها ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS personal_notes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT        NOT NULL,               -- شناسه کاربر (از auth یا hardcoded)
    title       TEXT        NOT NULL DEFAULT 'یادداشت بدون عنوان',
    content     TEXT        NOT NULL DEFAULT '',
    category    TEXT        NOT NULL DEFAULT 'عمومی',
    tags        TEXT[]      DEFAULT '{}',           -- آرایه برچسب‌ها
    color       TEXT        DEFAULT NULL,           -- yellow | green | blue | pink | purple | orange | NULL
    pinned      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── جدول دسته‌بندی‌های سفارشی ────────────────────────────────
CREATE TABLE IF NOT EXISTS personal_notes_categories (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT        NOT NULL,
    name        TEXT        NOT NULL,
    color_bg    TEXT        DEFAULT '#64748b',
    color_light TEXT        DEFAULT '#f8fafc',
    color_border TEXT       DEFAULT '#cbd5e1',
    color_text  TEXT        DEFAULT '#334155',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

-- ── ایندکس‌ها برای سرعت جستجو ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_personal_notes_user_id
    ON personal_notes (user_id);

CREATE INDEX IF NOT EXISTS idx_personal_notes_category
    ON personal_notes (user_id, category);

CREATE INDEX IF NOT EXISTS idx_personal_notes_pinned
    ON personal_notes (user_id, pinned DESC);

CREATE INDEX IF NOT EXISTS idx_personal_notes_updated
    ON personal_notes (user_id, updated_at DESC);

-- جستجوی full-text فارسی/عربی
CREATE INDEX IF NOT EXISTS idx_personal_notes_fts
    ON personal_notes USING GIN (to_tsvector('simple', title || ' ' || content));

-- ── تریگر: updated_at خودکار ─────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_personal_notes_updated ON personal_notes;
CREATE TRIGGER trg_personal_notes_updated
    BEFORE UPDATE ON personal_notes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security ────────────────────────────────────────
-- ⚠️  این اپ از Supabase Auth استفاده نمی‌کند.
--     کاربران با ID ثابت (mgr001, emp001, ...) شناسایی می‌شوند.
--     بنابراین از anon key با دسترسی باز استفاده می‌کنیم.
--     امنیت از طریق user_id در query تأمین می‌شود نه RLS.

ALTER TABLE personal_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE personal_notes_categories DISABLE ROW LEVEL SECURITY;

-- policies قدیمی را پاک کن (در صورت وجود)
DROP POLICY IF EXISTS "notes_select_own"   ON personal_notes;
DROP POLICY IF EXISTS "notes_insert_own"   ON personal_notes;
DROP POLICY IF EXISTS "notes_update_own"   ON personal_notes;
DROP POLICY IF EXISTS "notes_delete_own"   ON personal_notes;
DROP POLICY IF EXISTS "cats_select_own"    ON personal_notes_categories;
DROP POLICY IF EXISTS "cats_insert_own"    ON personal_notes_categories;
DROP POLICY IF EXISTS "cats_update_own"    ON personal_notes_categories;
DROP POLICY IF EXISTS "cats_delete_own"    ON personal_notes_categories;

-- دسترسی کامل برای anon role (چون از Supabase Auth استفاده نمی‌شود)
GRANT ALL ON personal_notes            TO anon;
GRANT ALL ON personal_notes_categories TO anon;

-- ── داده نمونه (برای تست) ────────────────────────────────────
INSERT INTO personal_notes (user_id, title, content, category, tags, color, pinned)
VALUES
    ('mgr001', 'جلسه هفتگی', 'دستور جلسه:\n۱- بررسی وضعیت دانشجویان\n۲- گزارش مالی هفته', 'کاری',    ARRAY['جلسه','مهم'], NULL,     TRUE),
    ('mgr001', 'ایده‌های جدید', 'ارتقای سیستم ثبت‌نام آنلاین و یکپارچه‌سازی با پنل سفارت', 'ایده',     ARRAY['توسعه'], 'yellow', FALSE),
    ('mgr001', 'یادآوری پرداخت', 'پرداخت قسط ماهانه دفتر قبل از پایان هفته انجام شود', 'یادآوری', ARRAY['مالی'],  'pink',   FALSE),
    ('emp001', 'نکات مهم روز', 'پیگیری مدارک دانشجو  و هماهنگی با سفارت', 'مهم',      ARRAY['فوری'],  'blue',   TRUE)
ON CONFLICT DO NOTHING;

-- ── View مفید: تعداد یادداشت به ازای هر کاربر و دسته ─────────
CREATE OR REPLACE VIEW v_notes_summary AS
SELECT
    user_id,
    category,
    COUNT(*)            AS note_count,
    COUNT(*) FILTER (WHERE pinned)  AS pinned_count,
    MAX(updated_at)     AS last_updated
FROM personal_notes
GROUP BY user_id, category;
