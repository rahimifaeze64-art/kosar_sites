-- ============================================================
-- requirements_excluded_status.sql
-- افزودن وضعیت «لازم نیست» (excluded) برای مراحل ملزومات.
--
-- وضعیت‌های student_progress:
--   0 = ناتمام
--   1 = در حال انجام
--   2 = تکمیل شده
--   3 = متوقف شده
--   4 = لازم نیست (این ملزومه برای این دانشجو حذف شده — زرد و غیرقابل کلیک)
--
-- این مایگریشن CHECK فعلی status را به 0..4 گسترش می‌دهد.
-- اجرا در: Supabase Dashboard → SQL Editor — ایمن برای اجرای مجدد.
-- ============================================================

DO $$
DECLARE c RECORD;
BEGIN
    -- حذف هر CHECK موجود روی status (نام‌ها ممکن است متفاوت باشند)
    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.student_progress'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.student_progress DROP CONSTRAINT %I', c.conname);
    END LOOP;

    -- CHECK جدید با پذیرش وضعیت ۴
    ALTER TABLE public.student_progress
        ADD CONSTRAINT student_progress_status_check
        CHECK (status IN (0,1,2,3,4));
END $$;

COMMENT ON COLUMN public.student_progress.status IS
    '0=ناتمام 1=در حال انجام 2=تکمیل 3=متوقف 4=لازم نیست (ملزومهٔ حذف‌شده)';

SELECT 'requirements_excluded_status OK ✓' AS status;
