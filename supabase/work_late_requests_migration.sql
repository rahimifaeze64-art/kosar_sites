-- ============================================================
-- work_late_requests_migration.sql
-- جدول جدید: درخواست‌های مهلت مجدد کارمندان
-- (تنها جدولی که در تغییرات اخیر employee-accounting.js اضافه شد)
--
-- جداول قبلی که از قبل موجودند و نیاز به ساخت مجدد ندارند:
--   ✅ work_hours          (کلید localStorage: 'work_hours_data')
--   ✅ employee_hourly_rates
--   ✅ work_gifts          (employee_accounting_migration.sql)
--   ✅ work_deductions     (employee_accounting_migration.sql)
--   ✅ work_settlements    (employee_accounting_migration.sql)
--
-- فقط این فایل را در Supabase Dashboard → SQL Editor اجرا کن
-- ============================================================

-- ── ۱. جدول درخواست مهلت مجدد (work_late_requests) ──────────
--
-- فیلدهای ذخیره‌شده در localStorage (کلید: 'work_late_requests'):
--   id             : 'lr_' + timestamp
--   employeeId     : شناسه کارمند (text)
--   employeeName   : نام کارمند
--   requestedDate  : تاریخ فراموش‌شده (date)
--   entryType      : 'work' | 'expense'
--   startTime      : ساعت شروع (برای نوع work)
--   endTime        : ساعت پایان (برای نوع work)
--   amount         : مبلغ هزینه (برای نوع expense)
--   reason         : دلیل فراموشی
--   status         : 'pending' | 'approved' | 'rejected'
--   createdAt      : زمان ثبت درخواست
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.work_late_requests (
    id              text        PRIMARY KEY DEFAULT ('lr_' || extract(epoch from now())::bigint::text),
    employee_id     text        NOT NULL,
    employee_name   text,
    requested_date  date        NOT NULL,
    entry_type      text        NOT NULL CHECK (entry_type IN ('work', 'expense')),
    start_time      text,                          -- فقط برای entry_type = 'work'
    end_time        text,                          -- فقط برای entry_type = 'work'
    amount          numeric     DEFAULT 0,         -- فقط برای entry_type = 'expense'
    reason          text        NOT NULL,
    status          text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by     text,                          -- شناسه مدیر تأییدکننده (اختیاری)
    reviewed_at     timestamptz,                   -- زمان بررسی (اختیاری)
    created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE public.work_late_requests IS
    'درخواست‌های کارمندان برای ثبت سوابق کاری / هزینه‌هایی که فراموش کرده‌اند';

COMMENT ON COLUMN public.work_late_requests.entry_type   IS 'نوع ثبت: work = ساعت کاری | expense = هزینه';
COMMENT ON COLUMN public.work_late_requests.status       IS 'وضعیت: pending | approved | rejected';
COMMENT ON COLUMN public.work_late_requests.start_time   IS 'ساعت شروع — فقط برای نوع work (مثال: 08:30)';
COMMENT ON COLUMN public.work_late_requests.end_time     IS 'ساعت پایان — فقط برای نوع work (مثال: 17:00)';
COMMENT ON COLUMN public.work_late_requests.amount       IS 'مبلغ هزینه — فقط برای نوع expense';

-- ── ۲. ایندکس‌ها ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lr_employee
    ON public.work_late_requests (employee_id);

CREATE INDEX IF NOT EXISTS idx_lr_status
    ON public.work_late_requests (status);

CREATE INDEX IF NOT EXISTS idx_lr_requested_date
    ON public.work_late_requests (requested_date DESC);

CREATE INDEX IF NOT EXISTS idx_lr_created_at
    ON public.work_late_requests (created_at DESC);

-- ── ۳. Row Level Security ──────────────────────────────────────
ALTER TABLE public.work_late_requests ENABLE ROW LEVEL SECURITY;

-- کارمند: فقط درخواست‌های خودش را می‌بیند / ثبت می‌کند
DROP POLICY IF EXISTS "lr_select_own"  ON public.work_late_requests;
CREATE POLICY "lr_select_own"
    ON public.work_late_requests
    FOR SELECT TO authenticated
    USING (employee_id = auth.uid()::text);

DROP POLICY IF EXISTS "lr_insert_own"  ON public.work_late_requests;
CREATE POLICY "lr_insert_own"
    ON public.work_late_requests
    FOR INSERT TO authenticated
    WITH CHECK (employee_id = auth.uid()::text);

-- مدیر: همه درخواست‌ها را می‌بیند و می‌تواند وضعیت را تغییر دهد
DROP POLICY IF EXISTS "lr_all_manager" ON public.work_late_requests;
CREATE POLICY "lr_all_manager"
    ON public.work_late_requests
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role = 'manager'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role = 'manager'
        )
    );

-- دسترسی anon (برای حالت آفلاین / بدون auth)
DROP POLICY IF EXISTS "lr_anon_all"    ON public.work_late_requests;
CREATE POLICY "lr_anon_all"
    ON public.work_late_requests
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── ۴. تابع کمکی: تأیید درخواست + ثبت خودکار سابقه ──────────
--
-- این تابع در صورت تأیید درخواست توسط مدیر:
--   ۱. وضعیت درخواست را 'approved' می‌کند
--   ۲. سابقه کاری / هزینه را در جدول work_hours ثبت می‌کند
--   ۳. سابقه را به حالت 'approved' تغییر می‌دهد
--
-- فراخوانی: SELECT approve_late_request('lr_xxx', 'manager_id');
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_late_request(
    p_request_id  text,
    p_reviewer_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req   public.work_late_requests%ROWTYPE;
    v_entry_id text;
BEGIN
    -- دریافت درخواست
    SELECT * INTO v_req
    FROM public.work_late_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'request not found');
    END IF;

    IF v_req.status <> 'pending' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'request is not pending');
    END IF;

    -- بررسی وجود جدول work_hours (برای جلوگیری از خطا)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'work_hours'
    ) THEN
        -- اگر جدول work_hours وجود ندارد فقط وضعیت را عوض کن
        UPDATE public.work_late_requests
        SET status      = 'approved',
            reviewed_by = p_reviewer_id,
            reviewed_at = now()
        WHERE id = p_request_id;
        RETURN jsonb_build_object('ok', true, 'note', 'approved (work_hours table not found, no entry created)');
    END IF;

    -- ثبت سابقه در work_hours
    v_entry_id := 'lr_entry_' || extract(epoch from now())::bigint::text;

    INSERT INTO public.work_hours (
        id, type, employee_id, employee_name,
        date, start_time, end_time,
        total_hours, amount,
        description, status,
        created_at, updated_at
    ) VALUES (
        v_entry_id,
        v_req.entry_type,
        v_req.employee_id,
        v_req.employee_name,
        v_req.requested_date,
        CASE WHEN v_req.entry_type = 'work' THEN v_req.start_time ELSE NULL END,
        CASE WHEN v_req.entry_type = 'work' THEN v_req.end_time   ELSE NULL END,
        CASE WHEN v_req.entry_type = 'work' THEN
            EXTRACT(EPOCH FROM (
                v_req.end_time::time - v_req.start_time::time
            )) / 3600.0
        ELSE NULL END,
        CASE WHEN v_req.entry_type = 'expense' THEN v_req.amount ELSE NULL END,
        'ثبت از درخواست مهلت مجدد — ' || COALESCE(v_req.reason, ''),
        'approved',
        now(), now()
    )
    ON CONFLICT (id) DO NOTHING;

    -- به‌روزرسانی وضعیت درخواست
    UPDATE public.work_late_requests
    SET status      = 'approved',
        reviewed_by = p_reviewer_id,
        reviewed_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'ok',       true,
        'entry_id', v_entry_id,
        'type',     v_req.entry_type
    );
END;
$$;

COMMENT ON FUNCTION public.approve_late_request IS
    'تأیید درخواست مهلت مجدد و ثبت خودکار سابقه کاری در work_hours';

-- ── ۵. تابع کمکی: رد کردن درخواست ───────────────────────────
CREATE OR REPLACE FUNCTION public.reject_late_request(
    p_request_id  text,
    p_reviewer_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.work_late_requests
    SET status      = 'rejected',
        reviewed_by = p_reviewer_id,
        reviewed_at = now()
    WHERE id = p_request_id
      AND status = 'pending';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'request not found or not pending');
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.reject_late_request IS
    'رد کردن درخواست مهلت مجدد';

-- ── ۶. تأیید اجرا ──────────────────────────────────────────────
SELECT
    (SELECT count(*) FROM public.work_late_requests) AS late_requests_count,
    'work_late_requests table created ✓'             AS status;
