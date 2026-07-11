-- ============================================================
-- fix_rls_anon.sql
-- مشکل: کاربران با Supabase Auth لاگین نیستند (local login)
-- نتیجه: auth.uid() = null → همه RLS policy‌های authenticated رد می‌شوند
-- راه‌حل: به anon role هم دسترسی کامل داده می‌شود
--
-- این اسکریپت را در:
--   Supabase Dashboard → SQL Editor
-- اجرا کن
-- ============================================================

-- ── orders ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "orders_anon_all" ON public.orders;
CREATE POLICY "orders_anon_all"
    ON public.orders FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── profiles ────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_anon_all" ON public.profiles;
CREATE POLICY "profiles_anon_all"
    ON public.profiles FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── student_progress ────────────────────────────────────────
DROP POLICY IF EXISTS "progress_anon_all" ON public.student_progress;
CREATE POLICY "progress_anon_all"
    ON public.student_progress FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── messages ────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_anon_all" ON public.messages;
CREATE POLICY "messages_anon_all"
    ON public.messages FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── employee_tasks ──────────────────────────────────────────
DROP POLICY IF EXISTS "etasks_anon_all" ON public.employee_tasks;
CREATE POLICY "etasks_anon_all"
    ON public.employee_tasks FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── work_hours ──────────────────────────────────────────────
DROP POLICY IF EXISTS "wh_anon_all" ON public.work_hours;
CREATE POLICY "wh_anon_all"
    ON public.work_hours FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── accounting_transactions ─────────────────────────────────
DROP POLICY IF EXISTS "accounting_anon_all" ON public.accounting_transactions;
CREATE POLICY "accounting_anon_all"
    ON public.accounting_transactions FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── archived_files ──────────────────────────────────────────
DROP POLICY IF EXISTS "files_anon_all" ON public.archived_files;
CREATE POLICY "files_anon_all"
    ON public.archived_files FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── step_assignments ────────────────────────────────────────
DROP POLICY IF EXISTS "step_assignments_anon_all" ON public.step_assignments;
CREATE POLICY "step_assignments_anon_all"
    ON public.step_assignments FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── employee_hourly_rates ───────────────────────────────────
DROP POLICY IF EXISTS "ehr_anon_all" ON public.employee_hourly_rates;
CREATE POLICY "ehr_anon_all"
    ON public.employee_hourly_rates FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── company_accounting ──────────────────────────────────────
DROP POLICY IF EXISTS "ca_anon_all" ON public.company_accounting;
CREATE POLICY "ca_anon_all"
    ON public.company_accounting FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── notifications ───────────────────────────────────────────
DROP POLICY IF EXISTS "notif_anon_all" ON public.notifications;
CREATE POLICY "notif_anon_all"
    ON public.notifications FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ── order_types ─────────────────────────────────────────────
DROP POLICY IF EXISTS "order_types_anon_read" ON public.order_types;
CREATE POLICY "order_types_anon_read"
    ON public.order_types FOR SELECT TO anon
    USING (true);

-- ── Storage: archive-files ──────────────────────────────────
DROP POLICY IF EXISTS "archive_anon_all" ON storage.objects;
CREATE POLICY "archive_anon_all"
    ON storage.objects FOR ALL TO anon
    USING (bucket_id = 'archive-files')
    WITH CHECK (bucket_id = 'archive-files');

-- ============================================================
-- تمام ✓
-- بعد از اجرا، سفارشات و سایر داده‌ها در Supabase ذخیره می‌شوند
-- ============================================================
