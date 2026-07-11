-- ============================================================
-- FINAL_FIX.sql — نسخه 2
-- Supabase Dashboard → SQL Editor → اجرا کن
-- ============================================================

-- ═══════════════════════════════════════════
-- STEP 1: حذف همه policy های موجود
-- ═══════════════════════════════════════════

-- profiles
DROP POLICY IF EXISTS "profiles_select_manager"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_employee"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_agent"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_manager"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_manager"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_manager"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_all"          ON public.profiles;

-- orders
DROP POLICY IF EXISTS "orders_select_manager"      ON public.orders;
DROP POLICY IF EXISTS "orders_select_employee"     ON public.orders;
DROP POLICY IF EXISTS "orders_select_agent"        ON public.orders;
DROP POLICY IF EXISTS "orders_select_student"      ON public.orders;
DROP POLICY IF EXISTS "orders_insert_manager"      ON public.orders;
DROP POLICY IF EXISTS "orders_insert_student"      ON public.orders;
DROP POLICY IF EXISTS "orders_update_manager"      ON public.orders;
DROP POLICY IF EXISTS "orders_update_employee"     ON public.orders;
DROP POLICY IF EXISTS "orders_update_agent"        ON public.orders;
DROP POLICY IF EXISTS "orders_delete_manager"      ON public.orders;
DROP POLICY IF EXISTS "orders_anon_all"            ON public.orders;

-- student_progress
DROP POLICY IF EXISTS "progress_all_manager"       ON public.student_progress;
DROP POLICY IF EXISTS "progress_select_employee"   ON public.student_progress;
DROP POLICY IF EXISTS "progress_update_employee"   ON public.student_progress;
DROP POLICY IF EXISTS "progress_select_agent"      ON public.student_progress;
DROP POLICY IF EXISTS "progress_select_student"    ON public.student_progress;
DROP POLICY IF EXISTS "progress_update_student"    ON public.student_progress;
DROP POLICY IF EXISTS "progress_anon_all"          ON public.student_progress;

-- messages
DROP POLICY IF EXISTS "messages_all_manager"       ON public.messages;
DROP POLICY IF EXISTS "messages_select_employee"   ON public.messages;
DROP POLICY IF EXISTS "messages_insert_employee"   ON public.messages;
DROP POLICY IF EXISTS "messages_select_agent"      ON public.messages;
DROP POLICY IF EXISTS "messages_insert_agent"      ON public.messages;
DROP POLICY IF EXISTS "messages_select_student"    ON public.messages;
DROP POLICY IF EXISTS "messages_insert_student"    ON public.messages;
DROP POLICY IF EXISTS "messages_anon_all"          ON public.messages;

-- employee_tasks
DROP POLICY IF EXISTS "etasks_all_manager"         ON public.employee_tasks;
DROP POLICY IF EXISTS "etasks_select_employee"     ON public.employee_tasks;
DROP POLICY IF EXISTS "etasks_update_employee"     ON public.employee_tasks;
DROP POLICY IF EXISTS "etasks_select_agent"        ON public.employee_tasks;
DROP POLICY IF EXISTS "etasks_update_agent"        ON public.employee_tasks;
DROP POLICY IF EXISTS "etasks_anon_all"            ON public.employee_tasks;

-- work_hours
DROP POLICY IF EXISTS "wh_all_manager"             ON public.work_hours;
DROP POLICY IF EXISTS "wh_select_employee"         ON public.work_hours;
DROP POLICY IF EXISTS "wh_insert_employee"         ON public.work_hours;
DROP POLICY IF EXISTS "wh_update_own_employee"     ON public.work_hours;
DROP POLICY IF EXISTS "wh_own_agent"               ON public.work_hours;
DROP POLICY IF EXISTS "wh_insert_agent"            ON public.work_hours;
DROP POLICY IF EXISTS "wh_anon_all"                ON public.work_hours;

-- accounting_transactions
DROP POLICY IF EXISTS "accounting_all_manager"     ON public.accounting_transactions;
DROP POLICY IF EXISTS "accounting_select_employee" ON public.accounting_transactions;
DROP POLICY IF EXISTS "accounting_insert_employee" ON public.accounting_transactions;
DROP POLICY IF EXISTS "accounting_anon_all"        ON public.accounting_transactions;

-- archived_files
DROP POLICY IF EXISTS "files_all_manager"          ON public.archived_files;
DROP POLICY IF EXISTS "files_select_employee"      ON public.archived_files;
DROP POLICY IF EXISTS "files_insert_employee"      ON public.archived_files;
DROP POLICY IF EXISTS "files_select_agent"         ON public.archived_files;
DROP POLICY IF EXISTS "files_select_student"       ON public.archived_files;
DROP POLICY IF EXISTS "files_anon_all"             ON public.archived_files;

-- step_assignments
DROP POLICY IF EXISTS "step_assignments_all_manager"    ON public.step_assignments;
DROP POLICY IF EXISTS "step_assignments_select_employee" ON public.step_assignments;
DROP POLICY IF EXISTS "step_assignments_anon_all"       ON public.step_assignments;

-- order_types
DROP POLICY IF EXISTS "order_types_select_all"     ON public.order_types;
DROP POLICY IF EXISTS "order_types_write_manager"  ON public.order_types;
DROP POLICY IF EXISTS "order_types_update_manager" ON public.order_types;
DROP POLICY IF EXISTS "order_types_delete_manager" ON public.order_types;
DROP POLICY IF EXISTS "order_types_anon_read"      ON public.order_types;

-- notifications
DROP POLICY IF EXISTS "notif_own_user"             ON public.notifications;
DROP POLICY IF EXISTS "notif_update_own"           ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_staff"         ON public.notifications;
DROP POLICY IF EXISTS "notif_select_manager"       ON public.notifications;
DROP POLICY IF EXISTS "notif_anon_all"             ON public.notifications;

-- employee_hourly_rates
DROP POLICY IF EXISTS "ehr_all_manager"            ON public.employee_hourly_rates;
DROP POLICY IF EXISTS "ehr_select_own"             ON public.employee_hourly_rates;
DROP POLICY IF EXISTS "ehr_anon_all"               ON public.employee_hourly_rates;

-- company_accounting
DROP POLICY IF EXISTS "ca_all_manager"             ON public.company_accounting;
DROP POLICY IF EXISTS "ca_select_employee"         ON public.company_accounting;
DROP POLICY IF EXISTS "ca_insert_employee"         ON public.company_accounting;
DROP POLICY IF EXISTS "ca_anon_all"                ON public.company_accounting;

-- employee_reports
DROP POLICY IF EXISTS "ereports_all_manager"       ON public.employee_reports;
DROP POLICY IF EXISTS "ereports_select_employee"   ON public.employee_reports;
DROP POLICY IF EXISTS "ereports_write_own_employee" ON public.employee_reports;
DROP POLICY IF EXISTS "ereports_anon_all"          ON public.employee_reports;


-- ═══════════════════════════════════════════
-- STEP 2: حذف همه FK constraint ها
-- ═══════════════════════════════════════════

ALTER TABLE public.profiles     DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.orders       DROP CONSTRAINT IF EXISTS orders_student_id_fkey;
ALTER TABLE public.orders       DROP CONSTRAINT IF EXISTS orders_assigned_agent_id_fkey;
ALTER TABLE public.orders       DROP CONSTRAINT IF EXISTS orders_order_type_id_fkey;
ALTER TABLE public.student_progress DROP CONSTRAINT IF EXISTS student_progress_student_id_fkey;
ALTER TABLE public.employee_tasks   DROP CONSTRAINT IF EXISTS employee_tasks_assigned_to_fkey;
ALTER TABLE public.employee_tasks   DROP CONSTRAINT IF EXISTS employee_tasks_created_by_fkey;
ALTER TABLE public.employee_tasks   DROP CONSTRAINT IF EXISTS employee_tasks_student_id_fkey;
ALTER TABLE public.employee_tasks   DROP CONSTRAINT IF EXISTS employee_tasks_order_id_fkey;
ALTER TABLE public.work_hours       DROP CONSTRAINT IF EXISTS work_hours_employee_id_fkey;
ALTER TABLE public.work_hours       DROP CONSTRAINT IF EXISTS work_hours_reviewed_by_fkey;
ALTER TABLE public.messages         DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages         DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
ALTER TABLE public.messages         DROP CONSTRAINT IF EXISTS messages_order_id_fkey;
ALTER TABLE public.accounting_transactions DROP CONSTRAINT IF EXISTS accounting_transactions_order_id_fkey;
ALTER TABLE public.accounting_transactions DROP CONSTRAINT IF EXISTS accounting_transactions_created_by_fkey;
ALTER TABLE public.archived_files   DROP CONSTRAINT IF EXISTS archived_files_student_id_fkey;
ALTER TABLE public.archived_files   DROP CONSTRAINT IF EXISTS archived_files_order_id_fkey;
ALTER TABLE public.archived_files   DROP CONSTRAINT IF EXISTS archived_files_uploaded_by_fkey;
ALTER TABLE public.step_assignments DROP CONSTRAINT IF EXISTS step_assignments_employee_id_fkey;
ALTER TABLE public.notifications    DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications    DROP CONSTRAINT IF EXISTS notifications_order_id_fkey;
ALTER TABLE public.notifications    DROP CONSTRAINT IF EXISTS notifications_task_id_fkey;
ALTER TABLE public.employee_reports DROP CONSTRAINT IF EXISTS employee_reports_employee_id_fkey;
ALTER TABLE public.company_accounting DROP CONSTRAINT IF EXISTS company_accounting_person_id_fkey;
ALTER TABLE public.company_accounting DROP CONSTRAINT IF EXISTS company_accounting_order_tx_id_fkey;
ALTER TABLE public.company_accounting DROP CONSTRAINT IF EXISTS company_accounting_created_by_fkey;


-- ═══════════════════════════════════════════
-- STEP 3: تبدیل ID ها به TEXT
-- ═══════════════════════════════════════════

ALTER TABLE public.profiles         ALTER COLUMN id         TYPE TEXT;
ALTER TABLE public.profiles         ALTER COLUMN id         DROP DEFAULT;

ALTER TABLE public.orders           ALTER COLUMN id                 TYPE TEXT;
ALTER TABLE public.orders           ALTER COLUMN id                 DROP DEFAULT;
ALTER TABLE public.orders           ALTER COLUMN student_id         TYPE TEXT;
ALTER TABLE public.orders           ALTER COLUMN assigned_agent_id  TYPE TEXT;

ALTER TABLE public.student_progress ALTER COLUMN student_id         TYPE TEXT;
ALTER TABLE public.student_progress ALTER COLUMN student_id         DROP NOT NULL;

ALTER TABLE public.employee_tasks   ALTER COLUMN id                 TYPE TEXT;
ALTER TABLE public.employee_tasks   ALTER COLUMN id                 DROP DEFAULT;
ALTER TABLE public.employee_tasks   ALTER COLUMN assigned_to        TYPE TEXT;
ALTER TABLE public.employee_tasks   ALTER COLUMN assigned_to        DROP NOT NULL;
ALTER TABLE public.employee_tasks   ALTER COLUMN created_by         TYPE TEXT;
ALTER TABLE public.employee_tasks   ALTER COLUMN student_id         TYPE TEXT;
ALTER TABLE public.employee_tasks   ALTER COLUMN order_id           TYPE TEXT;

ALTER TABLE public.work_hours       ALTER COLUMN id                 TYPE TEXT;
ALTER TABLE public.work_hours       ALTER COLUMN id                 DROP DEFAULT;
ALTER TABLE public.work_hours       ALTER COLUMN employee_id        TYPE TEXT;

ALTER TABLE public.messages         ALTER COLUMN sender_id          TYPE TEXT;
ALTER TABLE public.messages         ALTER COLUMN receiver_id        TYPE TEXT;
ALTER TABLE public.messages         ALTER COLUMN order_id           TYPE TEXT;

ALTER TABLE public.accounting_transactions ALTER COLUMN order_id    TYPE TEXT;
ALTER TABLE public.accounting_transactions ALTER COLUMN created_by  TYPE TEXT;

ALTER TABLE public.archived_files   ALTER COLUMN id                 TYPE TEXT;
ALTER TABLE public.archived_files   ALTER COLUMN id                 DROP DEFAULT;
ALTER TABLE public.archived_files   ALTER COLUMN student_id         TYPE TEXT;
ALTER TABLE public.archived_files   ALTER COLUMN order_id           TYPE TEXT;
ALTER TABLE public.archived_files   ALTER COLUMN uploaded_by        TYPE TEXT;

-- ═══════════════════════════════════════════
-- STEP 4: ستون‌های اضافی
-- ═══════════════════════════════════════════

ALTER TABLE public.archived_files
    ADD COLUMN IF NOT EXISTS category       TEXT,
    ADD COLUMN IF NOT EXISTS author         TEXT,
    ADD COLUMN IF NOT EXISTS file_type      TEXT,
    ADD COLUMN IF NOT EXISTS display_url    TEXT,
    ADD COLUMN IF NOT EXISTS file_size_text TEXT;

-- employee_hourly_rates با TEXT employee_id
DROP TABLE IF EXISTS public.employee_hourly_rates;
CREATE TABLE public.employee_hourly_rates (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id  TEXT UNIQUE NOT NULL,
    hourly_rate  NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency     TEXT DEFAULT 'تومان',
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.employee_hourly_rates ENABLE ROW LEVEL SECURITY;

-- Storage bucket آرشیو
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('archive-files', 'archive-files', true, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "archive_anon_all" ON storage.objects;
CREATE POLICY "archive_anon_all"
    ON storage.objects FOR ALL TO anon
    USING (bucket_id = 'archive-files')
    WITH CHECK (bucket_id = 'archive-files');


-- ═══════════════════════════════════════════
-- STEP 5: یک policy ساده برای همه جداول
-- anon = دسترسی کامل (چون auth نداریم)
-- ═══════════════════════════════════════════

CREATE POLICY "anon_all" ON public.profiles             FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON public.orders               FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON public.student_progress     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON public.messages             FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON public.employee_tasks       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON public.work_hours           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON public.accounting_transactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON public.archived_files       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON public.step_assignments     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON public.order_types          FOR SELECT TO anon USING (true);
CREATE POLICY "anon_all" ON public.notifications        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON public.employee_hourly_rates FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON public.company_accounting   FOR ALL TO anon USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════
-- تمام ✓
-- ═══════════════════════════════════════════
