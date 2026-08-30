-- ============================================================
-- sync_fix_all.sql  — نسخه جامع
-- رفع تمام مشکلات sync دیتابیس:
--   ۱. student_progress — ستون student_id به TEXT
--   ۲. employee_tasks   — ستون‌های step و assigned_to به TEXT
--   ۳. step_assignments — unique constraint و RLS
--   ۴. profiles         — ستون‌های وضعیت تحصیلی
--   ۵. employee_hourly_rates — شارژ ماهانه
--   ۶. work_late_requests   — ستون jalali_date
--   ۷. RLS یکپارچه anon برای همه جداول
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ۱. student_progress — student_id به TEXT (بدون FK)
-- ════════════════════════════════════════════════════════════

-- حذف FK قدیمی
ALTER TABLE public.student_progress
    DROP CONSTRAINT IF EXISTS student_progress_student_id_fkey;

-- تبدیل به TEXT اگر هنوز UUID است
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'student_progress'
          AND column_name  = 'student_id'
          AND data_type    = 'uuid'
    ) THEN
        ALTER TABLE public.student_progress
            ALTER COLUMN student_id TYPE TEXT USING student_id::text;
    END IF;
END $$;

ALTER TABLE public.student_progress
    ALTER COLUMN student_id DROP NOT NULL;

-- unique constraint روی (student_id, path_type, step_index)
ALTER TABLE public.student_progress
    DROP CONSTRAINT IF EXISTS student_progress_student_id_path_type_step_index_key;
ALTER TABLE public.student_progress
    ADD CONSTRAINT student_progress_student_id_path_type_step_index_key
    UNIQUE (student_id, path_type, step_index);

-- RLS
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "progress_anon_all" ON public.student_progress;
CREATE POLICY "progress_anon_all"
    ON public.student_progress FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- ۲. employee_tasks — ستون‌های لازم و TEXT برای id/assigned_to
-- ════════════════════════════════════════════════════════════

-- حذف FK‌های مشکل‌ساز
ALTER TABLE public.employee_tasks
    DROP CONSTRAINT IF EXISTS employee_tasks_assigned_to_fkey;
ALTER TABLE public.employee_tasks
    DROP CONSTRAINT IF EXISTS employee_tasks_created_by_fkey;
ALTER TABLE public.employee_tasks
    DROP CONSTRAINT IF EXISTS employee_tasks_student_id_fkey;
ALTER TABLE public.employee_tasks
    DROP CONSTRAINT IF EXISTS employee_tasks_order_id_fkey;

-- تبدیل id به TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'employee_tasks'
          AND column_name = 'id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.employee_tasks ALTER COLUMN id TYPE TEXT USING id::text;
    END IF;
END $$;

-- assigned_to به TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'employee_tasks'
          AND column_name = 'assigned_to' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.employee_tasks ALTER COLUMN assigned_to TYPE TEXT USING assigned_to::text;
        ALTER TABLE public.employee_tasks ALTER COLUMN assigned_to DROP NOT NULL;
    END IF;
END $$;

-- student_id به TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'employee_tasks'
          AND column_name = 'student_id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.employee_tasks ALTER COLUMN student_id TYPE TEXT USING student_id::text;
    END IF;
END $$;

-- ستون‌های step اگر وجود ندارند
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS is_step_task  BOOLEAN DEFAULT false;
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS step_type     TEXT CHECK (step_type IN ('defense','requirements','educational') OR step_type IS NULL);
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS step_index    INTEGER;
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS step_name     TEXT;
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS student_name  TEXT;
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ;
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS from_id       TEXT;
ALTER TABLE public.employee_tasks
    ADD COLUMN IF NOT EXISTS from_name     TEXT;

-- ایندکس ترکیبی برای جستجوی سریع مراحل
CREATE INDEX IF NOT EXISTS idx_et_step
    ON public.employee_tasks (step_type, step_index)
    WHERE is_step_task = true;

CREATE INDEX IF NOT EXISTS idx_et_assigned ON public.employee_tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_et_student  ON public.employee_tasks (student_id);
CREATE INDEX IF NOT EXISTS idx_et_status   ON public.employee_tasks (status);

-- RLS
ALTER TABLE public.employee_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "etasks_anon_all" ON public.employee_tasks;
CREATE POLICY "etasks_anon_all"
    ON public.employee_tasks FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- ۳. step_assignments — unique constraint و TEXT
-- ════════════════════════════════════════════════════════════

-- حذف FK به profiles
ALTER TABLE public.step_assignments
    DROP CONSTRAINT IF EXISTS step_assignments_employee_id_fkey;

-- employee_id به TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'step_assignments'
          AND column_name = 'employee_id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.step_assignments
            ALTER COLUMN employee_id TYPE TEXT USING employee_id::text;
    END IF;
END $$;

-- updated_at
ALTER TABLE public.step_assignments
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- unique constraint روی (path_type, step_index)
ALTER TABLE public.step_assignments
    DROP CONSTRAINT IF EXISTS step_assignments_path_type_step_index_key;
ALTER TABLE public.step_assignments
    ADD CONSTRAINT step_assignments_path_type_step_index_key
    UNIQUE (path_type, step_index);

-- ایندکس
CREATE INDEX IF NOT EXISTS idx_sa_employee
    ON public.step_assignments (employee_id)
    WHERE employee_id IS NOT NULL;

-- RLS
ALTER TABLE public.step_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sa_anon_all" ON public.step_assignments;
CREATE POLICY "sa_anon_all"
    ON public.step_assignments FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- ۴. profiles — ستون‌های وضعیت تحصیلی
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS graduated      BOOLEAN     DEFAULT false;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS graduated_date TIMESTAMPTZ;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS current_path   TEXT;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS finished_date  TIMESTAMPTZ;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS students_meta  JSONB DEFAULT '{}'::jsonb;

-- اصلاح CHECK برای current_path
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_current_path_check;
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_current_path_check
    CHECK (current_path IN ('defense','educational','requirements') OR current_path IS NULL);

-- ایندکس
CREATE INDEX IF NOT EXISTS idx_profiles_graduated
    ON public.profiles (graduated) WHERE graduated = true;
CREATE INDEX IF NOT EXISTS idx_profiles_current_path
    ON public.profiles (current_path) WHERE current_path IS NOT NULL;

-- ════════════════════════════════════════════════════════════
-- ۵. employee_hourly_rates — شارژ ماهانه
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.employee_hourly_rates
    ADD COLUMN IF NOT EXISTS monthly_charge NUMERIC(12,2) NOT NULL DEFAULT 0;

-- جدول ext (کلید TEXT برای localStorage)
CREATE TABLE IF NOT EXISTS public.employee_hourly_rates_ext (
    id              TEXT          PRIMARY KEY,
    hourly_rate     NUMERIC(12,2) NOT NULL DEFAULT 0,
    monthly_charge  NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency        TEXT          NOT NULL DEFAULT 'تومان',
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_hourly_rates_ext ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ehr_ext_anon_all" ON public.employee_hourly_rates_ext;
CREATE POLICY "ehr_ext_anon_all"
    ON public.employee_hourly_rates_ext FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- RLS برای employee_hourly_rates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'employee_hourly_rates'
          AND policyname = 'ehr_anon_all'
    ) THEN
        EXECUTE $p$
            CREATE POLICY "ehr_anon_all"
                ON public.employee_hourly_rates FOR ALL TO anon
                USING (true) WITH CHECK (true)
        $p$;
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- ۶. work_late_requests — ستون jalali_date
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.work_late_requests
    ADD COLUMN IF NOT EXISTS jalali_date TEXT;

-- RLS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'work_late_requests'
          AND policyname = 'lr_anon_all'
    ) THEN
        EXECUTE $p$
            CREATE POLICY "lr_anon_all"
                ON public.work_late_requests FOR ALL TO anon
                USING (true) WITH CHECK (true)
        $p$;
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- ۷. work_hours — RLS anon و policy ویرایش
-- ════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'work_hours'
          AND policyname = 'wh_anon_all'
    ) THEN
        EXECUTE $p$
            CREATE POLICY "wh_anon_all"
                ON public.work_hours FOR ALL TO anon
                USING (true) WITH CHECK (true)
        $p$;
    END IF;
END $$;

-- policy ویرایش برای کارمند (فقط pending/rejected)
-- employee_id در work_hours از نوع TEXT است → auth.uid()::text
DROP POLICY IF EXISTS "wh_update_own_employee" ON public.work_hours;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_user_role'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        -- بررسی نوع ستون employee_id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'work_hours'
              AND column_name = 'employee_id' AND data_type = 'text'
        ) THEN
            -- employee_id از نوع TEXT → auth.uid()::text
            EXECUTE $p$
                CREATE POLICY "wh_update_own_employee"
                    ON public.work_hours FOR UPDATE TO authenticated
                    USING (
                        public.get_user_role() = 'employee'
                        AND employee_id = auth.uid()::text
                        AND status IN ('pending','rejected')
                    )
                    WITH CHECK (
                        public.get_user_role() = 'employee'
                        AND employee_id = auth.uid()::text
                    )
            $p$;
        ELSE
            -- employee_id از نوع UUID → مستقیم
            EXECUTE $p$
                CREATE POLICY "wh_update_own_employee"
                    ON public.work_hours FOR UPDATE TO authenticated
                    USING (
                        public.get_user_role() = 'employee'
                        AND employee_id = auth.uid()
                        AND status IN ('pending','rejected')
                    )
                    WITH CHECK (
                        public.get_user_role() = 'employee'
                        AND employee_id = auth.uid()
                    )
            $p$;
        END IF;
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- ۸. profiles — RLS anon یکپارچه
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "profiles_full_access" ON public.profiles;
DROP POLICY IF EXISTS "anon_all"             ON public.profiles;
DROP POLICY IF EXISTS "allow_all_profiles"   ON public.profiles;
CREATE POLICY "profiles_full_access"
    ON public.profiles FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- ۹. تأیید نهایی
-- ════════════════════════════════════════════════════════════
SELECT
    (SELECT data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='student_progress' AND column_name='student_id')
        AS sp_student_id_type,

    (SELECT data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='employee_tasks' AND column_name='assigned_to')
        AS et_assigned_to_type,

    (SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='employee_tasks' AND column_name='is_step_task')
        AS et_is_step_task,

    (SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='profiles' AND column_name='graduated')
        AS profiles_graduated,

    (SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='employee_hourly_rates' AND column_name='monthly_charge')
        AS ehr_monthly_charge,

    (SELECT count(*)::int FROM pg_policies
     WHERE schemaname='public' AND policyname LIKE '%anon%')
        AS total_anon_policies,

    'sync_fix_all OK ✓' AS status;
