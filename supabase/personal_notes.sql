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
ALTER TABLE personal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_notes_categories ENABLE ROW LEVEL SECURITY;

-- هر کاربر فقط یادداشت‌های خودش را می‌بیند
CREATE POLICY "notes_select_own"
    ON personal_notes FOR SELECT
    USING (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', TRUE));

CREATE POLICY "notes_insert_own"
    ON personal_notes FOR INSERT
    WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', TRUE));

CREATE POLICY "notes_update_own"
    ON personal_notes FOR UPDATE
    USING (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', TRUE));

CREATE POLICY "notes_delete_own"
    ON personal_notes FOR DELETE
    USING (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', TRUE));

-- همین policies برای دسته‌بندی‌ها
CREATE POLICY "cats_select_own"
    ON personal_notes_categories FOR SELECT
    USING (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', TRUE));

CREATE POLICY "cats_insert_own"
    ON personal_notes_categories FOR INSERT
    WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', TRUE));

CREATE POLICY "cats_update_own"
    ON personal_notes_categories FOR UPDATE
    USING (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', TRUE));

CREATE POLICY "cats_delete_own"
    ON personal_notes_categories FOR DELETE
    USING (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', TRUE));

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
