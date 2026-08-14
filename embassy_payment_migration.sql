-- ============================================================
-- embassy_payment_migration.sql
-- اضافه کردن فیلد پرداخت از طرف ما به جدول embassy_records
-- ============================================================

-- اضافه کردن ستون مبلغ پرداختی (عدد اعشاری)
ALTER TABLE embassy_records
    ADD COLUMN IF NOT EXISTS our_payment_amount  NUMERIC(15, 2) DEFAULT NULL;

-- اضافه کردن ستون وضعیت پرداخت: 'شده' یا 'نشده'
ALTER TABLE embassy_records
    ADD COLUMN IF NOT EXISTS our_payment_status  TEXT DEFAULT 'نشده'
    CHECK (our_payment_status IN ('شده', 'نشده'));

-- مقداردهی پیش‌فرض برای رکوردهای قدیمی
UPDATE embassy_records
SET our_payment_status = 'نشده'
WHERE our_payment_status IS NULL;

-- بررسی ستون‌ها بعد از migration
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'embassy_records'
  AND column_name IN ('our_payment_amount', 'our_payment_status');
