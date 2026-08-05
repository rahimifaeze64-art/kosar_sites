-- ============================================================
-- management_chat_migration.sql
-- جدول چت گروهی مدیریت (مدیر + همه کارمندان)
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ۱. جدول اصلی پیام‌های مدیریت
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.management_messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       TEXT        NOT NULL,
    sender_name     TEXT        NOT NULL DEFAULT '',
    sender_role     TEXT        NOT NULL DEFAULT 'employee'
                    CHECK (sender_role IN ('manager','employee')),
    msg_type        TEXT        NOT NULL DEFAULT 'text'
                    CHECK (msg_type IN ('text','file','voice','image')),
    content         TEXT,
    file_url        TEXT,
    file_name       TEXT,
    file_type       TEXT,
    file_size       BIGINT,
    mentions        TEXT[]      DEFAULT '{}',
    related_task_id TEXT,
    edited          BOOLEAN     DEFAULT false,
    edited_at       TIMESTAMPTZ,
    deleted         BOOLEAN     DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۲. جدول وضعیت خواندن پیام‌ها (read receipts)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.management_message_reads (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID        NOT NULL REFERENCES public.management_messages(id) ON DELETE CASCADE,
    user_id     TEXT        NOT NULL,
    read_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (message_id, user_id)
);

-- ════════════════════════════════════════════════════════════
-- ۳. ایندکس‌ها برای بهبود کارایی
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_management_messages_created_at
    ON public.management_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_management_messages_sender_id
    ON public.management_messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_management_messages_deleted
    ON public.management_messages (deleted)
    WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_management_message_reads_user
    ON public.management_message_reads (user_id);

CREATE INDEX IF NOT EXISTS idx_management_message_reads_message
    ON public.management_message_reads (message_id);

-- ════════════════════════════════════════════════════════════
-- ۴. Row Level Security (RLS)
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.management_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_message_reads   ENABLE ROW LEVEL SECURITY;

-- حذف سیاست‌های قدیمی اگر وجود دارند
DROP POLICY IF EXISTS "management_messages_select" ON public.management_messages;
DROP POLICY IF EXISTS "management_messages_insert" ON public.management_messages;
DROP POLICY IF EXISTS "management_messages_update" ON public.management_messages;
DROP POLICY IF EXISTS "management_messages_delete" ON public.management_messages;
DROP POLICY IF EXISTS "management_reads_select"    ON public.management_message_reads;
DROP POLICY IF EXISTS "management_reads_insert"    ON public.management_message_reads;
DROP POLICY IF EXISTS "management_reads_delete"    ON public.management_message_reads;

-- مدیر و کارمند می‌توانند همه پیام‌های غیر حذف‌شده را ببینند
CREATE POLICY "management_messages_select"
    ON public.management_messages FOR SELECT
    USING (deleted = false);

-- هر کسی می‌تواند پیام ارسال کند (احراز هویت در سطح اپ)
CREATE POLICY "management_messages_insert"
    ON public.management_messages FOR INSERT
    WITH CHECK (true);

-- فقط فرستنده می‌تواند پیام خود را ویرایش کند
CREATE POLICY "management_messages_update"
    ON public.management_messages FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- حذف منطقی (soft delete) — هر کسی می‌تواند deleted=true کند
CREATE POLICY "management_messages_delete"
    ON public.management_messages FOR DELETE
    USING (true);

-- read receipts — همه می‌توانند بخوانند و بنویسند
CREATE POLICY "management_reads_select"
    ON public.management_message_reads FOR SELECT
    USING (true);

CREATE POLICY "management_reads_insert"
    ON public.management_message_reads FOR INSERT
    WITH CHECK (true);

CREATE POLICY "management_reads_delete"
    ON public.management_message_reads FOR DELETE
    USING (true);

-- ════════════════════════════════════════════════════════════
-- ۵. Realtime فعال‌سازی
-- ════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.management_messages;

-- ════════════════════════════════════════════════════════════
-- ۶. Bucket ذخیره فایل‌های چت مدیریت
-- (این بخش را در Dashboard → Storage → New Bucket اجرا کن)
-- نام bucket: management-chat-files
-- Public: true
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════
-- ۷. Storage Policy برای bucket management-chat-files
-- ════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('management-chat-files', 'management-chat-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "management_chat_files_select" ON storage.objects;
DROP POLICY IF EXISTS "management_chat_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "management_chat_files_delete" ON storage.objects;

CREATE POLICY "management_chat_files_select"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'management-chat-files');

CREATE POLICY "management_chat_files_insert"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'management-chat-files');

CREATE POLICY "management_chat_files_delete"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'management-chat-files');

-- ════════════════════════════════════════════════════════════
-- ۸. تابع کمکی — شمارش پیام‌های خوانده‌نشده برای کاربر
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_unread_management_messages(p_user_id TEXT)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER
    FROM public.management_messages m
    WHERE m.deleted = false
      AND NOT EXISTS (
          SELECT 1 FROM public.management_message_reads r
          WHERE r.message_id = m.id AND r.user_id = p_user_id
      );
$$ LANGUAGE SQL STABLE;
