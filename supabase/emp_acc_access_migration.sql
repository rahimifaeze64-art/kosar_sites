-- ============================================================
-- emp_acc_access_migration.sql
-- اضافه کردن ستون دسترسی به حسابداری کارمندان به جدول profiles
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

-- ۱. اضافه کردن ستون emp_acc_access به profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS emp_acc_access BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.emp_acc_access IS
    'آیا این کارمند به صفحه حسابداری کارمندان دسترسی دارد؟';

-- ۲. ایندکس برای جستجوی سریع
CREATE INDEX IF NOT EXISTS idx_profiles_emp_acc_access
    ON public.profiles(emp_acc_access)
    WHERE emp_acc_access = true;

-- ۳. تأیید
SELECT id, name, username, role, emp_acc_access
FROM public.profiles
WHERE role = 'employee'
ORDER BY name;
