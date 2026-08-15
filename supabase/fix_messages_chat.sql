-- ============================================================
-- fix_messages_chat.sql
-- اصلاح جدول messages برای سازگاری با گفتگو شخصی
--
-- مشکلات:
--   1. id از نوع UUID است اما JS مقدار عددی (Date.now()) می‌فرستد
--   2. sender_id و receiver_id از نوع UUID هستند اما JS مقادیر
--      متنی مثل 'mgr001' می‌فرستد → FK violation
--   3. ستون content با NOT NULL نبود تعریف، ولی insert بدون content fail می‌کند
--
-- راه‌حل: تبدیل ستون‌های FK به TEXT و id به TEXT
--   (چون سیستم از Supabase Auth استفاده نمی‌کند و ID‌ها local هستند)
-- ============================================================

-- ── ۱. حذف constraint های FK که با ID های متنی ناسازگارند ──
ALTER TABLE public.messages
    DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
    DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey,
    DROP CONSTRAINT IF EXISTS messages_order_id_fkey;

-- ── ۲. تغییر نوع ستون id از UUID به TEXT ─────────────────────
-- ابتدا کپی داده‌ها، سپس تغییر نوع
ALTER TABLE public.messages
    ALTER COLUMN id          DROP DEFAULT,
    ALTER COLUMN id          TYPE TEXT USING id::text,
    ALTER COLUMN sender_id   TYPE TEXT USING sender_id::text,
    ALTER COLUMN receiver_id TYPE TEXT USING receiver_id::text,
    ALTER COLUMN order_id    TYPE TEXT USING order_id::text;

-- ── ۳. default جدید برای id ──────────────────────────────────
ALTER TABLE public.messages
    ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- ── ۴. اطمینان از وجود ستون‌های لازم ────────────────────────
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS content    TEXT,
    ADD COLUMN IF NOT EXISTS is_system  BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS read_at    TIMESTAMPTZ;

-- ── ۵. index ها را بازسازی کن ────────────────────────────────
DROP INDEX IF EXISTS idx_messages_receiver;
DROP INDEX IF EXISTS idx_messages_sender;
DROP INDEX IF EXISTS idx_messages_order;

CREATE INDEX IF NOT EXISTS idx_messages_receiver    ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender      ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_order       ON public.messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at  ON public.messages(created_at DESC);

-- ── ۶. RLS: anon دسترسی کامل دارد (سیستم از Supabase Auth استفاده نمی‌کند) ──
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_anon_all"     ON public.messages;
DROP POLICY IF EXISTS "messages_all_manager"  ON public.messages;
DROP POLICY IF EXISTS "messages_select_employee" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_employee" ON public.messages;
DROP POLICY IF EXISTS "messages_select_agent"    ON public.messages;
DROP POLICY IF EXISTS "messages_insert_agent"    ON public.messages;
DROP POLICY IF EXISTS "messages_select_student"  ON public.messages;
DROP POLICY IF EXISTS "messages_insert_student"  ON public.messages;

-- یک policy ساده برای همه
CREATE POLICY "messages_open_all" ON public.messages
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- تمام ✓
-- بعد از اجرا:
--   - پیام‌های گفتگو شخصی در Supabase ذخیره می‌شوند
--   - ID های متنی (mgr001, emp001, ...) به درستی ذخیره می‌شوند
-- ============================================================
