-- ══════════════════════════════════════════════════════════════════════
-- رفع باگ‌های کارتابل و مدیریت مراحل (باگ‌های ۳ و ۶ از لیست بررسی)
--
--   ۱) جدول step_assignments با UNIQUE (path_type, step_index)
--      → لازم برای upsert با onConflict: 'path_type,step_index'
--   ۲) RLS برای نقش‌های anon و authenticated
--   ۳) ستون student_name برای جدول employee_tasks
--      → نمایش نام دانشجو در کارتابل «وظایف من» بعد از sync از Supabase
--
-- اجرا: Supabase Dashboard → SQL Editor → کل این فایل را اجرا کنید
-- ══════════════════════════════════════════════════════════════════════

-- ── ۱. جدول step_assignments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.step_assignments (
    id          BIGSERIAL PRIMARY KEY,
    path_type   TEXT    NOT NULL CHECK (path_type IN ('defense', 'requirements', 'educational')),
    step_index  INTEGER NOT NULL CHECK (step_index >= 0),
    employee_id TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- UNIQUE constraint لازم برای upsert با onConflict: 'path_type,step_index'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'step_assignments_path_step_unique'
          AND conrelid = 'public.step_assignments'::regclass
    ) THEN
        -- حذف ردیف‌های تکراری قبل از افزودن constraint (بزرگ‌ترین id نگه داشته می‌شود)
        DELETE FROM public.step_assignments a
        USING public.step_assignments b
        WHERE a.path_type = b.path_type
          AND a.step_index = b.step_index
          AND a.id < b.id;

        ALTER TABLE public.step_assignments
            ADD CONSTRAINT step_assignments_path_step_unique UNIQUE (path_type, step_index);
    END IF;
END $$;

-- ── ۲. RLS — دسترسی کامل برای anon و authenticated ────────────────────
ALTER TABLE public.step_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_step_assignments" ON public.step_assignments;
DROP POLICY IF EXISTS "authenticated_all_step_assignments" ON public.step_assignments;

CREATE POLICY "anon_all_step_assignments" ON public.step_assignments
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_all_step_assignments" ON public.step_assignments
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

GRANT ALL ON public.step_assignments TO anon;
GRANT ALL ON public.step_assignments TO authenticated;

-- ── ۳. ستون student_name برای employee_tasks ──────────────────────────
-- _taskToDb مقدار t.studentName را می‌فرستد؛ بدون این ستون نام دانشجو
-- در رفت‌وبرگشت Supabase گم می‌شود و کارتابل ID خام نشان می‌دهد
ALTER TABLE public.employee_tasks ADD COLUMN IF NOT EXISTS student_name TEXT;
