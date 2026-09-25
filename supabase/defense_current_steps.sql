-- ============================================================
-- defense_current_steps.sql
-- چاپ «مرحله فعلی» دانشجویان حاضر در مسیر گردش دفاع، مستقیم از دیتابیس.
-- فقط خواندن است — هیچ تغییری نمی‌دهد.
--
-- مرحله فعلی = کمترین step_index که status آن ۲ (تکمیل) نیست.
--   status: 0=ناتمام  1=در حال انجام  2=تکمیل  3=متوقف
-- نام مراحل بر اساس لیست پیش‌فرضِ getDefaultDefenseSteps2 در فرانت.
-- اگر مراحل سفارشی شده‌اند، نام اندیس‌ها ممکن است متفاوت باشد.
-- ============================================================

-- ۱) خلاصهٔ وضعیت ردیف‌های دفاع (برای تشخیص ریست/فقدان داده)
SELECT status, count(*) AS rows_count
FROM public.student_progress
WHERE path_type = 'defense'
GROUP BY status
ORDER BY status;

-- ۲) مرحله فعلی هر دانشجوی حاضر در مسیر دفاع
WITH steps(idx, name) AS (VALUES
    (0,  'ثبت عنوان'),
    (1,  'تنضید'),
    (2,  'ترجمه'),
    (3,  'استلال'),
    (4,  'ملخص'),
    (5,  'مدرک لغت(فیش)'),
    (6,  'بارگزاری'),
    (7,  'تایید استاد'),
    (8,  'مشابهت'),
    (9,  'مدیر گروه'),
    (10, 'معاون'),
    (11, 'سفارش'),
    (12, 'ق و م'),
    (13, 'تسویه حساب'),
    (14, 'وکالت'),
    (15, 'ثبت نام ایرانداک'),
    (16, 'زمان پور')
),
cur AS (
    SELECT
        p.id,
        p.name,
        p.student_id AS sid,
        (SELECT min(sp.step_index) FROM public.student_progress sp
          WHERE sp.student_id = p.id AND sp.path_type = 'defense' AND sp.status <> 2) AS cur_idx,
        (SELECT count(*) FROM public.student_progress sp
          WHERE sp.student_id = p.id AND sp.path_type = 'defense' AND sp.status = 2) AS done_count,
        (SELECT count(*) FROM public.student_progress sp
          WHERE sp.student_id = p.id AND sp.path_type = 'defense') AS tracked_count,
        (SELECT string_agg(sp.step_index || ':' || sp.status, ',' ORDER BY sp.step_index)
           FROM public.student_progress sp
          WHERE sp.student_id = p.id AND sp.path_type = 'defense') AS progress_raw
    FROM public.profiles p
    WHERE p.role = 'student' AND p.current_path = 'defense'
)
SELECT
    c.name,
    c.sid,
    COALESCE(s.name,
             CASE WHEN c.cur_idx IS NULL THEN 'همهٔ مراحل تکمیل شده'
                  ELSE 'ایندکس ' || c.cur_idx END) AS current_step,
    c.cur_idx        AS current_step_index,
    c.done_count     AS completed_steps,
    c.tracked_count  AS tracked_rows,
    c.progress_raw
FROM cur c
LEFT JOIN steps s ON s.idx = c.cur_idx
ORDER BY c.cur_idx NULLS LAST, c.name;

-- ۳) ردیف‌های دفاعی که به هیچ پروفایلی متصل نیستند (احتمالاً با student_id نوع UUID قدیمی)
SELECT
    sp.student_id,
    count(*) AS rows_count,
    string_agg(sp.step_index || ':' || sp.status, ',' ORDER BY sp.step_index) AS progress
FROM public.student_progress sp
WHERE sp.path_type = 'defense'
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = sp.student_id)
GROUP BY sp.student_id
ORDER BY sp.student_id;

-- ۴) دانشجویان دفاعی که هیچ ردیف پیشرفتی در دیتابیس ندارند (خالی بودن یا گم‌شدن)
SELECT p.name, p.student_id
FROM public.profiles p
WHERE p.role = 'student' AND p.current_path = 'defense'
  AND NOT EXISTS (SELECT 1 FROM public.student_progress sp
                  WHERE sp.student_id = p.id AND sp.path_type = 'defense')
ORDER BY p.name;

-- ============================================================
-- ۵) مرحله فعلی دفاع برای «همهٔ دانشجویان واقعی» (مستقل از current_path)
--    اگر مراحل پیشرفته‌ات ذخیره شده باشند اینجا با done_count > 0 دیده می‌شوند.
-- ============================================================
WITH steps(idx, name) AS (VALUES
    (0,  'ثبت عنوان'),
    (1,  'تنضید'),
    (2,  'ترجمه'),
    (3,  'استلال'),
    (4,  'ملخص'),
    (5,  'مدرک لغت(فیش)'),
    (6,  'بارگزاری'),
    (7,  'تایید استاد'),
    (8,  'مشابهت'),
    (9,  'مدیر گروه'),
    (10, 'معاون'),
    (11, 'سفارش'),
    (12, 'ق و م'),
    (13, 'تسویه حساب'),
    (14, 'وکالت'),
    (15, 'ثبت نام ایرانداک'),
    (16, 'زمان پور')
),
agg AS (
    SELECT
        sp.student_id,
        min(sp.step_index) FILTER (WHERE sp.status <> 2) AS cur_idx,
        count(*) FILTER (WHERE sp.status = 2)            AS done_count,
        count(*)                                         AS tracked_count,
        string_agg(sp.step_index || ':' || sp.status, ',' ORDER BY sp.step_index) AS progress_raw
    FROM public.student_progress sp
    WHERE sp.path_type = 'defense'
    GROUP BY sp.student_id
)
SELECT
    p.name,
    p.student_id                       AS sid,
    p.current_path,
    COALESCE(s.name,
             CASE WHEN a.cur_idx IS NULL THEN 'همهٔ مراحل تکمیل شده'
                  ELSE 'ایندکس ' || a.cur_idx END) AS current_step,
    a.cur_idx          AS current_step_index,
    a.done_count       AS completed_steps,
    a.tracked_count    AS tracked_rows,
    a.progress_raw
FROM agg a
JOIN public.profiles p ON p.id = a.student_id
LEFT JOIN steps s ON s.idx = a.cur_idx
ORDER BY a.done_count DESC, a.cur_idx NULLS LAST, p.name;

-- ============================================================
-- ۶) خلاصهٔ ردیف‌های «دموی داخلی» (بدون پروفایل) — قابل پاک‌سازی
-- ============================================================
SELECT
    sp.student_id,
    count(*) AS rows_count,
    count(*) FILTER (WHERE sp.status = 2) AS completed
FROM public.student_progress sp
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = sp.student_id)
GROUP BY sp.student_id
ORDER BY sp.student_id;
