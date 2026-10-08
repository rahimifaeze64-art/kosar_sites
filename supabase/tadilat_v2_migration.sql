-- ============================================================
-- tadilat_v2_migration.sql
-- ارتقای جدول‌های تعدیلات:
--   • کد پیگیری ۵ رقمی خودکار (code)
--   • منبع «دستی» برای ثبت دستی کارمند/مدیر
--   • ثبت‌کنندهٔ رکورد (created_by / created_by_name)
--   • ایندکس جستجوی سریع کد
--
-- اجرا در: Supabase Dashboard → SQL Editor
-- ایمن برای اجرای مجدد (idempotent)
-- ترتیب مهم است: این فایل را بعد از tadilat_telegram_migration.sql اجرا کنید.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- ۱. کد پیگیری ۵ رقمی
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.tadilat_requests
    ADD COLUMN IF NOT EXISTS code TEXT;

COMMENT ON COLUMN public.tadilat_requests.code IS
    'کد پیگیری ۵ رقمی که به دانشجو نشان داده می‌شود (جدا از id داخلی)';

-- پر کردن رکوردهای موجود بدون تصادم (شمارهٔ ترتیبی از ۱۰۰۰۰)
WITH numbered AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
    FROM public.tadilat_requests
    WHERE code IS NULL OR code = ''
)
UPDATE public.tadilat_requests t
SET code = lpad((10000 + n.rn - 1)::text, 5, '0')
FROM numbered n
WHERE t.id = n.id;

-- یکتا بودن کد
CREATE UNIQUE INDEX IF NOT EXISTS uq_tadilat_requests_code
    ON public.tadilat_requests (code);

-- هر رکورد تازه، کد خودش را می‌گیرد (برای همهٔ مسیرها: تلگرام، ربات، ثبت دستی)
CREATE OR REPLACE FUNCTION public.tadilat_set_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    candidate TEXT;
    guard     INT := 0;
BEGIN
    IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
        RETURN NEW;
    END IF;
    LOOP
        candidate := lpad((floor(random() * 90000) + 10000)::int::text, 5, '0');
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.tadilat_requests WHERE code = candidate
        );
        guard := guard + 1;
        IF guard >= 200 THEN
            EXIT;   -- در عمل هرگز پیش نمی‌آید
        END IF;
    END LOOP;
    NEW.code := candidate;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tadilat_set_code ON public.tadilat_requests;
CREATE TRIGGER trg_tadilat_set_code
    BEFORE INSERT ON public.tadilat_requests
    FOR EACH ROW EXECUTE FUNCTION public.tadilat_set_code();

CREATE INDEX IF NOT EXISTS idx_tadilat_requests_code
    ON public.tadilat_requests (code);


-- ════════════════════════════════════════════════════════════
-- ۲. منبع «دستی» + ثبت‌کننده
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.tadilat_requests
    ADD COLUMN IF NOT EXISTS created_by      TEXT,
    ADD COLUMN IF NOT EXISTS created_by_name TEXT;

COMMENT ON COLUMN public.tadilat_requests.created_by IS
    'کاربری که رکورد را دستی ثبت کرده (profiles.id)';

-- source باید manual را هم بپذیرد
ALTER TABLE public.tadilat_requests
    DROP CONSTRAINT IF EXISTS tadilat_requests_source_check;
ALTER TABLE public.tadilat_requests
    ADD CONSTRAINT tadilat_requests_source_check
    CHECK (source IN ('mini_app', 'telegram_bot', 'manual'));

-- نام منبع در صورت نبود مقدار قبلی
UPDATE public.tadilat_requests SET source = 'mini_app' WHERE source IS NULL;


-- ════════════════════════════════════════════════════════════
-- ۳. تأیید
-- ════════════════════════════════════════════════════════════
SELECT
    'tadilat v2 ready ✓' AS status,
    (SELECT count(*) FROM public.tadilat_requests)                     AS requests,
    (SELECT count(*) FROM public.tadilat_requests WHERE code IS NULL)  AS without_code,
    (SELECT count(DISTINCT code) FROM public.tadilat_requests)         AS distinct_codes;
