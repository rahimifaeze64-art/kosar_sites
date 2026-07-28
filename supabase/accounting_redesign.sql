-- ============================================================
-- accounting_redesign.sql
-- بازطراحی حسابداری شخصی — افزودن ستون‌های جدید
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── ۱. ستون‌های جدید به company_accounting ────────────────

-- تاریخ تراکنش (جدا از created_at)
ALTER TABLE public.company_accounting
    ADD COLUMN IF NOT EXISTS tx_date     date        DEFAULT CURRENT_DATE;

-- پشتیبانی از چند مبلغ با ارزهای مختلف در یک تراکنش
ALTER TABLE public.company_accounting
    ADD COLUMN IF NOT EXISTS amounts     jsonb       DEFAULT '[]'::jsonb;
-- فرمت: [{"amount": 5000000, "currency": "تومان"}, {"amount": 100, "currency": "دلار"}]

-- رسید / پیوست تراکنش (URL در Supabase Storage)
ALTER TABLE public.company_accounting
    ADD COLUMN IF NOT EXISTS receipt_url text;

-- نام شخص آزاد (اگر در لیست اشخاص نباشد)
ALTER TABLE public.company_accounting
    ADD COLUMN IF NOT EXISTS person_free_text text;

-- یادداشت اضافی
ALTER TABLE public.company_accounting
    ADD COLUMN IF NOT EXISTS note        text;

-- ── ۲. جدول اشخاص (persons) ──────────────────────────────
-- لیست اشخاص حسابداری (مستقل از profiles)
CREATE TABLE IF NOT EXISTS public.accounting_persons (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         text        NOT NULL,
    type         text        DEFAULT 'other',
    phone        text,
    notes        text,
    created_by   text,
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);

COMMENT ON TABLE public.accounting_persons IS
    'اشخاص حسابداری — مستقل از جدول profiles';

CREATE INDEX IF NOT EXISTS idx_acc_persons_name ON public.accounting_persons (name);

ALTER TABLE public.accounting_persons ENABLE ROW LEVEL SECURITY;

-- anon (سیستم بدون auth)
DROP POLICY IF EXISTS "acc_persons_anon" ON public.accounting_persons;
CREATE POLICY "acc_persons_anon"
    ON public.accounting_persons FOR ALL TO anon
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "acc_persons_auth" ON public.accounting_persons;
CREATE POLICY "acc_persons_auth"
    ON public.accounting_persons FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- ── ۳. اضافه کردن person_acc_id به company_accounting ──────
-- ارتباط به جدول جدید اشخاص (به جای profiles)
ALTER TABLE public.company_accounting
    ADD COLUMN IF NOT EXISTS person_acc_id uuid REFERENCES public.accounting_persons(id) ON DELETE SET NULL;

-- ── ۴. Storage bucket برای رسیدها ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'accounting-receipts',
    'accounting-receipts',
    true,
    10485760,  -- 10MB
    ARRAY['image/jpeg','image/png','image/webp','application/pdf']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "acc_receipts_anon" ON storage.objects;
CREATE POLICY "acc_receipts_anon"
    ON storage.objects FOR ALL TO anon
    USING  (bucket_id = 'accounting-receipts')
    WITH CHECK (bucket_id = 'accounting-receipts');

-- ── ۵. RLS برای company_accounting (anon) ──────────────────
DROP POLICY IF EXISTS "ca_anon_all" ON public.company_accounting;
CREATE POLICY "ca_anon_all"
    ON public.company_accounting FOR ALL TO anon
    USING (true) WITH CHECK (true);

-- ── ۶. ایندکس‌های جدید ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ca_tx_date      ON public.company_accounting (tx_date DESC);
CREATE INDEX IF NOT EXISTS idx_ca_person_acc   ON public.company_accounting (person_acc_id);
CREATE INDEX IF NOT EXISTS idx_ca_person_name  ON public.company_accounting (person_name);

-- ── ۷. تأیید ──────────────────────────────────────────────
SELECT
    (SELECT count(*) FROM public.company_accounting)  AS transactions,
    (SELECT count(*) FROM public.accounting_persons)  AS persons,
    'accounting redesign OK ✓' AS status;
