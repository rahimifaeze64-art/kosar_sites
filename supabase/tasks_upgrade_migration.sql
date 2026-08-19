-- ============================================================
-- tasks_upgrade_migration.sql  (نسخه ۲ — ساده‌شده)
-- فقط ستون‌های جدید به جدول موجود employee_tasks اضافه می‌شوند
-- بدون نیاز به جدول جدید
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
-- ۳. RLS برای employee_tasks (اطمینان از دسترسی anon)
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
-- ۴. ایندکس‌های بهینه‌سازی
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_employee_tasks_status
    ON public.employee_tasks(status);

CREATE INDEX IF NOT EXISTS idx_employee_tasks_due_date
    ON public.employee_tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_employee_tasks_from_id
    ON public.employee_tasks(from_id);

-- ════════════════════════════════════════════════════════════
-- ۵. تأیید ستون‌های نهایی جدول employee_tasks
-- ════════════════════════════════════════════════════════════
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'employee_tasks'
ORDER BY ordinal_position;
