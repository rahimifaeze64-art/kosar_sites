-- ============================================================
-- اجرای این اسکریپت در Supabase Dashboard → SQL Editor
-- هدف: رفع مشکل RLS که باعث می‌شود یادداشت‌ها ذخیره/بازیابی نشوند
-- ============================================================

-- ۱. غیرفعال‌سازی RLS (چون اپ از Supabase Auth استفاده نمی‌کند)
ALTER TABLE personal_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE personal_notes_categories DISABLE ROW LEVEL SECURITY;

-- ۲. حذف policies اشتباه قبلی
DROP POLICY IF EXISTS "notes_select_own"   ON personal_notes;
DROP POLICY IF EXISTS "notes_insert_own"   ON personal_notes;
DROP POLICY IF EXISTS "notes_update_own"   ON personal_notes;
DROP POLICY IF EXISTS "notes_delete_own"   ON personal_notes;
DROP POLICY IF EXISTS "cats_select_own"    ON personal_notes_categories;
DROP POLICY IF EXISTS "cats_insert_own"    ON personal_notes_categories;
DROP POLICY IF EXISTS "cats_update_own"    ON personal_notes_categories;
DROP POLICY IF EXISTS "cats_delete_own"    ON personal_notes_categories;

-- ۳. دسترسی کامل به anon role
GRANT ALL ON personal_notes            TO anon;
GRANT ALL ON personal_notes_categories TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- ۴. تست — باید ردیف‌هایی برگرداند (یا خالی باشد)
SELECT COUNT(*) AS total_notes FROM personal_notes;

-- ۵. تست insert دستی
INSERT INTO personal_notes (id, user_id, title, content, category)
VALUES (
    gen_random_uuid(),
    'mgr001',
    'تست اتصال',
    'این یادداشت برای تست اتصال است',
    'عمومی'
)
ON CONFLICT DO NOTHING;

SELECT * FROM personal_notes WHERE user_id = 'mgr001' LIMIT 5;
