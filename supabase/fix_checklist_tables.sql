-- ============================================================
-- fix_checklist_tables.sql
-- اصلاح جداول چک‌لیست که بدون public. ساخته شدند
-- و اضافه کردن policy های anon که نبودند
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── ۱. اگر جداول قدیمی بدون schema وجود دارند، داده را migrate کن ──

-- categories
DO $$
BEGIN
    -- ایجاد جدول با public. اگر وجود ندارد
    CREATE TABLE IF NOT EXISTS public.checklist_categories (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL,
        name         TEXT NOT NULL,
        description  TEXT DEFAULT '',
        color        TEXT DEFAULT 'lime',
        icon         TEXT DEFAULT 'fas fa-folder',
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
    );

    -- اگر جدول قدیمی (بدون schema) وجود دارد و داده دارد، migrate کن
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'checklist_categories'
    ) THEN
        -- جدول درست است، فقط ادامه می‌دهیم
        NULL;
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.checklist_items (
    id           TEXT PRIMARY KEY,
    category_id  TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    name         TEXT NOT NULL,
    icon         TEXT DEFAULT 'fas fa-list-check',
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.checklist_tasks (
    id           TEXT PRIMARY KEY,
    item_id      TEXT NOT NULL,
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

-- ── ۲. ایندکس‌ها ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cl_cats_user   ON public.checklist_categories (user_id);
CREATE INDEX IF NOT EXISTS idx_cl_items_cat   ON public.checklist_items (category_id);
CREATE INDEX IF NOT EXISTS idx_cl_items_user  ON public.checklist_items (user_id);
CREATE INDEX IF NOT EXISTS idx_cl_tasks_item  ON public.checklist_tasks (item_id);
CREATE INDEX IF NOT EXISTS idx_cl_tasks_user  ON public.checklist_tasks (user_id);

-- ── ۳. RLS: فعال‌سازی + policy های جدید ──────────────────────
ALTER TABLE public.checklist_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_tasks      ENABLE ROW LEVEL SECURITY;

-- حذف policy های قدیمی authenticated-only
DROP POLICY IF EXISTS "checklist_categories_user_policy" ON public.checklist_categories;
DROP POLICY IF EXISTS "checklist_items_user_policy"      ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_tasks_user_policy"      ON public.checklist_tasks;

-- policy های جدید: anon دسترسی کامل دارد
DROP POLICY IF EXISTS "cl_cats_anon"  ON public.checklist_categories;
CREATE POLICY "cl_cats_anon"
    ON public.checklist_categories FOR ALL TO anon
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cl_items_anon" ON public.checklist_items;
CREATE POLICY "cl_items_anon"
    ON public.checklist_items FOR ALL TO anon
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cl_tasks_anon" ON public.checklist_tasks;
CREATE POLICY "cl_tasks_anon"
    ON public.checklist_tasks FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- authenticated هم دسترسی کامل
DROP POLICY IF EXISTS "cl_cats_auth"  ON public.checklist_categories;
CREATE POLICY "cl_cats_auth"
    ON public.checklist_categories FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cl_items_auth" ON public.checklist_items;
CREATE POLICY "cl_items_auth"
    ON public.checklist_items FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cl_tasks_auth" ON public.checklist_tasks;
CREATE POLICY "cl_tasks_auth"
    ON public.checklist_tasks FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- ── ۴. trigger برای updated_at ────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_checklist_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cl_cats_upd  ON public.checklist_categories;
CREATE TRIGGER trg_cl_cats_upd
    BEFORE UPDATE ON public.checklist_categories
    FOR EACH ROW EXECUTE FUNCTION public.update_checklist_updated_at();

DROP TRIGGER IF EXISTS trg_cl_items_upd ON public.checklist_items;
CREATE TRIGGER trg_cl_items_upd
    BEFORE UPDATE ON public.checklist_items
    FOR EACH ROW EXECUTE FUNCTION public.update_checklist_updated_at();

DROP TRIGGER IF EXISTS trg_cl_tasks_upd ON public.checklist_tasks;
CREATE TRIGGER trg_cl_tasks_upd
    BEFORE UPDATE ON public.checklist_tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_checklist_updated_at();

-- ── ۵. تأیید ──────────────────────────────────────────────────
SELECT
    (SELECT count(*) FROM public.checklist_categories) AS categories,
    (SELECT count(*) FROM public.checklist_items)      AS items,
    (SELECT count(*) FROM public.checklist_tasks)      AS tasks,
    'checklist tables fixed ✓' AS status;
