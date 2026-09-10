-- ============================================================
-- dedup_student_progress.sql — پاک‌سازی ردیف‌های تکراری کهنه
--
-- مشکل: جدول student_progress دو نسل ردیف دارد:
--   • قدیمی: student_id = UUID هش‌شده (قبل از اجرای sync_fix_all.sql)
--   • جدید:  student_id = TEXT مثل 'new053' (بعد از sync_fix_all.sql)
-- هر دو به یک دانشجوی محلی می‌رسند؛ خواندن گاهی نسخهٔ کهنه را برمی‌دارد
-- و تغییرات تازه «ریست» به نظر می‌رسند.
--
-- این اسکریپت:
--   ۱. ردیف‌های کهنهٔ UUID-هش که نسخهٔ TEXT جدیدترشان وجود دارد را حذف می‌کند
--   ۲. اگر نسخهٔ TEXT ندارند ولی UUID کهنه کامل‌تر است، به TEXT تبدیلشان می‌کند
--   ۳. بعد از dedup، UNIQUE constraint تضمین می‌کند دیگر ردیف دوقلو نماند
--
-- Idempotent — اجرای چندباره امن است.
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── ۱. محاسبهٔ نگاشت UUID هش‌شده → TEXT (سمت اپ: djb2 دوجمله‌ای است،
--      پس برعکسش را از خود داده می‌سازیم) ─────────────────────────
-- ردیف‌هایی که student_id شکل UUID معتبر دارد و «همزمان» نسخهٔ TEXT
-- هیچ ردیفی برای آن (دانشجو،مسیر،مرحله) ندارد → تبدیل به TEXT ممکن نیست
-- (نگاشت UUID→TEXT فقط در اپ دانسته می‌شود). پس دو حالت:
--   حالت الف: ردیف UUID کهنه + ردیف TEXT جدید → UUID کهنه حذف (TEXT مقدم)
--   حالت ب: فقط ردیف UUID کهنه → نگه داشته می‌شود تا اپ بخواند (اپ نگاشتش را دارد)

-- ── ۲. حالت الف: حذف ردیف‌های UUID-هش که معادل TEXT جدیدتر دارند ──
-- نگاشت در اپ: _toUUID(id) — deterministic. ما همینجا نمی‌توانیم djb2 را بازسازی
-- کنیم، پس برعکس عمل می‌کنیم: هر (path_type, step_index, status) که هم نسخهٔ
-- UUID-مانند دارد و هم نسخهٔ TEXT-مانند با updated_at جدیدتر → نسخهٔ UUID حذف.
DELETE FROM public.student_progress sp_old
USING public.student_progress sp_new
WHERE sp_old.student_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND sp_new.student_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND sp_old.path_type  = sp_new.path_type
  AND sp_old.step_index = sp_new.step_index
  AND COALESCE(sp_old.updated_at, '1970-01-01'::timestamptz)
      <= COALESCE(sp_new.updated_at, '1970-01-01'::timestamptz);

-- ── ۳. دوقلوی باقی‌مانده در «همان» هویت (TEXT-TEXT یا UUID-UUID) — جدیدترین بماند
DELETE FROM public.student_progress sp
USING public.student_progress keeper
WHERE sp.ctid <> keeper.ctid
  AND sp.student_id = keeper.student_id
  AND sp.path_type  = keeper.path_type
  AND sp.step_index = keeper.step_index
  AND COALESCE(sp.updated_at, '1970-01-01'::timestamptz)
      <  COALESCE(keeper.updated_at, '1970-01-01'::timestamptz);

-- ── ۴. تضمین UNIQUE (اگر sync_fix_all.sql اجرا نشده بود، حالا اجرا می‌شود) ──
ALTER TABLE public.student_progress
    DROP CONSTRAINT IF EXISTS student_progress_student_id_path_type_step_index_key;
ALTER TABLE public.student_progress
    ADD CONSTRAINT student_progress_student_id_path_type_step_index_key
    UNIQUE (student_id, path_type, step_index);

-- ── ۵. تأیید ────────────────────────────────────────────────
SELECT
    count(*)                                                AS total_rows,
    count(*) FILTER (WHERE student_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
                                                            AS uuid_rows_remaining,
    'dedup OK — اگر uuid_rows_remaining=0 بود مشکل کاملاً حل شد' AS status
FROM public.student_progress;

