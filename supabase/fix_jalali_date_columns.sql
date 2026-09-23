-- ============================================================
-- fix_jalali_date_columns.sql
-- رفع خطای: ERROR: 22008: date/time field value out of range: "1405-06-31"
--
-- علت: تاریخ‌های سیستم شمسی‌اند (مثل 1405-06-31) ولی ستون DB از نوع
--   DATE است. PostgreSQL آن را میلادی می‌خواند و چون «۳۱ ژوئن» وجود ندارد
--   خطا می‌دهد. راه‌حل: ستون تاریخ باید TEXT باشد.
--
-- Supabase Dashboard → SQL Editor → Run
-- (اجرای چندباره بی‌خطر است)
-- ============================================================

DO $$
DECLARE
    tbl text;
    col record;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['work_hours','work_gifts','work_deductions','work_settlements'] LOOP
        IF to_regclass('public.' || tbl) IS NULL THEN CONTINUE; END IF;
        FOR col IN
            SELECT data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'date'
        LOOP
            IF col.data_type <> 'text' THEN
                EXECUTE format(
                    'ALTER TABLE public.%I ALTER COLUMN date TYPE TEXT USING to_char(date, ''YYYY-MM-DD'')',
                    tbl
                );
                RAISE NOTICE 'Converted %.date to TEXT', tbl;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- تأیید — هر دو ستون باید text باشند
SELECT
    (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='work_hours'
        AND column_name='date')          AS work_hours_date_type,
    (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='work_gifts'
        AND column_name='date')          AS gifts_date_type,
    (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='work_deductions'
        AND column_name='date')          AS deductions_date_type,
    (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='work_settlements'
        AND column_name='date')          AS settlements_date_type,
    'jalali date columns → text OK ✓'    AS status;
