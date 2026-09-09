-- ============================================================
-- add_currently_studying_step.sql
-- افزودن فاز «در حال تحصیل» با ۴ زیرمرحله به مسیر آموزشی +
-- انتقال مسیر فعال همهٔ دانشجویان به مسیر آموزشی (current_path)
--   ۱. بک‌فیل همه دانشجویان موجود (profiles با role='student')
--   ۲. تنظیم به‌عنوان پیش‌فرض دانشجویان جدید (trigger)
--   ۳. افزودن زیرمرحله‌ها به آرایه‌های موجود
--   ۴. مایگریشن current_path: مسیر همهٔ دانشجویان → 'educational'
--   5. Idempotent — اجرای چندباره امن است
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ۰. اطمینان از وجود updated_at (front-end هنگام sync می‌نویسد)
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ════════════════════════════════════════════════════════════
-- ۱. تابع کمکی: آرایه پیش‌فرض مراحل آموزشی
--    فاز «در حال تحصیل» + ۴ زیرمرحله (پاس کردن واحد ها، پرداخت
--    اقساط، قفل کردن دروس، تنزیل نمرات) + ۲۱ مرحله اصلی
--    (ترتیب دقیقاً مطابق _getDefaultEducationalStepsBase() در
--     js/employee.js و DEFAULT_STEPS.educational در
--     student-progress-tracking.html — برای هم‌ترازی ایندکس‌ها)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.default_educational_steps_with_studying()
RETURNS jsonb
LANGUAGE sql
AS $$
    SELECT jsonb_build_array(
        -- فاز جدید + زیرمرحله‌ها
        jsonb_build_object('name', 'در حال تحصیل',     'completed', false, 'date', NULL, 'notes', ''),
        -- ۲۱ مرحله اصلی (مطابق کد)
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
        jsonb_build_object('name', 'ارسال',             'completed', false, 'date', NULL, 'notes', ''),
        -- زیرمرحله‌های فاز «در حال تحصیل» (در انتها تا ایندکس prog_ مراحل قبلی شیفت نخورد)
        jsonb_build_object('name', 'پاس کردن واحد ها',  'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'پرداخت اقساط',      'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'قفل کردن دروس',     'completed', false, 'date', NULL, 'notes', ''),
        jsonb_build_object('name', 'تنزیل نمرات',       'completed', false, 'date', NULL, 'notes', '')
    );
$$;

-- ════════════════════════════════════════════════════════════
-- ۲. بک‌فیل دانشجویان موجود (Idempotent)
--    - اگر مرحله «در حال تحصیل» وجود دارد → دست نمی‌زند
--    - اگر آرایه خالی/NULL/غیرآرایه است → آرایه پیش‌فرض کامل
--    - اگر آرایه پر است و مرحله ندارد → مرحله جدید به ابتدا
--      اضافه می‌شود (وضعیت completed مراحل قبلی حفظ می‌شود)
-- ════════════════════════════════════════════════════════════
UPDATE public.profiles AS p
SET educational_steps = CASE
        -- آرایه خالی / NULL / غیرآرایه → پیش‌فرض برای کامل شدن آرایه
        WHEN p.educational_steps IS NULL
          OR jsonb_typeof(p.educational_steps) <> 'array'
          OR p.educational_steps = '[]'::jsonb
        THEN public.default_educational_steps_with_studying()
        -- آرایه پر → فقط مرحله جدید به ابتدا
        ELSE jsonb_build_array(
                 jsonb_build_object('name', 'در حال تحصیل',
                                    'completed', false,
                                    'date', NULL,
                                    'notes', '')
             ) || p.educational_steps
    END,
    updated_at = now()
WHERE p.role = 'student'
  AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
                 CASE WHEN jsonb_typeof(p.educational_steps) = 'array'
                      THEN p.educational_steps
                      ELSE '[]'::jsonb
                 END
             ) AS el
        WHERE el ->> 'name' = 'در حال تحصیل'
    );

-- ════════════════════════════════════════════════════════════
-- ۳. پیش‌فرض برای دانشجویان جدید (Trigger)
--    فرم ثبت دانشجو ستون educational_steps را نمی‌فرستد؛
--   این trigger هنگام INSERT پروفایل دانشجو آرایه پیش‌فرض
--   (با مرحله «در حال تحصیل» در ابتدا) را seed می‌کند.
--    فقط پروفایل‌های role='student' و فقط وقتی آرایه خالی است.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.seed_student_educational_steps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.role = 'student'
       AND (NEW.educational_steps IS NULL
            OR jsonb_typeof(NEW.educational_steps) <> 'array'
            OR NEW.educational_steps = '[]'::jsonb) THEN
        NEW.educational_steps := public.default_educational_steps_with_studying();
        NEW.updated_at := now();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_student_educational_steps ON public.profiles;
CREATE TRIGGER trg_seed_student_educational_steps
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.seed_student_educational_steps();

-- ════════════════════════════════════════════════════════════
-- ۴. افزودن زیرمرحله‌های فاز «در حال تحصیل» به انتهای آرایه‌های
--    موجود (Idempotent) — فقط اسم‌هایی که هنوز ندارند اضافه می‌شود
--    نکته: از LATERAL استفاده نمی‌کنیم چون در «UPDATE ... FROM»
--    نمی‌توان به جدول هدف (p) ارجاع داد (خطای 42P10)؛ به‌جای آن
--    از CTE استفاده شده که ارجاع به p داخل آن مجاز است.
-- ════════════════════════════════════════════════════════════
WITH sub_names(ord, name) AS (
    VALUES
        (1, 'پاس کردن واحد ها'),
        (2, 'پرداخت اقساط'),
        (3, 'قفل کردن دروس'),
        (4, 'تنزیل نمرات')
),
missing AS (
    SELECT p.id,
           jsonb_agg(
               jsonb_build_object('name', j.name, 'completed', false, 'date', NULL, 'notes', '')
               ORDER BY j.ord
           ) AS missing_steps
    FROM public.profiles AS p
    CROSS JOIN sub_names AS j
    WHERE p.role = 'student'
      AND jsonb_typeof(p.educational_steps) = 'array'
      AND p.educational_steps <> '[]'::jsonb
      AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements(p.educational_steps) AS el
              WHERE el ->> 'name' = j.name
          )
    GROUP BY p.id
)
UPDATE public.profiles AS p
SET educational_steps = p.educational_steps || m.missing_steps,
    updated_at = now()
FROM missing AS m
WHERE p.id = m.id;

-- ════════════════════════════════════════════════════════════
-- ۵. مایگریشن مسیر فعال: انتقال «همهٔ» دانشجویان به فاز «در حال تحصیل»
--    ('studying' — مسیر مستقل جدید برای دانشجوی پیش از دفاع)
--    همهٔ مقادیر قبلی (defense / requirements / educational / NULL / ...) → 'studying'
--    (Idempotent — اجرای دوباره اثری ندارد)
-- ════════════════════════════════════════════════════════════
UPDATE public.profiles
SET current_path = 'studying',
    updated_at   = now()
WHERE role = 'student'
  AND graduated IS NOT TRUE
  AND current_path IS DISTINCT FROM 'studying';

-- ════════════════════════════════════════════════════════════
-- ۶. تأیید نهایی
-- ════════════════════════════════════════════════════════════
SELECT
    count(*) FILTER (
        WHERE jsonb_typeof(educational_steps) = 'array'
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                       CASE WHEN jsonb_typeof(educational_steps) = 'array'
                            THEN educational_steps
                            ELSE '[]'::jsonb
                       END
                   ) AS el
              WHERE el ->> 'name' = 'در حال تحصیل'
          )
    ) AS students_with_studying_step,
    count(*) FILTER (
        WHERE jsonb_typeof(educational_steps) = 'array'
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                       CASE WHEN jsonb_typeof(educational_steps) = 'array'
                            THEN educational_steps
                            ELSE '[]'::jsonb
                       END
                   ) AS el
              WHERE el ->> 'name' = 'قفل کردن دروس'
          )
    ) AS students_with_substeps,
    count(*) FILTER (WHERE current_path = 'studying')                     AS students_on_studying,
    count(*) FILTER (WHERE current_path IS DISTINCT FROM 'studying'
                       AND graduated IS NOT TRUE)                         AS students_not_yet_migrated,
    count(*) AS total_students,
    (SELECT to_regproc('public.default_educational_steps_with_studying')) AS default_fn,
    (SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'public.profiles'::regclass
        AND tgname  = 'trg_seed_student_educational_steps') AS new_student_trigger,
    'add_currently_studying_step OK ✓' AS status
FROM public.profiles
WHERE role = 'student';