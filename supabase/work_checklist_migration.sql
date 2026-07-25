-- ============================================================
-- Work Checklist Migration
-- جداول چک‌لیست کاری برای نقش کارمند
-- ============================================================

-- 1. جدول دسته‌بندی‌ها
CREATE TABLE IF NOT EXISTS checklist_categories (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT DEFAULT '',
    color        TEXT DEFAULT 'purple',
    icon         TEXT DEFAULT 'fas fa-folder',
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول آیتم‌ها (هر دسته‌بندی چند آیتم دارد)
CREATE TABLE IF NOT EXISTS checklist_items (
    id           TEXT PRIMARY KEY,
    category_id  TEXT NOT NULL REFERENCES checklist_categories(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL,
    name         TEXT NOT NULL,
    icon         TEXT DEFAULT 'fas fa-list-check',
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول وظایف (todo items داخل هر آیتم)
CREATE TABLE IF NOT EXISTS checklist_tasks (
    id           TEXT PRIMARY KEY,
    item_id      TEXT NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
    category_id  TEXT,
    user_id      TEXT NOT NULL,
    title        TEXT NOT NULL,
    note         TEXT DEFAULT '',
    is_done      BOOLEAN DEFAULT FALSE,
    done_at      TIMESTAMPTZ,
    sort_order   BIGINT DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_checklist_categories_user ON checklist_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_cat      ON checklist_items(category_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_user     ON checklist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_tasks_item     ON checklist_tasks(item_id);
CREATE INDEX IF NOT EXISTS idx_checklist_tasks_user     ON checklist_tasks(user_id);

-- ─── Row Level Security ───────────────────────────────────────────
ALTER TABLE checklist_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_tasks      ENABLE ROW LEVEL SECURITY;

-- هر کاربر فقط داده‌های خودش را می‌بیند
-- (از آنجا که user_id به صورت متن ذخیره می‌شود،
--  سیاست بر اساس تطابق مستقیم با auth.uid()::text است)

DROP POLICY IF EXISTS "checklist_categories_user_policy" ON checklist_categories;
CREATE POLICY "checklist_categories_user_policy"
    ON checklist_categories
    FOR ALL
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "checklist_items_user_policy" ON checklist_items;
CREATE POLICY "checklist_items_user_policy"
    ON checklist_items
    FOR ALL
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "checklist_tasks_user_policy" ON checklist_tasks;
CREATE POLICY "checklist_tasks_user_policy"
    ON checklist_tasks
    FOR ALL
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

-- ─── Auto-update updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_updated_at ON checklist_categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON checklist_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_items_updated_at ON checklist_items;
CREATE TRIGGER trg_items_updated_at
    BEFORE UPDATE ON checklist_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON checklist_tasks;
CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON checklist_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
