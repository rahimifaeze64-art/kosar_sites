-- ══════════════════════════════════════════════════════════════════════
-- steps_tables_setup.sql — نسخه ۲ (بازنویسی مطابق منطق فعلی فرانت‌اند)
-- ساخت کامل زیرساخت «مراحل تحصیلی» — فقط اگر قبلاً ساخته نشده باشد
-- (Idempotent — اجرای چندباره امن است)
--
-- منطق فعلی فرانت‌اند که این فایل بر اساس آن نوشته شده:
--   • چهار مسیر: studying | defense | requirements | educational
--     (دانشجوی جدید با current_path='studying' ثبت می‌شود)
--   • همهٔ ID ها TEXT هستند (بدون FK) — FINAL_FIX.sql و sync_fix_all.sql
--   • پیشرفت مراحل: student_progress با upsert روی
--     (student_id, path_type, step_index) و status = 0|1|2|3
--     (0=انجام‌نشده، 1=در حال انجام، 2=انجام‌شده، 3=متوقف شده)
--   • تخصیص مراحل: step_assignments با upsert روی (path_type, step_index)
--     و حذف تخصیص = DELETE ردیف؛ employee_id از نوع TEXT
--   • متن کامل مراحل هر دانشجو: ستون‌های JSONB روی profiles
--     (defense_steps / educational_steps / requirements_steps)
--   • مسیر مستقل studying: ۵ مرحله (فاز + ۴ زیرمرحله) با path_type='studying'
--     — مسیر educational دقیقاً ۲۲ مرحله دارد (ایندکس ۰ تا ۲۱)
--   • کارتابل: employee_tasks ستون‌های step (is_step_task/step_type/...)
--
-- اجرا: Supabase Dashboard → SQL Editor → کل این فایل را اجرا کنید
-- ══════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════
-- ۱. student_progress — پیشرفت مرحله‌به‌مرحله هر دانشجو در هر مسیر
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.student_progress (
    id          BIGSERIAL    PRIMARY KEY,
    student_id  TEXT,                              -- TEXT (نه UUID) — مطابق FINAL_FIX
    path_type   TEXT         NOT NULL,
    step_index  INTEGER      NOT NULL CHECK (step_index >= 0),
    status      INTEGER      NOT NULL DEFAULT 0 CHECK (status IN (0,1,2,3)),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ۱.۱ حذف FK قدیمی و تبدیل student_id به TEXT اگر UUID باشد
ALTER TABLE public.student_progress
    DROP CONSTRAINT IF EXISTS student_progress_student_id_fkey;

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

-- فرانت ممکن است در جابجایی‌ها student_id را خالی بفرستد — NOT NULL نباشد
ALTER TABLE public.student_progress ALTER COLUMN student_id DROP NOT NULL;

-- ۱.۲ CHECK مسیرها — پذیرش هر چهار مسیر (شامل 'studying')
DO $$
DECLARE c record;
BEGIN
    ALTER TABLE public.student_progress
        DROP CONSTRAINT IF EXISTS student_progress_path_type_check;
    ALTER TABLE public.student_progress
        DROP CONSTRAINT IF EXISTS student_progress_path_type_check1;

    -- حذف هر CHECK قدیمیِ دیگری روی path_type که 'studying' را نمی‌پذیرد
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.student_progress'::regclass
          AND contype  = 'c'
          AND pg_get_constraintdef(oid) LIKE '%path_type%'
          AND pg_get_constraintdef(oid) NOT LIKE '%studying%'
    LOOP
        EXECUTE format('ALTER TABLE public.student_progress DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.student_progress
        ADD CONSTRAINT student_progress_path_type_check
        CHECK (path_type IN ('defense','educational','requirements','studying'));
END $$;

-- ۱.۲.۱ CHECK وضعیت — پذیرش چهار وضعیت (0|1|2|3) — 3 = متوقف شده
--      (نسخه‌های قبلی فقط 0|1|2 را می‌پذیرفتند)
DO $$
DECLARE c record;
BEGIN
    -- حذف هر CHECK قدیمی روی status که '3' را نمی‌پذیرد
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.student_progress'::regclass
          AND contype  = 'c'
          AND pg_get_constraintdef(oid) LIKE '%status%'
          AND pg_get_constraintdef(oid) NOT LIKE '%3%'
    LOOP
        EXECUTE format('ALTER TABLE public.student_progress DROP CONSTRAINT %I', c.conname);
    END LOOP;

    -- اگر هیچ CHECK وضعیتی نماند، نام‌دارِ جدید را بساز
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.student_progress'::regclass
          AND contype  = 'c'
          AND pg_get_constraintdef(oid) LIKE '%status%'
    ) THEN
        ALTER TABLE public.student_progress
            ADD CONSTRAINT student_progress_status_check
            CHECK (status IN (0,1,2,3));
    END IF;
END $$;

-- ۱.۳ UNIQUE (student_id, path_type, step_index) — ضروری برای upsert
--     فرانت: onConflict: 'student_id,path_type,step_index'
--     (اگر با هر نامی از قبل باشد، دوباره ساخته نمی‌شود)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index x
        WHERE x.indrelid  = 'public.student_progress'::regclass
          AND x.indisunique
          AND x.indpred IS NULL
          AND (
                SELECT string_agg(a.attname, ',' ORDER BY a.attname)
                FROM unnest(x.indkey::int2[]) AS k(attnum)
                JOIN pg_attribute a
                  ON a.attrelid = x.indrelid AND a.attnum = k.attnum
              ) = 'path_type,step_index,student_id'
    ) THEN
        -- حذف ردیف‌های تکراری پیش از افزودن constraint — جدیدترین updated_at می‌ماند
        DELETE FROM public.student_progress a
        USING public.student_progress b
        WHERE a.student_id IS NOT DISTINCT FROM b.student_id
          AND a.path_type  = b.path_type
          AND a.step_index = b.step_index
          AND (
                COALESCE(a.updated_at, '-infinity'::timestamptz)
                  < COALESCE(b.updated_at, '-infinity'::timestamptz)
             OR (
                 COALESCE(a.updated_at, '-infinity'::timestamptz)
                   = COALESCE(b.updated_at, '-infinity'::timestamptz)
                 AND a.id::text < b.id::text
                )
              );

        ALTER TABLE public.student_progress
            ADD CONSTRAINT student_progress_student_path_step_unique
            UNIQUE (student_id, path_type, step_index);
    END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════
-- ۲. step_assignments — تخصیص سراسری مسئولیت هر مرحله به کارمند
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.step_assignments (
    id          BIGSERIAL    PRIMARY KEY,
    path_type   TEXT         NOT NULL,
    step_index  INTEGER      NOT NULL CHECK (step_index >= 0),
    employee_id TEXT,                              -- TEXT (نه UUID) — بدون FK
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ۲.۱ حذف FK قدیمی و تبدیل employee_id به TEXT اگر UUID باشد
ALTER TABLE public.step_assignments
    DROP CONSTRAINT IF EXISTS step_assignments_employee_id_fkey;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'step_assignments'
          AND column_name  = 'employee_id'
          AND data_type    = 'uuid'
    ) THEN
        ALTER TABLE public.step_assignments
            ALTER COLUMN employee_id TYPE TEXT USING employee_id::text;
    END IF;
END $$;

ALTER TABLE public.step_assignments ALTER COLUMN employee_id DROP NOT NULL;

-- ۲.۲ CHECK مسیرها — چهار مسیر (شامل 'studying' برای هماهنگی با validPaths فرانت)
DO $$
DECLARE c record;
BEGIN
    ALTER TABLE public.step_assignments
        DROP CONSTRAINT IF EXISTS step_assignments_path_type_check;
    ALTER TABLE public.step_assignments
        DROP CONSTRAINT IF EXISTS step_assignments_path_type_check1;

    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.step_assignments'::regclass
          AND contype  = 'c'
          AND pg_get_constraintdef(oid) LIKE '%path_type%'
          AND pg_get_constraintdef(oid) NOT LIKE '%studying%'
    LOOP
        EXECUTE format('ALTER TABLE public.step_assignments DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.step_assignments
        ADD CONSTRAINT step_assignments_path_type_check
        CHECK (path_type IN ('defense','educational','requirements','studying'));
END $$;

-- ۲.۳ UNIQUE (path_type, step_index) — ضروری برای upsert
--     فرانت: onConflict: 'path_type,step_index' و حذف تخصیص با DELETE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index x
        WHERE x.indrelid  = 'public.step_assignments'::regclass
          AND x.indisunique
          AND x.indpred IS NULL
          AND (
                SELECT string_agg(a.attname, ',' ORDER BY a.attname)
                FROM unnest(x.indkey::int2[]) AS k(attnum)
                JOIN pg_attribute a
                  ON a.attrelid = x.indrelid AND a.attnum = k.attnum
              ) = 'path_type,step_index'
    ) THEN
        -- حذف ردیف‌های تکراری — بزرگ‌ترین id می‌ماند
        DELETE FROM public.step_assignments a
        USING public.step_assignments b
        WHERE a.path_type  = b.path_type
          AND a.step_index = b.step_index
          AND a.id::text   < b.id::text;

        ALTER TABLE public.step_assignments
            ADD CONSTRAINT step_assignments_path_step_unique
            UNIQUE (path_type, step_index);
    END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════
-- ۳. profiles — ستون‌های مراحل و وضعیت تحصیلی
-- ══════════════════════════════════════════════════════════════════════

-- متن کامل مراحل (JSONB) — فرنت با _syncStepsToSupabase اینها را می‌نویسد
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS defense_steps      JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS educational_steps  JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requirements_steps JSONB DEFAULT '[]'::jsonb;

-- وضعیت تحصیلی — با students-sync.js و _syncStudentProfileToSupabase هماهنگ
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS graduated      BOOLEAN     DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS graduated_date TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_path   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS finished_date  TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS students_meta  JSONB       DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT now();

-- CHECK مسیر فعلی — چهار مسیر (شامل 'studying')
DO $$
DECLARE c record;
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_current_path_check;

    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.profiles'::regclass
          AND contype  = 'c'
          AND pg_get_constraintdef(oid) LIKE '%current_path%'
          AND pg_get_constraintdef(oid) NOT LIKE '%studying%'
    LOOP
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_current_path_check
        CHECK (current_path IN ('defense','educational','requirements','studying') OR current_path IS NULL);
END $$;


-- ══════════════════════════════════════════════════════════════════════
-- ۴. employee_tasks — ستون‌های وظایف مرحله‌ای (کارتابل)
--    فقط اگر جدول وجود داشته باشد (با create_missing_tables.sql ساخته می‌شود)
-- ══════════════════════════════════════════════════════════════════════

DO $$
DECLARE c record;
BEGIN
    IF to_regclass('public.employee_tasks') IS NOT NULL THEN
        -- حذف FK های قدیمی
        ALTER TABLE public.employee_tasks DROP CONSTRAINT IF EXISTS employee_tasks_assigned_to_fkey;
        ALTER TABLE public.employee_tasks DROP CONSTRAINT IF EXISTS employee_tasks_created_by_fkey;
        ALTER TABLE public.employee_tasks DROP CONSTRAINT IF EXISTS employee_tasks_student_id_fkey;
        ALTER TABLE public.employee_tasks DROP CONSTRAINT IF EXISTS employee_tasks_order_id_fkey;

        -- تبدیل ID ها به TEXT اگر UUID باشند (فرانت TEXT می‌فرستد)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='employee_tasks'
              AND column_name='id' AND data_type='uuid'
        ) THEN
            ALTER TABLE public.employee_tasks ALTER COLUMN id TYPE TEXT USING id::text;
            ALTER TABLE public.employee_tasks ALTER COLUMN id DROP DEFAULT;
        END IF;
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='employee_tasks'
              AND column_name='assigned_to' AND data_type='uuid'
        ) THEN
            ALTER TABLE public.employee_tasks ALTER COLUMN assigned_to TYPE TEXT USING assigned_to::text;
            ALTER TABLE public.employee_tasks ALTER COLUMN assigned_to DROP NOT NULL;
        END IF;
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='employee_tasks'
              AND column_name='student_id' AND data_type='uuid'
        ) THEN
            ALTER TABLE public.employee_tasks ALTER COLUMN student_id TYPE TEXT USING student_id::text;
        END IF;

        -- ستون‌های وظیفهٔ مرحله‌ای
        ALTER TABLE public.employee_tasks ADD COLUMN IF NOT EXISTS is_step_task BOOLEAN      DEFAULT false;
        ALTER TABLE public.employee_tasks ADD COLUMN IF NOT EXISTS step_type    TEXT;
        ALTER TABLE public.employee_tasks ADD COLUMN IF NOT EXISTS step_index   INTEGER;
        ALTER TABLE public.employee_tasks ADD COLUMN IF NOT EXISTS step_name    TEXT;
        ALTER TABLE public.employee_tasks ADD COLUMN IF NOT EXISTS student_name TEXT;
        ALTER TABLE public.employee_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
        ALTER TABLE public.employee_tasks ADD COLUMN IF NOT EXISTS from_id      TEXT;
        ALTER TABLE public.employee_tasks ADD COLUMN IF NOT EXISTS from_name    TEXT;

        -- CHECK مسیرها برای step_type — چهار مسیر (شامل 'studying')
        FOR c IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.employee_tasks'::regclass
              AND contype  = 'c'
              AND pg_get_constraintdef(oid) LIKE '%step_type%'
              AND pg_get_constraintdef(oid) NOT LIKE '%studying%'
        LOOP
            EXECUTE format('ALTER TABLE public.employee_tasks DROP CONSTRAINT %I', c.conname);
        END LOOP;

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.employee_tasks'::regclass
              AND contype  = 'c'
              AND pg_get_constraintdef(oid) LIKE '%step_type%'
              AND pg_get_constraintdef(oid) LIKE '%studying%'
        ) THEN
            ALTER TABLE public.employee_tasks
                ADD CONSTRAINT employee_tasks_step_type_check
                CHECK (step_type IN ('defense','educational','requirements','studying') OR step_type IS NULL);
        END IF;
    END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════
-- ۵. RLS و دسترسی — anon و authenticated (فرانت با session وارد می‌شود)
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "progress_anon_all" ON public.student_progress;
DROP POLICY IF EXISTS "anon_all" ON public.student_progress;
DROP POLICY IF EXISTS "progress_authenticated_all" ON public.student_progress;
CREATE POLICY "progress_anon_all"
    ON public.student_progress FOR ALL TO anon
    USING (true) WITH CHECK (true);
CREATE POLICY "progress_authenticated_all"
    ON public.student_progress FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sa_anon_all" ON public.step_assignments;
DROP POLICY IF EXISTS "anon_all_step_assignments" ON public.step_assignments;
DROP POLICY IF EXISTS "anon_all" ON public.step_assignments;
DROP POLICY IF EXISTS "sa_authenticated_all" ON public.step_assignments;
DROP POLICY IF EXISTS "authenticated_all_step_assignments" ON public.step_assignments;
CREATE POLICY "sa_anon_all"
    ON public.step_assignments FOR ALL TO anon
    USING (true) WITH CHECK (true);
CREATE POLICY "sa_authenticated_all"
    ON public.step_assignments FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

GRANT ALL ON public.student_progress TO anon;
GRANT ALL ON public.student_progress TO authenticated;
GRANT ALL ON public.step_assignments TO anon;
GRANT ALL ON public.step_assignments TO authenticated;


-- ══════════════════════════════════════════════════════════════════════
-- ۶. ایندکس‌ها
-- ══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_sp_student_path
    ON public.student_progress (student_id, path_type);
CREATE INDEX IF NOT EXISTS idx_student_progress_path
    ON public.student_progress (path_type);

CREATE INDEX IF NOT EXISTS idx_sa_employee
    ON public.step_assignments (employee_id)
    WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_graduated
    ON public.profiles (graduated) WHERE graduated = true;
CREATE INDEX IF NOT EXISTS idx_profiles_current_path
    ON public.profiles (current_path) WHERE current_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_active_path
    ON public.profiles (active, current_path);

DO $$
BEGIN
    IF to_regclass('public.employee_tasks') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_et_step
            ON public.employee_tasks (step_type, step_index)
            WHERE is_step_task = true;
        CREATE INDEX IF NOT EXISTS idx_et_assigned ON public.employee_tasks (assigned_to);
        CREATE INDEX IF NOT EXISTS idx_et_student  ON public.employee_tasks (student_id);
    END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════
-- ۷. مقدار پیش‌فرض مراحل دانشجوی جدید (seed) — هم‌تراز با employee.js
-- ══════════════════════════════════════════════════════════════════════
-- لیست‌ها دقیقاً مطابق نسخهٔ فعلی فرانت‌اند:
--   educational  = ۲۲ مرحله (۴ زیرمرحلهٔ studying دیگر در آن نیست)
--   defense      = ۱۷ مرحله (getDefaultDefenseSteps2)
--   requirements = ۱۱ مرحله (getDefaultRequirementsSteps)
-- مسیر studying جداست و پیش‌فرض آن در DB ذخیره نمی‌شود (فرانت مدیریت می‌کند)

-- ۷.۱ به‌روزرسانی تابع پیش‌فرض educational (۲۲ مرحله — بدون ۴ زیرمرحله)
CREATE OR REPLACE FUNCTION public.default_educational_steps_with_studying()
RETURNS jsonb
LANGUAGE sql
AS $$
    SELECT jsonb_build_array(
        jsonb_build_object('name', 'در حال تحصیل',     'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'وکالت',             'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'تسویه حساب',        'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'تعدیلات',           'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'مدرک کارشناسی',     'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'استلال عراقی',      'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'ملخص',              'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'محضر و اصالت',      'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'تنضید ایرانداک',    'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'تنضید تجلید',       'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'تجلید',             'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'بارگزاری ایرانداک', 'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'ایجاد گردش',        'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'آزفا',              'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'اسماعیلی',          'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'کتابخانه',          'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'کد',                'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'خروج قطعی',         'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'دریافت مدرک',       'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'تصدیق',             'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'تسویه حساب نهایی',  'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'ارسال',             'completed', false, 'date', NULL, 'notes', '')
    );
$$;

-- ۷.۲ تابع seed هر سه مسیر برای پروفایل دانشجوی جدید
CREATE OR REPLACE FUNCTION public.seed_student_step_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.role = 'student' THEN
        IF NEW.educational_steps IS NULL
           OR jsonb_typeof(NEW.educational_steps) <> 'array'
           OR NEW.educational_steps = '[]'::jsonb THEN
            NEW.educational_steps := public.default_educational_steps_with_studying();
        END IF;

        IF NEW.defense_steps IS NULL
           OR jsonb_typeof(NEW.defense_steps) <> 'array'
           OR NEW.defense_steps = '[]'::jsonb THEN
            NEW.defense_steps := jsonb_build_array(
                jsonb_build_object('name', 'ثبت عنوان',          'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'تنضید',              'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'ترجمه',              'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'استلال',             'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'ملخص',               'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'مدرک لغت(فیش)',      'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'بارگزاری',           'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'تایید استاد',        'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'مشابهت',             'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'مدیر گروه',          'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'معاون',              'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'سفارش',              'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'ق و م',              'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'تسویه حساب',         'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'وکالت',              'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'ثبت نام ایرانداک',   'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'زمان پور',           'completed', false, 'date', NULL, 'notes', '')
            );
        END IF;

        IF NEW.requirements_steps IS NULL
           OR jsonb_typeof(NEW.requirements_steps) <> 'array'
           OR NEW.requirements_steps = '[]'::jsonb THEN
            NEW.requirements_steps := jsonb_build_array(
                jsonb_build_object('name', 'امر اداری',              'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'پروپوزال',               'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'مدرک لغت',               'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'ترجمه پایان نامه فارسی', 'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'ملخص',                   'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'مشابهت',                 'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'ترجمه',                  'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'قطعه',                   'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'لافته',                  'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'چهارنسخه',               'completed', false, 'date', NULL, 'notes', ''),
                jsonb_build_object('name', 'تنضید رساله',            'completed', false, 'date', NULL, 'notes', '')
            );
        END IF;

        NEW.updated_at := now();
    END IF;
    RETURN NEW;
END;
$$;

-- ۷.۳ نصب trigger (نسخهٔ قدیمی که فقط educational را seed می‌کرد حذف می‌شود)
DROP TRIGGER IF EXISTS trg_seed_student_educational_steps ON public.profiles;
DROP TRIGGER IF EXISTS trg_seed_student_step_defaults ON public.profiles;
CREATE TRIGGER trg_seed_student_step_defaults
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.seed_student_step_defaults();

-- ۷.۴ پاک‌سازی progressهای مسیر educational با ایندکس >= 22
--     (۴ زیرمرحلهٔ studying قبلاً در انتهای educational بودند — اکنون مسیر
--      educational دقیقاً ۲۲ مرحله دارد؛ ایندکس‌های ۲۲ به بعد معتبر نیستند)
DELETE FROM public.student_progress
WHERE path_type = 'educational'
  AND step_index >= 22;


-- ══════════════════════════════════════════════════════════════════════
-- ۸. تأیید
-- ══════════════════════════════════════════════════════════════════════
SELECT
    (SELECT to_regclass('public.student_progress'))  AS student_progress_table,
    (SELECT to_regclass('public.step_assignments'))  AS step_assignments_table,
    (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='student_progress'
        AND column_name='student_id')                AS sp_student_id_type,
    (SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles'
        AND column_name='defense_steps')             AS profiles_defense_steps,
    (SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles'
        AND column_name='current_path')              AS profiles_current_path,
    (SELECT count(*) FROM pg_constraint
      WHERE conrelid = 'public.student_progress'::regclass
        AND pg_get_constraintdef(oid) LIKE '%studying%')  AS sp_studying_check_ok,
    (SELECT count(*) FROM pg_constraint
      WHERE conrelid = 'public.student_progress'::regclass
        AND pg_get_constraintdef(oid) LIKE '%status%'
        AND pg_get_constraintdef(oid) LIKE '%3%')          AS sp_status3_check_ok,
    (SELECT count(*) FROM pg_constraint
      WHERE conrelid = 'public.step_assignments'::regclass
        AND pg_get_constraintdef(oid) LIKE '%studying%')  AS sa_studying_check_ok,
    (SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'public.profiles'::regclass
        AND tgname = 'trg_seed_student_step_defaults')    AS seed_trigger,
    'steps_tables_setup v2 OK ✓'                     AS status;
