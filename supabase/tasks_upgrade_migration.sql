-- ============================================================
-- tasks_upgrade_migration.sql
-- اضافه کردن ستون‌های جدید به employee_tasks
-- و ایجاد جدول tasks_for_manager
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ۱. اصلاح CHECK constraint وضعیت در employee_tasks
--    اضافه کردن: approved, rejected, delayed
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.employee_tasks
    DROP CONSTRAINT IF EXISTS employee_tasks_status_check;

ALTER TABLE public.employee_tasks
    ADD CONSTRAINT employee_tasks_status_check
    CHECK (status IN (
        'pending','in_progress','completed','cancelled',
        'approved','rejected','delayed'
    ));

-- ════════════════════════════════════════════════════════════
-- ۲. اضافه کردن ستون‌های جدید به employee_tasks
-- ════════════════════════════════════════════════════════════

-- دلیل رد وظیفه
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS reject_note TEXT;

-- زمان تأیید نهایی
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- زمان رد وظیفه
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- شناسه فرستنده (برای وظایف از کارمند به مدیر/همکار)
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS from_id TEXT;

-- نام فرستنده
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS from_name TEXT;

-- ════════════════════════════════════════════════════════════
-- ۳. ایجاد جدول tasks_for_manager
--    وظایفی که کارمندان برای مدیر تعریف می‌کنند
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tasks_for_manager (
    id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title           TEXT        NOT NULL,
    description     TEXT,
    due_date        TEXT,
    priority        TEXT        DEFAULT 'low'
                    CHECK (priority IN ('low','medium','high')),
    status          TEXT        DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','completed','rejected')),
    from_id         TEXT,                        -- شناسه کارمند فرستنده
    from_name       TEXT,                        -- نام کارمند فرستنده
    assigned_to_id  TEXT,                        -- شناسه مدیر گیرنده
    assigned_to     TEXT,                        -- نام گیرنده
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۴. RLS برای tasks_for_manager
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.tasks_for_manager ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_tasks_for_manager" ON public.tasks_for_manager;
CREATE POLICY "allow_all_tasks_for_manager"
    ON public.tasks_for_manager
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- ۵. RLS برای employee_tasks (اطمینان از دسترسی anon)
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.employee_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all" ON public.employee_tasks;
CREATE POLICY "anon_all"
    ON public.employee_tasks
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_employee_tasks" ON public.employee_tasks;
CREATE POLICY "allow_all_employee_tasks"
    ON public.employee_tasks
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- ۶. ایندکس‌های بهینه‌سازی
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_employee_tasks_status
    ON public.employee_tasks(status);

CREATE INDEX IF NOT EXISTS idx_employee_tasks_due_date
    ON public.employee_tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_for_manager_from_id
    ON public.tasks_for_manager(from_id);

CREATE INDEX IF NOT EXISTS idx_tasks_for_manager_status
    ON public.tasks_for_manager(status);

-- ════════════════════════════════════════════════════════════
-- ۷. تأیید ساختار نهایی
-- ════════════════════════════════════════════════════════════
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'employee_tasks'
ORDER BY ordinal_position;

SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'tasks_for_manager'
ORDER BY ordinal_position;
