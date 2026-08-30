-- ============================================================
-- employee_accounting_updates.sql  (v2 — safe, no type cast errors)
-- به‌روزرسانی‌های حسابداری کارمندان
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ۱. فیلد شارژ ماهانه به جدول employee_hourly_rates
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.employee_hourly_rates
    ADD COLUMN IF NOT EXISTS monthly_charge NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.employee_hourly_rates.monthly_charge IS
    'شارژ ماهانه ثابت کارمند (علاوه بر حقوق ساعتی)';

-- ────────────────────────────────────────────────────────────
-- ۲. جدول employee_hourly_rates_ext  (کلید text — سازگار با localStorage)
--    چون JS از string ID استفاده می‌کند نه UUID مستقیم
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_hourly_rates_ext (
    id             text          PRIMARY KEY,
    hourly_rate    NUMERIC(12,2) NOT NULL DEFAULT 0,
    monthly_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency       text          NOT NULL DEFAULT 'تومان',
    updated_at     timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.employee_hourly_rates_ext IS
    'نرخ ساعتی و شارژ ماهانه — کلید text (سازگار با localStorage JS)';

CREATE INDEX IF NOT EXISTS idx_ehr_ext_id
    ON public.employee_hourly_rates_ext (id);

ALTER TABLE public.employee_hourly_rates_ext
    ENABLE ROW LEVEL SECURITY;

-- anon: دسترسی کامل (پروژه بدون auth کار می‌کند)
DROP POLICY IF EXISTS "ehr_ext_anon_all" ON public.employee_hourly_rates_ext;
CREATE POLICY "ehr_ext_anon_all"
    ON public.employee_hourly_rates_ext
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- authenticated: دسترسی کامل
DROP POLICY IF EXISTS "ehr_ext_auth_all" ON public.employee_hourly_rates_ext;
CREATE POLICY "ehr_ext_auth_all"
    ON public.employee_hourly_rates_ext
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- ۳. work_hours — اضافه کردن policy anon (اگر وجود ندارد)
--    فقط برای پروژه‌هایی که با anon key کار می‌کنند
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- بررسی وجود policy قبل از ساخت
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'work_hours'
          AND policyname = 'wh_anon_all'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY "wh_anon_all"
                ON public.work_hours
                FOR ALL TO anon
                USING (true)
                WITH CHECK (true)
        $policy$;
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- ۴. employee_hourly_rates — اضافه کردن policy anon
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'employee_hourly_rates'
          AND policyname = 'ehr_anon_all'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY "ehr_anon_all"
                ON public.employee_hourly_rates
                FOR ALL TO anon
                USING (true)
                WITH CHECK (true)
        $policy$;
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- ۵. work_late_requests — فیلد jalali_date
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.work_late_requests
    ADD COLUMN IF NOT EXISTS jalali_date text;

COMMENT ON COLUMN public.work_late_requests.jalali_date IS
    'تاریخ شمسی نمایشی (مثل: ۱۵ مرداد ۱۴۰۴)';

-- ────────────────────────────────────────────────────────────
-- ۶. work_hours — policy ویرایش توسط کارمند (فقط pending/rejected)
--    تشخیص خودکار نوع ستون employee_id (TEXT یا UUID)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "wh_update_own_employee" ON public.work_hours;

DO $$
DECLARE v_empid_type text;
BEGIN
    SELECT data_type INTO v_empid_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_hours' AND column_name = 'employee_id';

    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_user_role'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        IF v_empid_type = 'text' THEN
            EXECUTE $policy$
                CREATE POLICY "wh_update_own_employee"
                    ON public.work_hours FOR UPDATE TO authenticated
                    USING (
                        public.get_user_role() = 'employee'
                        AND employee_id = auth.uid()::text
                        AND status IN ('pending','rejected')
                    )
                    WITH CHECK (
                        public.get_user_role() = 'employee'
                        AND employee_id = auth.uid()::text
                    )
            $policy$;
        ELSE
            EXECUTE $policy$
                CREATE POLICY "wh_update_own_employee"
                    ON public.work_hours FOR UPDATE TO authenticated
                    USING (
                        public.get_user_role() = 'employee'
                        AND employee_id = auth.uid()
                        AND status IN ('pending','rejected')
                    )
                    WITH CHECK (
                        public.get_user_role() = 'employee'
                        AND employee_id = auth.uid()
                    )
            $policy$;
        END IF;
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- ۷. تأیید نهایی
-- ────────────────────────────────────────────────────────────
SELECT
    (SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'employee_hourly_rates'
        AND column_name  = 'monthly_charge'
      LIMIT 1
    )                                                  AS monthly_charge_col,

    (SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'work_late_requests'
        AND column_name  = 'jalali_date'
      LIMIT 1
    )                                                  AS jalali_date_col,

    (SELECT count(*)::int
       FROM public.employee_hourly_rates_ext
    )                                                  AS ehr_ext_rows,

    (SELECT count(*)::int
       FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('work_hours','employee_hourly_rates','employee_hourly_rates_ext')
        AND policyname LIKE '%anon%'
    )                                                  AS anon_policies_count,

    'employee_accounting_updates v2 OK ✓'              AS status;
