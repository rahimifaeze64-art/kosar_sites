-- ============================================================================
-- Migration: checklist_shares — اشتراک‌گذاری چک‌لیست بین کاربران
-- نسخه ۳ — سازگار با جداول موجود (ALTER TABLE برای ستون‌های جدید)
-- اجرا در Supabase SQL Editor
-- ============================================================================

-- ── ۱. جدول اصلی share (جدید) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checklist_shares (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     TEXT NOT NULL,
    target_id    TEXT NOT NULL,
    owner_name   TEXT,
    share_type   TEXT NOT NULL CHECK (share_type IN ('category', 'item')),
    ref_id       TEXT NOT NULL,
    ref_name     TEXT,
    ref_icon     TEXT,
    ref_color    TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (owner_id, target_id, share_type, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_shares_owner  ON public.checklist_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_checklist_shares_target ON public.checklist_shares(target_id);

ALTER TABLE public.checklist_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shares_owner_all"     ON public.checklist_shares;
DROP POLICY IF EXISTS "shares_target_select" ON public.checklist_shares;
DROP POLICY IF EXISTS "shares_manager_all"   ON public.checklist_shares;

CREATE POLICY "shares_owner_all" ON public.checklist_shares
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()::text)
  WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "shares_target_select" ON public.checklist_shares
  FOR SELECT TO authenticated
  USING (target_id = auth.uid()::text);

CREATE POLICY "shares_manager_all" ON public.checklist_shares
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

-- ── ۲. اضافه کردن ستون shared_from به جداول موجود ──────────────────────
ALTER TABLE public.checklist_categories ADD COLUMN IF NOT EXISTS shared_from TEXT;
ALTER TABLE public.checklist_items      ADD COLUMN IF NOT EXISTS shared_from TEXT;
ALTER TABLE public.checklist_tasks      ADD COLUMN IF NOT EXISTS shared_from TEXT;

-- ── ۳. policy برای خواندن آیتم‌های shared ───────────────────────────────
DROP POLICY IF EXISTS "checklist_categories_shared_read" ON public.checklist_categories;
CREATE POLICY "checklist_categories_shared_read" ON public.checklist_categories
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR shared_from IS NOT NULL);

DROP POLICY IF EXISTS "checklist_items_shared_read" ON public.checklist_items;
CREATE POLICY "checklist_items_shared_read" ON public.checklist_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR shared_from IS NOT NULL);

DROP POLICY IF EXISTS "checklist_tasks_shared_read" ON public.checklist_tasks;
CREATE POLICY "checklist_tasks_shared_read" ON public.checklist_tasks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR shared_from IS NOT NULL);
