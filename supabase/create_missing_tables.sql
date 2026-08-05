-- ============================================================
-- create_missing_tables.sql
-- ایجاد تمام جداول مورد نیاز اپلیکیشن
-- IF NOT EXISTS — بدون خطا در صورت وجود جدول
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ۱. orders — سفارشات
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.orders (
    id                      TEXT        PRIMARY KEY,
    student_id              TEXT,
    student_name            TEXT,
    university              TEXT,
    field                   TEXT,
    degree                  TEXT,
    order_type              TEXT,
    order_type_id           TEXT,
    deadline                TEXT,
    deadline_datetime       TIMESTAMPTZ,
    phone                   TEXT,
    passport_number         TEXT,
    currency                TEXT        DEFAULT 'تومان',
    status                  TEXT        DEFAULT 'pending'
                            CHECK (status IN ('pending','in_progress','completed','cancelled','approved','rejected')),
    stage                   TEXT,
    progress                INTEGER     DEFAULT 0,
    assigned_agent_id       TEXT,
    total_amount            NUMERIC     DEFAULT 0,
    paid_amount             NUMERIC     DEFAULT 0,
    payment_status          TEXT        DEFAULT 'unpaid'
                            CHECK (payment_status IN ('unpaid','partial','paid')),
    doctor_share            NUMERIC     DEFAULT 0,
    manager_share           NUMERIC     DEFAULT 0,
    revenue_agent_percent   NUMERIC     DEFAULT 60,
    revenue_manager_percent NUMERIC     DEFAULT 40,
    title                   TEXT,
    description             TEXT,
    work_list               JSONB       DEFAULT '[]',
    files                   JSONB       DEFAULT '[]',
    tasks                   JSONB       DEFAULT '[]',
    work_log                JSONB       DEFAULT '[]',
    rejection_reason        TEXT,
    rejection_history       JSONB       DEFAULT '[]',
    is_custom_order         BOOLEAN     DEFAULT false,
    approved_at             TIMESTAMPTZ,
    assigned_at             TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۲. student_progress — پیشرفت مراحل دانشجو
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.student_progress (
    id          BIGSERIAL   PRIMARY KEY,
    student_id  TEXT        NOT NULL,
    path_type   TEXT        NOT NULL CHECK (path_type IN ('defense','requirements','educational')),
    step_index  INTEGER     NOT NULL,
    status      INTEGER     DEFAULT 0,   -- 0=incomplete, 1=current, 2=completed
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, path_type, step_index)
);

-- ════════════════════════════════════════════════════════════
-- ۳. employee_tasks — وظایف کارمندان/عاملین
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.employee_tasks (
    id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assigned_to   TEXT,
    created_by    TEXT,
    title         TEXT        NOT NULL,
    description   TEXT,
    priority      TEXT        DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
    status        TEXT        DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
    due_date      TEXT,
    is_step_task  BOOLEAN     DEFAULT false,
    student_id    TEXT,
    step_type     TEXT,
    step_index    INTEGER,
    step_name     TEXT,
    voice_message TEXT,
    order_id      TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۴. work_hours — ساعات کاری کارمندان
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.work_hours (
    id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_id   TEXT        NOT NULL,
    employee_name TEXT,
    type          TEXT        DEFAULT 'work',
    date          TEXT        NOT NULL,
    start_time    TEXT,
    end_time      TEXT,
    total_hours   NUMERIC,
    amount        NUMERIC,
    description   TEXT,
    status        TEXT        DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    reviewed_by   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۵. messages — پیام‌های داخلی
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.messages (
    id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sender_id   TEXT,
    receiver_id TEXT,
    order_id    TEXT,
    content     TEXT        NOT NULL DEFAULT '',
    is_system   BOOLEAN     DEFAULT false,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۶. accounting_transactions — تراکنش‌های حسابداری سفارش
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.accounting_transactions (
    id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id      TEXT,
    type          TEXT        NOT NULL CHECK (type IN ('payment','refund','expense','income')),
    amount        NUMERIC     NOT NULL DEFAULT 0,
    description   TEXT,
    agent_share   NUMERIC,
    manager_share NUMERIC,
    created_by    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۷. notifications — اعلان‌ها
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notifications (
    id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id    TEXT        NOT NULL,
    title      TEXT,
    message    TEXT,
    type       TEXT        DEFAULT 'info',
    read       BOOLEAN     DEFAULT false,
    order_id   TEXT,
    task_id    TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۸. order_types — کاتالوگ انواع سفارش
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.order_types (
    id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code            TEXT        UNIQUE,
    name            TEXT        NOT NULL,
    category        TEXT,
    price_bachelor  NUMERIC     DEFAULT 0,
    price_masters   NUMERIC     DEFAULT 0,
    price_phd       NUMERIC     DEFAULT 0,
    active          BOOLEAN     DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۹. step_assignments — تخصیص مراحل به کارمندان
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.step_assignments (
    id          BIGSERIAL   PRIMARY KEY,
    path_type   TEXT        NOT NULL CHECK (path_type IN ('defense','requirements','educational')),
    step_index  INTEGER     NOT NULL,
    employee_id TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (path_type, step_index)
);

-- ════════════════════════════════════════════════════════════
-- ۱۰. archived_files — آرشیو فایل‌ها
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.archived_files (
    id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    file_name      TEXT        NOT NULL,
    file_path      TEXT,
    file_size      BIGINT,
    file_size_text TEXT,
    category       TEXT,
    author         TEXT,
    file_type      TEXT,
    display_url    TEXT,
    student_id     TEXT,
    order_id       TEXT,
    uploaded_by    TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۱۱. employee_hourly_rates — نرخ ساعتی کارمندان
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.employee_hourly_rates (
    employee_id  TEXT        PRIMARY KEY,
    hourly_rate  NUMERIC     NOT NULL DEFAULT 0,
    currency     TEXT        DEFAULT 'تومان',
    updated_by   TEXT,
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۱۲. company_accounting — حسابداری شرکت
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.company_accounting (
    id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tx_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
    type         TEXT        NOT NULL,   -- income/expense/transfer
    amount       NUMERIC     NOT NULL DEFAULT 0,
    currency     TEXT        DEFAULT 'تومان',
    description  TEXT,
    person_id    TEXT,
    order_tx_id  TEXT,
    receipt_url  TEXT,
    created_by   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۱۳. accounting_persons — اشخاص حسابداری
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.accounting_persons (
    id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name       TEXT        NOT NULL,
    type       TEXT        DEFAULT 'other',
    phone      TEXT,
    note       TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۱۴. checklist_categories — دسته‌بندی چک‌لیست
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.checklist_categories (
    id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id    TEXT        NOT NULL,
    title      TEXT        NOT NULL,
    color      TEXT        DEFAULT '#3b82f6',
    icon       TEXT        DEFAULT 'fa-list',
    sort_order INTEGER     DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۱۵. checklist_items — آیتم‌های چک‌لیست
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.checklist_items (
    id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    category_id TEXT        NOT NULL,
    user_id     TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    description TEXT,
    sort_order  INTEGER     DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۱۶. checklist_tasks — وظایف چک‌لیست
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.checklist_tasks (
    id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    item_id     TEXT        NOT NULL,
    category_id TEXT,
    user_id     TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    completed   BOOLEAN     DEFAULT false,
    due_date    TEXT,
    sort_order  INTEGER     DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۱۷. daroltarjome_invoices — فاکتورهای دارالترجمه
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.daroltarjome_invoices (
    id        BIGSERIAL   PRIMARY KEY,
    send_date TEXT        NOT NULL,
    file_path TEXT        NOT NULL,
    note      TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۱۸. daroltarjome_chat — چت دارالترجمه
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.daroltarjome_chat (
    id           BIGSERIAL   PRIMARY KEY,
    record_id    TEXT        NOT NULL DEFAULT 'general',
    sender_role  TEXT,
    sender_name  TEXT,
    message      TEXT        NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۱۹. work_late_requests — درخواست‌های اضافه‌کاری/تاخیر
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.work_late_requests (
    id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_id  TEXT        NOT NULL,
    employee_name TEXT,
    request_type TEXT        DEFAULT 'late' CHECK (request_type IN ('late','overtime','absence','remote')),
    date         TEXT        NOT NULL,
    reason       TEXT,
    duration     TEXT,
    status       TEXT        DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    reviewed_by  TEXT,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ۲۰. RLS Policies — دسترسی آزاد برای همه جداول
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
    tbl TEXT;
    tbls TEXT[] := ARRAY[
        'orders','student_progress','employee_tasks','work_hours',
        'messages','accounting_transactions','notifications',
        'order_types','step_assignments','archived_files',
        'employee_hourly_rates','company_accounting','accounting_persons',
        'checklist_categories','checklist_items','checklist_tasks',
        'daroltarjome_invoices','daroltarjome_chat','work_late_requests'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbls LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON public.%I', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "allow_all_%s" ON public.%I FOR ALL USING (true) WITH CHECK (true)',
            tbl, tbl
        );
    END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════
-- ۲۱. Storage Buckets (دستی در Dashboard ایجاد کن)
-- ════════════════════════════════════════════════════════════
-- این buckets باید در Dashboard → Storage ایجاد شوند:
-- • embassy-files    (private)
-- • archive-files    (public)
-- • accounting-receipts (public)

-- ════════════════════════════════════════════════════════════
-- ۲۲. تأیید جداول ایجاد شده
-- ════════════════════════════════════════════════════════════
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
