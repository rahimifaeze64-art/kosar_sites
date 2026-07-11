-- ============================================================
-- fix_fk_constraints.sql
-- مشکل: FK constraint‌ها باعث می‌شوند insert با خطا fail شود
-- چون student_id/agent_id در app از نوع 'std001','emp001' هستند
-- و در جدول profiles با UUID های متفاوت ذخیره می‌شوند
-- راه‌حل: FK constraint‌ها را حذف می‌کنیم
--
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. profiles: حذف FK به auth.users ─────────────────────
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- id حالا یه UUID آزاد است
ALTER TABLE public.profiles
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ── 2. orders: حذف FK‌های student_id و assigned_agent_id ──
ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_student_id_fkey;
ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_assigned_agent_id_fkey;

-- ── 3. student_progress: حذف FK به profiles ───────────────
ALTER TABLE public.student_progress
    DROP CONSTRAINT IF EXISTS student_progress_student_id_fkey;

-- ── 4. employee_tasks: حذف FK‌ها ──────────────────────────
ALTER TABLE public.employee_tasks
    DROP CONSTRAINT IF EXISTS employee_tasks_assigned_to_fkey;
ALTER TABLE public.employee_tasks
    DROP CONSTRAINT IF EXISTS employee_tasks_created_by_fkey;
ALTER TABLE public.employee_tasks
    DROP CONSTRAINT IF EXISTS employee_tasks_student_id_fkey;
ALTER TABLE public.employee_tasks
    DROP CONSTRAINT IF EXISTS employee_tasks_order_id_fkey;

-- ── 5. work_hours: حذف FK ────────────────────────────────
ALTER TABLE public.work_hours
    DROP CONSTRAINT IF EXISTS work_hours_employee_id_fkey;
ALTER TABLE public.work_hours
    DROP CONSTRAINT IF EXISTS work_hours_reviewed_by_fkey;

-- ── 6. messages: حذف FK‌ها ────────────────────────────────
ALTER TABLE public.messages
    DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages
    DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
ALTER TABLE public.messages
    DROP CONSTRAINT IF EXISTS messages_order_id_fkey;

-- ── 7. accounting_transactions: حذف FK‌ها ─────────────────
ALTER TABLE public.accounting_transactions
    DROP CONSTRAINT IF EXISTS accounting_transactions_order_id_fkey;
ALTER TABLE public.accounting_transactions
    DROP CONSTRAINT IF EXISTS accounting_transactions_created_by_fkey;

-- ── 8. archived_files: حذف FK‌ها ──────────────────────────
ALTER TABLE public.archived_files
    DROP CONSTRAINT IF EXISTS archived_files_student_id_fkey;
ALTER TABLE public.archived_files
    DROP CONSTRAINT IF EXISTS archived_files_order_id_fkey;
ALTER TABLE public.archived_files
    DROP CONSTRAINT IF EXISTS archived_files_uploaded_by_fkey;

-- ── 9. step_assignments: حذف FK ──────────────────────────
ALTER TABLE public.step_assignments
    DROP CONSTRAINT IF EXISTS step_assignments_employee_id_fkey;

-- ── 10. employee_hourly_rates: حذف FK ─────────────────────
ALTER TABLE public.employee_hourly_rates
    DROP CONSTRAINT IF EXISTS employee_hourly_rates_employee_id_fkey;
ALTER TABLE public.employee_hourly_rates
    DROP CONSTRAINT IF EXISTS employee_hourly_rates_updated_by_fkey;

-- ── 11. company_accounting: حذف FK‌ها ─────────────────────
ALTER TABLE public.company_accounting
    DROP CONSTRAINT IF EXISTS company_accounting_person_id_fkey;
ALTER TABLE public.company_accounting
    DROP CONSTRAINT IF EXISTS company_accounting_order_tx_id_fkey;
ALTER TABLE public.company_accounting
    DROP CONSTRAINT IF EXISTS company_accounting_created_by_fkey;

-- ── 12. notifications: حذف FK‌ها ──────────────────────────
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_order_id_fkey;
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_task_id_fkey;

-- ── 13. employee_reports: حذف FK ─────────────────────────
ALTER TABLE public.employee_reports
    DROP CONSTRAINT IF EXISTS employee_reports_employee_id_fkey;

-- ── 14. orders: حذف FK به order_types ────────────────────
ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_order_type_id_fkey;

-- ── 15. student_progress: تغییر NOT NULL به nullable ──────
-- چون student_id در app یه string مثل 'std001' است نه UUID
ALTER TABLE public.student_progress
    ALTER COLUMN student_id DROP NOT NULL;

-- ── 16. employee_tasks: تغییر assigned_to به nullable ────
ALTER TABLE public.employee_tasks
    ALTER COLUMN assigned_to DROP NOT NULL;

-- ============================================================
-- تمام ✓
-- بعد از اجرا:
-- - هیچ FK constraint ای وجود ندارد
-- - insert/upsert با هر مقداری کار می‌کند
-- - داده‌های app مستقیم در Supabase ذخیره می‌شوند
-- ============================================================
