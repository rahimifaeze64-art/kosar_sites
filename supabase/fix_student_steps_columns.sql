-- ============================================================
-- fix_student_steps_columns.sql
-- اضافه کردن ستون‌های مراحل به جدول profiles
-- و اطمینان از وجود جدول step_assignments
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ۱. profiles — ستون‌های مراحل سه‌گانه (JSONB)
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS defense_steps      JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS educational_steps  JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS requirements_steps JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS current_path       TEXT;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS graduated          BOOLEAN DEFAULT false;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS graduated_date     TIMESTAMPTZ;

-- بررسی و اصلاح CHECK برای current_path
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_current_path_check;
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_current_path_check
    CHECK (current_path IN ('defense','educational','requirements') OR current_path IS NULL);

-- ════════════════════════════════════════════════════════════
-- ۲. step_assignments — جدول تخصیص مراحل به کارمندان
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.step_assignments (
    id          BIGSERIAL    PRIMARY KEY,
    path_type   TEXT         NOT NULL CHECK (path_type IN ('defense','educational','requirements')),
    step_index  INTEGER      NOT NULL,
    employee_id TEXT,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT step_assignments_path_type_step_index_key UNIQUE (path_type, step_index)
);

-- RLS برای step_assignments
ALTER TABLE public.step_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sa_anon_all" ON public.step_assignments;
CREATE POLICY "sa_anon_all"
    ON public.step_assignments FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- ایندکس
CREATE INDEX IF NOT EXISTS idx_sa_employee
    ON public.step_assignments (employee_id)
    WHERE employee_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════
-- ۳. student_progress — اطمینان از وجود جدول و ستون‌ها
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.student_progress (
    id          BIGSERIAL    PRIMARY KEY,
    student_id  TEXT         NOT NULL,
    path_type   TEXT         NOT NULL CHECK (path_type IN ('defense','educational','requirements')),
    step_index  INTEGER      NOT NULL,
    status      INTEGER      NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT student_progress_student_id_path_type_step_index_key
        UNIQUE (student_id, path_type, step_index)
);

ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "progress_anon_all" ON public.student_progress;
CREATE POLICY "progress_anon_all"
    ON public.student_progress FOR ALL TO anon
    USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sp_student_path
    ON public.student_progress (student_id, path_type);

-- ════════════════════════════════════════════════════════════
-- ۴. تأیید
-- ════════════════════════════════════════════════════════════
SELECT
    (SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='profiles' AND column_name='defense_steps')
        AS profiles_defense_steps,
    (SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='profiles' AND column_name='current_path')
        AS profiles_current_path,
    (SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='profiles' AND column_name='graduated')
        AS profiles_graduated,
    (SELECT to_regclass('public.step_assignments'))
        AS step_assignments_table,
    (SELECT to_regclass('public.student_progress'))
        AS student_progress_table,
    'fix_student_steps_columns OK ✓' AS status;
