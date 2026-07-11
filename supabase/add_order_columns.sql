-- ============================================================
-- add_order_columns.sql
-- افزودن ستون‌های اطلاعات دانشجو و سفارش به جدول orders
-- Supabase Dashboard → SQL Editor → اجرا کن
-- ============================================================

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS student_name      TEXT,
    ADD COLUMN IF NOT EXISTS university        TEXT,
    ADD COLUMN IF NOT EXISTS field             TEXT,
    ADD COLUMN IF NOT EXISTS degree            TEXT,
    ADD COLUMN IF NOT EXISTS order_type        TEXT,
    ADD COLUMN IF NOT EXISTS deadline          TEXT,
    ADD COLUMN IF NOT EXISTS deadline_datetime TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS phone             TEXT,
    ADD COLUMN IF NOT EXISTS passport_number   TEXT,
    ADD COLUMN IF NOT EXISTS currency          TEXT DEFAULT 'تومان',
    ADD COLUMN IF NOT EXISTS work_list         JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS files             JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS title             TEXT,
    ADD COLUMN IF NOT EXISTS is_custom_order   BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS rejection_reason  TEXT,
    ADD COLUMN IF NOT EXISTS rejection_history JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS assigned_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS doctor_share      NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS manager_share     NUMERIC(12,2) DEFAULT 0;

-- index برای جستجو سریع
CREATE INDEX IF NOT EXISTS idx_orders_student_name ON public.orders(student_name);
CREATE INDEX IF NOT EXISTS idx_orders_type         ON public.orders(order_type);

-- تمام ✓
