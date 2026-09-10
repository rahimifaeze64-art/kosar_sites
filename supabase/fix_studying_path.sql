-- ============================================================
-- fix_studying_path.sql
-- مجاز کردن path_type='studying' در جداول student_progress و
-- step_assignments (CHECK constraint فعلی فقط سه مسیر را می‌پذیرد)
-- + اصلاح مراحل: حذف ۴ زیرمرحلهٔ «در حال تحصیل» از انتهای
--   educational_steps و ساخت progress مستقل studying
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── ۱. رفع CHECK constraint — پذیرش 'studying' ──────────────
ALTER TABLE public.student_progress
    DROP CONSTRAINT IF EXISTS student_progress_path_type_check;
ALTER TABLE public.student_progress
    DROP CONSTRAINT IF EXISTS student_progress_path_type_check1;

ALTER TABLE public.student_progress
    ADD CONSTRAINT student_progress_path_type_check
    CHECK (path_type IN ('defense','educational','requirements','studying'));

ALTER TABLE public.step_assignments
    DROP CONSTRAINT IF EXISTS step_assignments_path_type_check;
ALTER TABLE public.step_assignments
    DROP CONSTRAINT IF EXISTS step_assignments_path_type_check1;

ALTER TABLE public.step_assignments
    ADD CONSTRAINT step_assignments_path_type_check
    CHECK (path_type IN ('defense','educational','requirements','studying'));

-- ── ۲. تابع پیش‌فرض جدید — بدون ۴ زیرمرحله در انتهای educational ──
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

-- ── ۳. حذف ۴ زیرمرحله از انتهای educational_steps همهٔ دانشجویان ──
--    (Idempotent — فقط وقتی ۴ مرحله در انتها باشند حذف می‌کند)
UPDATE public.profiles AS p
SET educational_steps = (
        SELECT jsonb_agg(el ORDER BY ord)
        FROM jsonb_array_elements(p.educational_steps) WITH ORDINALITY AS t(el, ord)
        WHERE ord <= jsonb_array_length(p.educational_steps) - 4
           OR (el ->> 'name') NOT IN ('پاس کردن واحد ها','پرداخت اقساط','قفل کردن دروس','تنزیل نمرات')
    ),
    updated_at = now()
WHERE p.role = 'student'
  AND jsonb_typeof(p.educational_steps) = 'array'
  AND jsonb_array_length(p.educational_steps) >= 4
  -- فقط اگر ۴ مرحلهٔ آخر دقیقاً همین زیرمرحله‌ها باشند (بدون جابجایی دستی)
  AND (
      SELECT jsonb_agg(el ->> 'name' ORDER BY ord)
      FROM jsonb_array_elements(p.educational_steps) WITH ORDINALITY AS t(el, ord)
      WHERE ord > jsonb_array_length(p.educational_steps) - 4
  ) = '["پاس کردن واحد ها","پرداخت اقساط","قفل کردن دروس","تنزیل نمرات"]'::jsonb;

-- ── ۴. بازسازی progress مسیر studying از روی وضعیت قبلی ──
--    (تیک‌های ثبت‌شدهٔ زیرمرحله‌ها به path_type='studying' منتقل می‌شود)
INSERT INTO public.student_progress (student_id, path_type, step_index, status, updated_at)
SELECT p.id, 'studying', sub.idx, sub.st, now()
FROM public.profiles AS p
CROSS JOIN LATERAL (
    SELECT (jsonb_array_length(p.educational_steps) - 5 + ord) AS orig_idx,
           (ord - 1) AS idx,
           CASE WHEN (el ->> 'completed') = 'true' THEN 2 ELSE 0 END AS st
    FROM jsonb_array_elements(p.educational_steps) WITH ORDINALITY AS t(el, ord)
    WHERE ord > jsonb_array_length(p.educational_steps) - 5
) AS sub
WHERE p.role = 'student'
  AND jsonb_typeof(p.educational_steps) = 'array'
  AND jsonb_array_length(p.educational_steps) >= 5
ON CONFLICT (student_id, path_type, step_index) DO NOTHING;

-- ── ۵. پاک‌سازی progressهای مسیر educational مربوط به ۴ زیرمرحله ──
--    (ایندکس‌های ۲۲ تا ۲۵ دیگر در مسیر educational معنا ندارند)
DELETE FROM public.student_progress
WHERE path_type = 'educational'
  AND step_index >= 22;

-- ── ۶. تأیید ────────────────────────────────────────────────
SELECT
    count(*) FILTER (WHERE path_type = 'studying') AS studying_progress_rows,
    (SELECT count(*) FROM public.profiles
      WHERE role = 'student'
        AND jsonb_typeof(educational_steps) = 'array'
        AND jsonb_array_length(educational_steps) = 22) AS students_with_22_steps,
    'fix_studying_path OK ✓' AS status
FROM public.student_progress;
