-- ============================================================
-- daroltarjome_migration.sql
-- فیلدهای جدید برای ماژول دارالترجمه
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── ۱. اضافه کردن فیلدهای جدید به embassy_records ──────────

ALTER TABLE public.embassy_records
    ADD COLUMN IF NOT EXISTS passport_paths       TEXT[]      DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS translation_status   TEXT        DEFAULT 'pending',
    -- مقادیر: 'received' | 'not_ready' | 'ready'
    ADD COLUMN IF NOT EXISTS translation_cost     NUMERIC     DEFAULT 0,
    ADD COLUMN IF NOT EXISTS translation_notes    TEXT        DEFAULT '',
    ADD COLUMN IF NOT EXISTS translation_invoice_paths TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS share_token          TEXT        UNIQUE,
    ADD COLUMN IF NOT EXISTS translation_updated_at TIMESTAMPTZ;

-- ── ۲. جدول چت دارالترجمه ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.daroltarjome_chat (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id    TEXT NOT NULL,   -- embassy_records.id
    sender_role  TEXT NOT NULL,   -- 'staff' | 'translator'
    sender_name  TEXT,
    message      TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt_chat_record ON public.daroltarjome_chat (record_id);

-- ── ۳. RLS ───────────────────────────────────────────────────

ALTER TABLE public.daroltarjome_chat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dt_chat_anon"  ON public.daroltarjome_chat;
CREATE POLICY "dt_chat_anon"
    ON public.daroltarjome_chat FOR ALL TO anon
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dt_chat_auth"  ON public.daroltarjome_chat;
CREATE POLICY "dt_chat_auth"
    ON public.daroltarjome_chat FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- ── ۴. دسترسی anon به embassy_records برای خواندن (صفحه دارالترجمه) ──
-- این policy اجازه میده صفحه daroltarjome.html بدون auth هم رکورد رو بخونه
DROP POLICY IF EXISTS "embassy_read_anon" ON public.embassy_records;
CREATE POLICY "embassy_read_anon"
    ON public.embassy_records FOR SELECT TO anon
    USING (true);

DROP POLICY IF EXISTS "embassy_update_anon" ON public.embassy_records;
CREATE POLICY "embassy_update_anon"
    ON public.embassy_records FOR UPDATE TO anon
    USING (true) WITH CHECK (true);

-- ── ۵. جدول فاکتورهای گروهی دارالترجمه ────────────────────
-- هر فاکتور برای یک تاریخ ارسال (چند رکورد با send_date یکسان)
CREATE TABLE IF NOT EXISTS public.daroltarjome_invoices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    send_date   TEXT NOT NULL,   -- تاریخ ارسال (از send_date رکوردهای سفارت)
    file_path   TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    note        TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_dt_inv_date ON public.daroltarjome_invoices (send_date);

ALTER TABLE public.daroltarjome_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dt_inv_anon" ON public.daroltarjome_invoices;
CREATE POLICY "dt_inv_anon"
    ON public.daroltarjome_invoices FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dt_inv_auth" ON public.daroltarjome_invoices;
CREATE POLICY "dt_inv_auth"
    ON public.daroltarjome_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── ۵. تأیید ─────────────────────────────────────────────────
SELECT
    (SELECT count(*) FROM information_schema.columns
     WHERE table_name='embassy_records' AND column_name='share_token') AS share_token_exists,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_name='daroltarjome_chat') AS chat_table_exists,
    'migration OK ✓' AS status;
