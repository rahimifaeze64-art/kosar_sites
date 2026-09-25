-- ============================================================
-- student_steps_report.sql  (نسخهٔ تک‌کوئری — همه‌چیز در یک خروجی)
-- فقط خواندن؛ هیچ تغییری نمی‌دهد.
--
-- row_kind:
--   student     = دانشجوی واقعی (وصل به profiles) با پیشرفت
--   no_progress = دانشجوی واقعی بدون هیچ ردیف پیشرفت
--   orphan      = ردیف پیشرفت بدون پروفایل (شناسهٔ دموی داخلی)
--
-- وضعیت‌ها: 0=ناتمام 1=در حال انجام 2=تکمیل 3=متوقف
-- «مرحله فعلی» = کمترین step_index با status ≠ 2
-- ============================================================

WITH map(path, idx, name) AS (VALUES
    ('defense',0,'ثبت عنوان'),('defense',1,'تنضید'),('defense',2,'ترجمه'),('defense',3,'استلال'),
    ('defense',4,'ملخص'),('defense',5,'مدرک لغت(فیش)'),('defense',6,'بارگزاری'),('defense',7,'تایید استاد'),
    ('defense',8,'مشابهت'),('defense',9,'مدیر گروه'),('defense',10,'معاون'),('defense',11,'سفارش'),
    ('defense',12,'ق و م'),('defense',13,'تسویه حساب'),('defense',14,'وکالت'),('defense',15,'ثبت نام ایرانداک'),
    ('defense',16,'زمان پور'),
    ('educational',0,'در حال تحصیل'),('educational',1,'وکالت'),('educational',2,'تسویه حساب'),
    ('educational',3,'تعدیلات'),('educational',4,'مدرک کارشناسی'),('educational',5,'استلال عراقی'),
    ('educational',6,'ملخص'),('educational',7,'محضر و اصالت'),('educational',8,'تنضید ایرانداک'),
    ('educational',9,'تنضید تجلید'),('educational',10,'تجلید'),('educational',11,'بارگزاری ایرانداک'),
    ('educational',12,'ایجاد گردش'),('educational',13,'آزفا'),('educational',14,'اسماعیلی'),
    ('educational',15,'کتابخانه'),('educational',16,'کد'),('educational',17,'خروج قطعی'),
    ('educational',18,'دریافت مدرک'),('educational',19,'تصدیق'),('educational',20,'تسویه حساب نهایی'),
    ('educational',21,'ارسال'),
    ('requirements',0,'امر اداری'),('requirements',1,'پروپوزال'),('requirements',2,'مدرک لغت'),
    ('requirements',3,'ترجمه پایان نامه فارسی'),('requirements',4,'ملخص'),('requirements',5,'مشابهت'),
    ('requirements',6,'ترجمه'),('requirements',7,'قطعه'),('requirements',8,'لافته'),
    ('requirements',9,'چهارنسخه'),('requirements',10,'تنضید رساله'),
    ('studying',0,'در حال تحصیل'),('studying',1,'پاس کردن واحد ها'),('studying',2,'پرداخت اقساط'),
    ('studying',3,'قفل کردن دروس'),('studying',4,'تنزیل نمرات')
),
agg AS (
    SELECT
        sp.student_id,
        sp.path_type,
        min(sp.step_index) FILTER (WHERE sp.status <> 2) AS cur_idx,
        count(*) FILTER (WHERE sp.status = 2)             AS done,
        count(*)                                          AS total,
        string_agg(sp.step_index || ':' || sp.status, ',' ORDER BY sp.step_index) AS raw
    FROM public.student_progress sp
    GROUP BY sp.student_id, sp.path_type
),
with_profile AS (
    SELECT
        CASE WHEN p.id IS NULL THEN 'orphan' ELSE 'student' END AS row_kind,
        COALESCE(p.name, '(بدون پروفایل)')                      AS student_name,
        p.student_id                                            AS sid,
        a.student_id                                            AS profile_id,
        CASE
            WHEN p.id IS NOT NULL THEN p.current_path
            WHEN a.student_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN 'uuid'
            WHEN a.student_id ~ '^(grad|std)[0-9]+$' THEN 'demo'
            WHEN a.student_id ~ '^new[0-9]+$'        THEN 'new'
            ELSE 'other'
        END                                                     AS current_path,
        a.path_type,
        COALESCE(m.name, CASE WHEN a.cur_idx IS NULL THEN 'همه تکمیل' ELSE 'ایندکس ' || a.cur_idx END) AS current_step,
        a.cur_idx  AS step_index,
        a.done     AS completed,
        a.total    AS tracked_rows,
        a.raw      AS progress_raw
    FROM agg a
    LEFT JOIN public.profiles p ON p.id = a.student_id
    LEFT JOIN map m ON m.path = a.path_type AND m.idx = a.cur_idx
),
no_progress AS (
    SELECT
        'no_progress' AS row_kind,
        p.name        AS student_name,
        p.student_id  AS sid,
        p.id          AS profile_id,
        p.current_path,
        NULL::text    AS path_type,
        NULL::text    AS current_step,
        NULL::int     AS step_index,
        NULL::bigint  AS completed,
        NULL::bigint  AS tracked_rows,
        NULL::text    AS progress_raw
    FROM public.profiles p
    WHERE p.role = 'student'
      AND NOT EXISTS (SELECT 1 FROM public.student_progress sp WHERE sp.student_id = p.id)
)
SELECT
    row_kind, student_name, sid, profile_id, current_path, path_type,
    current_step, step_index, completed, tracked_rows, progress_raw
FROM (
    SELECT * FROM with_profile
    UNION ALL
    SELECT * FROM no_progress
) u
-- پیش‌فرض: فقط ردیف‌های دارای پیشرفت + دموی‌ها.
-- اگر فهرست «دانشجویان بدون پیشرفت» را هم می‌خواهی، خط WHERE زیر را کامنت کن.
WHERE row_kind <> 'no_progress'
ORDER BY row_kind, student_name NULLS LAST, path_type NULLS LAST;
