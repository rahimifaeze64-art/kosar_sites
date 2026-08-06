-- ============================================================
-- fix_missing_columns.sql
-- اضافه کردن ستون‌های گمشده به جداول موجود
-- ایمن برای اجرای مجدد (IF NOT EXISTS)
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ۱. orders — ستون extra_costs برای هزینه‌های چند ارزه
-- فرمت: JSONB آرایه‌ای از [{amount: 1000, currency: "دلار"}, ...]
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS extra_costs JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.orders.extra_costs IS
    'هزینه‌های اضافی چند ارزه — [{amount, currency}] / Multi-currency extra costs';

-- ════════════════════════════════════════════════════════════
-- ۲. accounting_transactions — ستون currency
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.accounting_transactions
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'تومان';

-- ستون agent_id برای ثبت پرداخت‌های مدیر به عامل بدون FK شکستن
ALTER TABLE public.accounting_transactions
    ADD COLUMN IF NOT EXISTS agent_id TEXT;

-- نوع تراکنش را گسترش بده تا پرداخت به عامل هم پوشش بده
-- CHECK قدیمی رو حذف می‌کنیم چون باید 'agent_payment' هم قبول بشه
ALTER TABLE public.accounting_transactions
    DROP CONSTRAINT IF EXISTS accounting_transactions_type_check;

ALTER TABLE public.accounting_transactions
    ADD CONSTRAINT accounting_transactions_type_check
    CHECK (type IN ('payment','refund','expense','income','agent_payment'));

COMMENT ON COLUMN public.accounting_transactions.currency IS
    'واحد پولی تراکنش: تومان، دلار، دینار / Transaction currency';
COMMENT ON COLUMN public.accounting_transactions.agent_id IS
    'شناسه عامل برای پرداخت‌های مدیر به عامل / Agent ID for manager-to-agent payments';

-- ════════════════════════════════════════════════════════════
-- ۳. تأیید تغییرات
-- ════════════════════════════════════════════════════════════
SELECT
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'orders'
  AND column_name  = 'extra_costs';

SELECT
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'accounting_transactions'
  AND column_name  IN ('currency', 'agent_id');
