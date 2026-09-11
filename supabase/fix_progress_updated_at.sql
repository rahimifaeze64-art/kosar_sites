-- ============================================================
-- fix_progress_updated_at.sql — اجرا در Supabase SQL Editor
--
-- ریشهٔ باگ «ریست شدن مراحل در مرورگر جدید»:
-- ردیف‌های قدیمی student_progress ستون updated_at خالی (NULL) داشتند.
-- کد کلاینت از updated_at برای تشخیص «کهنه/تازه» استفاده می‌کند؛
-- مهر خالی = 0 → گارد فکر می‌کرد «دیتابیس داده ندارد» و به مرورگر
-- تازه اجازهٔ نوشتن آرایهٔ همه-صفر (پیش‌فرض students_data) را می‌داد
-- → مراحل تکمیل‌شده در DB صفر می‌شدند.
--
-- این فایل:
--   ۱. برای ردیف‌های بدون updated_at یک مقدار پایه می‌گذارد
--   ۲. DEFAULT و تریگر touch برای updated_at می‌سازد تا دیگر NULL نشود
-- ============================================================

-- ۱. پر کردن ردیف‌های NULL با زمان قدیمی (تا دادهٔ واقعی حفظ شود)
UPDATE public.student_progress
SET updated_at = '2024-01-01T00:00:00.000Z'
WHERE updated_at IS NULL;

-- ۲. DEFAULT برای ردیف‌های جدید
ALTER TABLE public.student_progress
    ALTER COLUMN updated_at SET DEFAULT NOW();

-- ۳. تریگر touch: هر UPDATE خودکار updated_at را تازه کند
CREATE OR REPLACE FUNCTION public.touch_student_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_student_progress_updated_at ON public.student_progress;
CREATE TRIGGER trg_touch_student_progress_updated_at
    BEFORE UPDATE ON public.student_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_student_progress_updated_at();

-- ۴. بررسی نهایی: تعداد ردیف‌های بدون updated_at باید ۰ باشد
SELECT
    COUNT(*)                                          AS "کل ردیف‌ها",
    COUNT(*) FILTER (WHERE updated_at IS NULL)        AS "بدون updated_at (باید ۰ باشد)"
FROM public.student_progress;
