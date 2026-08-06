-- ════════════════════════════════════════════════════════════
-- fix_employee_tasks_columns.sql
-- اضافه کردن ستون‌های گمشده به جدول employee_tasks
-- اجرا در Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- ── ۱. اضافه کردن ستون voice_duration ───────────────────────
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS voice_duration TEXT;

-- ── ۲. اضافه کردن ستون additional_text ─────────────────────
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS additional_text TEXT;

-- ── ۳. اضافه کردن ستون attached_file (JSON برای اطلاعات فایل)
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS attached_file JSONB;

-- ── ۴. اطمینان از وجود ستون completed_at ───────────────────
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ── ۵. اطمینان از وجود ستون completed_by ───────────────────
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS completed_by TEXT;

-- ── ۶. بررسی و تأیید ستون‌ها ────────────────────────────────
DO $$
DECLARE
    col TEXT;
    required_cols TEXT[] := ARRAY[
        'id', 'assigned_to', 'created_by', 'title', 'description',
        'priority', 'status', 'due_date', 'is_step_task',
        'student_id', 'step_type', 'step_index', 'step_name',
        'voice_message', 'voice_duration', 'additional_text',
        'attached_file', 'order_id', 'completed_at', 'completed_by',
        'created_at', 'updated_at'
    ];
BEGIN
    FOREACH col IN ARRAY required_cols LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = 'employee_tasks'
              AND column_name  = col
        ) THEN
            RAISE NOTICE '✅  ستون موجود است: %', col;
        ELSE
            RAISE WARNING '❌  ستون وجود ندارد: %', col;
        END IF;
    END LOOP;
END $$;

-- ── ۷. بررسی RLS policy ─────────────────────────────────────
-- اطمینان از اینکه anon می‌تواند read/write کند
DROP POLICY IF EXISTS "anon_all" ON public.employee_tasks;

CREATE POLICY "anon_all"
    ON public.employee_tasks
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- ── ۸. نمایش ساختار نهایی جدول ─────────────────────────────
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'employee_tasks'
ORDER BY ordinal_position;
