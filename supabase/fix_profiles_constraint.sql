-- ============================================================
-- fix_profiles_constraint.sql
-- مشکل: جدول profiles به auth.users وابسته است
-- نتیجه: نمی‌توان user بدون Supabase Auth ثبت کرد
-- راه‌حل: FK constraint را حذف می‌کنیم و id را UUID می‌گذاریم
--
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

-- ۱. حذف foreign key constraint از profiles
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- ۲. حالا id یک UUID آزاد است — بدون نیاز به auth.users
-- (مقدار DEFAULT اضافه می‌کنیم تا insert راحت‌تر باشد)
ALTER TABLE public.profiles
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ۳. همچنین student_id باید UNIQUE ولی nullable باشد
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_student_id_key;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_student_id_key UNIQUE NULLS NOT DISTINCT (student_id);

-- ۴. orders.student_id و orders.assigned_agent_id هم باید بتونن
--    به profiles ارجاع بدن حتی اگر auth نداشته باشن — این ok است
--    چون profiles دیگه به auth.users وابسته نیست

-- تمام ✓
-- بعد از اجرا، کاربران بدون Supabase Auth هم می‌توانند در profiles ذخیره شوند
