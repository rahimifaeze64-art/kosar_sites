-- ============================================================================
-- سیستم مدیریت تحصیلی کوثر — Kowsar Educational Management System
-- Complete Supabase PostgreSQL Schema — نسخه ۲ (v2)
-- اسکریپت کامل و ایمن برای اجرای مجدد (Idempotent) — قابل اجرا در SQL Editor سوپابیس
-- ============================================================================
-- این نسخه هم روی دیتابیس تازه و هم روی دیتابیسی که نسخه‌ی قبلی این اسکریپت
-- را اجرا کرده بدون خطا کار می‌کند (upgrade-safe).
-- This version is safe to run both on a fresh database and on one that
-- already ran a previous version of this script (upgrade-safe).
-- ============================================================================


-- ============================================================================
-- SECTION 0 | EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================================
-- SECTION 1 | TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 profiles — پروفایل کاربران (توسعه‌ی auth.users سوپابیس)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    username         TEXT UNIQUE NOT NULL,
    role             TEXT NOT NULL CHECK (role IN ('manager','employee','agent','student')),
    email            TEXT,
    phone            TEXT,
    active           BOOLEAN DEFAULT true,
    department       TEXT,
    university       TEXT,
    student_id       TEXT UNIQUE,
    field            TEXT,
    -- توجه: مقادیر استاندارد انگلیسی نگه داشته شده‌اند (masters/phd/bachelor).
    -- تبدیل «ارشد»/«دکتری»/«کارشناسی» باید در فرانت یا اسکریپت migration انجام شود.
    -- NOTE: kept as standardized English enum; map Persian labels in the
    -- frontend/migration layer, not in the database.
    degree           TEXT CHECK (degree IN ('masters','phd','bachelor')),
    passport_number  TEXT,
    bachelor_field   TEXT,
    specialization   TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'پروفایل کاربران سیستم / User profiles extending auth.users';

-- ----------------------------------------------------------------------------
-- 1.2 order_types — کاتالوگ انواع سفارش (۳۷ نوع خدمت + قیمت بر اساس مقطع)
-- Order type catalog: service name + base pricing per degree level
-- جدید در v2 / NEW in v2
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT UNIQUE NOT NULL,       -- شناسه یکتا مثل 'thesis_topics', 'translation_certificate'
    name            TEXT NOT NULL,               -- نام فارسی نمایشی، مثل 'عناوین رساله ارشد'
    category        TEXT,                        -- دسته‌بندی، مثل 'ترجمه', 'مقاله', 'اداری'
    price_bachelor  NUMERIC(12,2),
    price_masters   NUMERIC(12,2),
    price_phd       NUMERIC(12,2),
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.order_types IS 'کاتالوگ انواع سفارش و قیمت‌گذاری / Order type catalog and pricing';

-- ----------------------------------------------------------------------------
-- 1.3 orders — سفارشات / پرونده‌های دانشجویان
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status             TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
    stage              TEXT,
    progress           INTEGER DEFAULT 0,
    assigned_agent_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    total_amount       NUMERIC(12,2) DEFAULT 0,
    paid_amount        NUMERIC(12,2) DEFAULT 0,
    payment_status     TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
    description        TEXT,
    tasks              JSONB DEFAULT '[]',
    work_log           JSONB DEFAULT '[]',
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- --- نرمال‌سازی برای اجرای مجدد روی دیتابیس‌های قدیمی (upgrade path) ---
-- Normalization block: adds new columns / fixes constraints even if the
-- table already existed from a previous run of this script.

-- ستون نوع سفارش (ارجاع به کاتالوگ) / order type reference column
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type_id UUID REFERENCES public.order_types(id) ON DELETE SET NULL;

-- درصد تقسیم درآمد بین عامل و مدیر (پیش‌فرض ۶۰٪ عامل / ۴۰٪ مدیر)
-- Revenue split percentages (default 60% agent / 40% manager)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS revenue_agent_percent NUMERIC(5,2) DEFAULT 60;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS revenue_manager_percent NUMERIC(5,2) DEFAULT 40;

-- اصلاح مقادیر مجاز status: جایگزینی 'active' با 'in_progress' مطابق کد واقعی اپ
-- Fix status CHECK: replace 'active' with 'in_progress' to match the real app
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','in_progress','completed','cancelled'));

COMMENT ON TABLE public.orders IS 'سفارشات و پرونده‌های دانشجویان / Student orders and cases';
COMMENT ON COLUMN public.orders.order_type_id IS 'ارجاع به کاتالوگ نوع سفارش / reference to order_types catalog';
COMMENT ON COLUMN public.orders.revenue_agent_percent IS 'درصد سهم عامل از این سفارش / agent revenue share percent for this order';
COMMENT ON COLUMN public.orders.revenue_manager_percent IS 'درصد سهم مدیر از این سفارش / manager revenue share percent for this order';

-- ----------------------------------------------------------------------------
-- 1.4 student_progress — پیشرفت گام‌به‌گام دانشجو در هر مسیر
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_progress (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    path_type   TEXT NOT NULL CHECK (path_type IN ('defense','requirements','educational')),
    step_index  INTEGER NOT NULL,
    status      INTEGER DEFAULT 0 CHECK (status IN (0,1,2)),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, path_type, step_index)
);

COMMENT ON TABLE public.student_progress IS 'پیشرفت مراحل تحصیلی دانشجو / Student step-by-step progress';

-- ----------------------------------------------------------------------------
-- 1.5 step_assignments — تخصیص هر مرحله (از هر مسیر) به یک کارمند مشخص
-- Global assignment of who (which employee) is responsible for each step
-- جدید در v2 / NEW in v2 — این با student_progress فرق دارد: آن جدول
-- پیشرفتِ هر دانشجوست، این جدول تخصیصِ سراسریِ مسئولیتِ هر مرحله است.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.step_assignments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_type    TEXT NOT NULL CHECK (path_type IN ('defense','requirements','educational')),
    step_index   INTEGER NOT NULL,
    employee_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (path_type, step_index)
);

COMMENT ON TABLE public.step_assignments IS 'تخصیص سراسری مسئولیت هر مرحله به کارمند / Global step-to-employee responsibility mapping';

-- ----------------------------------------------------------------------------
-- 1.6 messages — پیام‌های داخلی بین کاربران
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    receiver_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_id     UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    content      TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    read_at      TIMESTAMPTZ
);

-- پیام‌های سیستمی (مثل اعلان خودکار «مرحله به شما محول شد») از چت انسانی جدا می‌شوند
-- System-generated messages (e.g. auto step-assignment notices) are flagged separately
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

COMMENT ON TABLE public.messages IS 'پیام‌های داخلی بین کاربران / Internal user messages';
COMMENT ON COLUMN public.messages.is_system IS 'true اگر پیام خودکار سیستمی باشد نه چت انسانی / true for system-generated notices';

-- ----------------------------------------------------------------------------
-- 1.7 accounting_transactions — تراکنش‌های مالی
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    type        TEXT NOT NULL CHECK (type IN ('payment','refund','expense','income')),
    amount      NUMERIC(12,2) NOT NULL,
    description TEXT,
    created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- سهم محاسبه‌شده‌ی عامل و مدیر از این تراکنش (خودکار پر می‌شود، پایین را ببینید)
-- Computed agent/manager share for this transaction (auto-filled, see trigger below)
ALTER TABLE public.accounting_transactions ADD COLUMN IF NOT EXISTS agent_share NUMERIC(12,2);
ALTER TABLE public.accounting_transactions ADD COLUMN IF NOT EXISTS manager_share NUMERIC(12,2);

COMMENT ON TABLE public.accounting_transactions IS 'تراکنش‌های مالی / Financial transactions';
COMMENT ON COLUMN public.accounting_transactions.agent_share IS 'سهم عامل از این تراکنش، بر اساس درصد تعریف‌شده روی سفارش / agent share computed from the order revenue split';
COMMENT ON COLUMN public.accounting_transactions.manager_share IS 'سهم مدیر از این تراکنش / manager share computed from the order revenue split';

-- ----------------------------------------------------------------------------
-- 1.8 archived_files — آرشیو فایل‌های دانشجویان
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.archived_files (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_id     UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    file_name    TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    file_size    BIGINT,
    uploaded_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.archived_files IS 'آرشیو فایل‌های دانشجویان / Student file archive';


-- ============================================================================
-- SECTION 2 | FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 handle_new_user — ساخت خودکار پروفایل هنگام ثبت‌نام کاربر جدید
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'کاربر جدید'),
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- 2.2 get_user_role — دریافت نقش کاربر جاری (برای استفاده در سیاست‌های RLS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ----------------------------------------------------------------------------
-- 2.3 set_updated_at — به‌روزرسانی خودکار فیلد updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2.4 calculate_revenue_share — محاسبه خودکار سهم عامل/مدیر هنگام ثبت تراکنش
-- Auto-computes agent_share / manager_share on accounting_transactions
-- بر اساس درصدهای تعریف‌شده روی سفارش مربوطه (orders.revenue_*_percent)
-- جدید در v2 / NEW in v2
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_revenue_share()
RETURNS TRIGGER AS $$
DECLARE
  v_agent_pct NUMERIC(5,2);
  v_manager_pct NUMERIC(5,2);
BEGIN
  -- فقط برای تراکنش‌های درآمدی و در صورت وجود سفارش مرتبط محاسبه می‌شود
  IF NEW.order_id IS NOT NULL AND NEW.type IN ('payment','income') THEN
    SELECT revenue_agent_percent, revenue_manager_percent
      INTO v_agent_pct, v_manager_pct
      FROM public.orders WHERE id = NEW.order_id;

    IF v_agent_pct IS NOT NULL THEN
      NEW.agent_share := ROUND(NEW.amount * v_agent_pct / 100, 2);
    END IF;
    IF v_manager_pct IS NOT NULL THEN
      NEW.manager_share := ROUND(NEW.amount * v_manager_pct / 100, 2);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- SECTION 3 | TRIGGERS
-- ============================================================================

-- 3.1 ساخت پروفایل بعد از ثبت‌نام در auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3.2 به‌روزرسانی خودکار updated_at روی orders
DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3.3 به‌روزرسانی خودکار updated_at روی step_assignments (جدید در v2)
DROP TRIGGER IF EXISTS trg_step_assignments_updated_at ON public.step_assignments;
CREATE TRIGGER trg_step_assignments_updated_at
  BEFORE UPDATE ON public.step_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3.4 محاسبه خودکار سهم مالی موقع ثبت تراکنش (جدید در v2)
DROP TRIGGER IF EXISTS trg_accounting_revenue_share ON public.accounting_transactions;
CREATE TRIGGER trg_accounting_revenue_share
  BEFORE INSERT ON public.accounting_transactions
  FOR EACH ROW EXECUTE FUNCTION public.calculate_revenue_share();


-- ============================================================================
-- SECTION 4 | INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_student_id        ON public.orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_agent_id           ON public.orders(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_status             ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at         ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_type         ON public.orders(order_type_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_student_id ON public.student_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_path     ON public.student_progress(path_type);
CREATE INDEX IF NOT EXISTS idx_step_assignments_employee ON public.step_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver         ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender           ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_order            ON public.messages(order_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role             ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_username         ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_accounting_order_id       ON public.accounting_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_archived_files_student_id ON public.archived_files(student_id);
CREATE INDEX IF NOT EXISTS idx_archived_files_order_id   ON public.archived_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_types_code          ON public.order_types(code);


-- ============================================================================
-- SECTION 5 | ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_files          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_types             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_assignments        ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 5.1 profiles
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_select_manager" ON public.profiles;
CREATE POLICY "profiles_select_manager" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "profiles_select_employee" ON public.profiles;
CREATE POLICY "profiles_select_employee" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "profiles_select_agent" ON public.profiles;
CREATE POLICY "profiles_select_agent" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'agent');

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_manager" ON public.profiles;
CREATE POLICY "profiles_insert_manager" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "profiles_update_manager" ON public.profiles;
CREATE POLICY "profiles_update_manager" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_delete_manager" ON public.profiles;
CREATE POLICY "profiles_delete_manager" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'manager');


-- ----------------------------------------------------------------------------
-- 5.2 orders
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "orders_select_manager" ON public.orders;
CREATE POLICY "orders_select_manager" ON public.orders
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "orders_select_employee" ON public.orders;
CREATE POLICY "orders_select_employee" ON public.orders
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "orders_select_agent" ON public.orders;
CREATE POLICY "orders_select_agent" ON public.orders
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'agent' AND assigned_agent_id = auth.uid());

DROP POLICY IF EXISTS "orders_select_student" ON public.orders;
CREATE POLICY "orders_select_student" ON public.orders
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'student' AND student_id = auth.uid());

DROP POLICY IF EXISTS "orders_insert_manager" ON public.orders;
CREATE POLICY "orders_insert_manager" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "orders_insert_student" ON public.orders;
CREATE POLICY "orders_insert_student" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'student' AND student_id = auth.uid());

DROP POLICY IF EXISTS "orders_update_manager" ON public.orders;
CREATE POLICY "orders_update_manager" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "orders_update_employee" ON public.orders;
CREATE POLICY "orders_update_employee" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'employee')
  WITH CHECK (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "orders_update_agent" ON public.orders;
CREATE POLICY "orders_update_agent" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'agent' AND assigned_agent_id = auth.uid())
  WITH CHECK (public.get_user_role() = 'agent' AND assigned_agent_id = auth.uid());

DROP POLICY IF EXISTS "orders_delete_manager" ON public.orders;
CREATE POLICY "orders_delete_manager" ON public.orders
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'manager');


-- ----------------------------------------------------------------------------
-- 5.3 student_progress
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "progress_all_manager" ON public.student_progress;
CREATE POLICY "progress_all_manager" ON public.student_progress
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "progress_select_employee" ON public.student_progress;
CREATE POLICY "progress_select_employee" ON public.student_progress
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "progress_update_employee" ON public.student_progress;
CREATE POLICY "progress_update_employee" ON public.student_progress
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'employee')
  WITH CHECK (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "progress_select_agent" ON public.student_progress;
CREATE POLICY "progress_select_agent" ON public.student_progress
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'agent'
    AND student_id IN (
      SELECT o.student_id FROM public.orders o WHERE o.assigned_agent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "progress_select_student" ON public.student_progress;
CREATE POLICY "progress_select_student" ON public.student_progress
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'student' AND student_id = auth.uid());

DROP POLICY IF EXISTS "progress_update_student" ON public.student_progress;
CREATE POLICY "progress_update_student" ON public.student_progress
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'student' AND student_id = auth.uid())
  WITH CHECK (public.get_user_role() = 'student' AND student_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 5.4 messages
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "messages_all_manager" ON public.messages;
CREATE POLICY "messages_all_manager" ON public.messages
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "messages_select_employee" ON public.messages;
CREATE POLICY "messages_select_employee" ON public.messages
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "messages_insert_employee" ON public.messages;
CREATE POLICY "messages_insert_employee" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "messages_select_agent" ON public.messages;
CREATE POLICY "messages_select_agent" ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'agent'
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  );

DROP POLICY IF EXISTS "messages_insert_agent" ON public.messages;
CREATE POLICY "messages_insert_agent" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'agent'
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  );

DROP POLICY IF EXISTS "messages_select_student" ON public.messages;
CREATE POLICY "messages_select_student" ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'student'
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  );

DROP POLICY IF EXISTS "messages_insert_student" ON public.messages;
CREATE POLICY "messages_insert_student" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'student'
    AND sender_id = auth.uid()
  );


-- ----------------------------------------------------------------------------
-- 5.5 accounting_transactions — agent و student دسترسی ندارند
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "accounting_all_manager" ON public.accounting_transactions;
CREATE POLICY "accounting_all_manager" ON public.accounting_transactions
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "accounting_select_employee" ON public.accounting_transactions;
CREATE POLICY "accounting_select_employee" ON public.accounting_transactions
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "accounting_insert_employee" ON public.accounting_transactions;
CREATE POLICY "accounting_insert_employee" ON public.accounting_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'employee');


-- ----------------------------------------------------------------------------
-- 5.6 archived_files
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "files_all_manager" ON public.archived_files;
CREATE POLICY "files_all_manager" ON public.archived_files
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "files_select_employee" ON public.archived_files;
CREATE POLICY "files_select_employee" ON public.archived_files
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "files_insert_employee" ON public.archived_files;
CREATE POLICY "files_insert_employee" ON public.archived_files
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "files_select_agent" ON public.archived_files;
CREATE POLICY "files_select_agent" ON public.archived_files
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'agent'
    AND student_id IN (
      SELECT o.student_id FROM public.orders o WHERE o.assigned_agent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "files_select_student" ON public.archived_files;
CREATE POLICY "files_select_student" ON public.archived_files
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'student' AND student_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 5.7 order_types — کاتالوگ عمومی؛ همه نقش‌ها می‌بینند، فقط مدیر تغییر می‌دهد
-- Public catalog: all roles can read, only manager can modify
-- جدید در v2 / NEW in v2
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "order_types_select_all" ON public.order_types;
CREATE POLICY "order_types_select_all" ON public.order_types
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "order_types_write_manager" ON public.order_types;
CREATE POLICY "order_types_write_manager" ON public.order_types
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "order_types_update_manager" ON public.order_types;
CREATE POLICY "order_types_update_manager" ON public.order_types
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "order_types_delete_manager" ON public.order_types;
CREATE POLICY "order_types_delete_manager" ON public.order_types
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'manager');


-- ----------------------------------------------------------------------------
-- 5.8 step_assignments — مدیر تخصیص می‌دهد؛ مدیر و کارمند مشاهده می‌کنند
-- Manager assigns; manager and employees can view; agent/student have no access
-- جدید در v2 / NEW in v2
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "step_assignments_all_manager" ON public.step_assignments;
CREATE POLICY "step_assignments_all_manager" ON public.step_assignments
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "step_assignments_select_employee" ON public.step_assignments;
CREATE POLICY "step_assignments_select_employee" ON public.step_assignments
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'employee');


-- ============================================================================
-- SECTION 6 | STORAGE BUCKET SETUP (راهنما — دستی از طریق داشبورد)
-- ============================================================================
-- 1) در داشبورد سوپابیس > Storage یک باکت با نام دقیق student-files بسازید.
-- 2) تنظیمات: Public bucket = OFF، File size limit = 50MB
-- 3) Allowed MIME types:
--    application/pdf
--    application/msword                                              (.doc)
--    application/vnd.openxmlformats-officedocument.wordprocessingml.document (.docx)
--    image/jpeg                                                       (.jpg)
--    image/png                                                        (.png)
-- 4) Storage Policies مشابه منطق archived_files تعریف شود.
-- ============================================================================


-- ============================================================================
-- پایان اسکریپت — END OF SCRIPT
-- ============================================================================


-- ============================================================================
-- SECTION 7 | MISSING TABLES (v2 — addendum)
-- جداول باقی‌مانده که در اسکریپت اصلی وجود نداشتند
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 7.1 employee_tasks — وظایف کارمندان و دکترین
-- ----------------------------------------------------------------------------
-- در localStorage با کلید 'employee_tasks' به شکل { empId: [...tasks] } ذخیره می‌شود.
-- هر task می‌تواند دستی (توسط مدیر) یا خودکار (توسط StepAssignmentModule) ایجاد شود.
-- In localStorage stored as { empId: [...tasks] }. Tasks can be manual or
-- auto-generated by the step-assignment system.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- کارمند یا دکتری که وظیفه به او تخصیص داده شده
    assigned_to     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- ایجادکننده وظیفه (معمولاً مدیر)
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    title           TEXT NOT NULL,
    description     TEXT,
    priority        TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','medium','high')),
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
    due_date        DATE,

    -- فیلدهای مرتبط با وظایف خودکار step-assignment
    -- Fields for auto-generated step tasks (isStepTask = true)
    is_step_task    BOOLEAN DEFAULT false,
    student_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    step_type       TEXT CHECK (step_type IN ('defense','requirements','educational')),
    step_index      INTEGER,
    step_name       TEXT,

    -- پیام صوتی (base64 یا URL فایل در Storage)
    -- Voice message: base64 data or Storage URL
    voice_message   TEXT,

    -- ارجاع اختیاری به سفارش مرتبط
    order_id        UUID REFERENCES public.orders(id) ON DELETE SET NULL,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.employee_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON TABLE public.employee_tasks IS 'وظایف کارمندان و دکترین — دستی یا خودکار از سیستم تخصیص مراحل / Employee and agent tasks (manual or auto-generated from step-assignment)';
COMMENT ON COLUMN public.employee_tasks.is_step_task IS 'true اگر وظیفه خودکار از سیستم پیشرفت مراحل ایجاد شده باشد';
COMMENT ON COLUMN public.employee_tasks.voice_message IS 'پیام صوتی ضمیمه — URL سوپابیس Storage یا داده base64';

-- trigger برای updated_at
DROP TRIGGER IF EXISTS trg_employee_tasks_updated_at ON public.employee_tasks;
CREATE TRIGGER trg_employee_tasks_updated_at
  BEFORE UPDATE ON public.employee_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS idx_employee_tasks_assigned_to ON public.employee_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_status       ON public.employee_tasks(status);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_student_id   ON public.employee_tasks(student_id);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_order_id     ON public.employee_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_step         ON public.employee_tasks(step_type, step_index);

-- RLS
ALTER TABLE public.employee_tasks ENABLE ROW LEVEL SECURITY;

-- مدیر: دسترسی کامل
DROP POLICY IF EXISTS "etasks_all_manager" ON public.employee_tasks;
CREATE POLICY "etasks_all_manager" ON public.employee_tasks
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

-- کارمند: مشاهده همه + ایجاد وظیفه برای خودش
DROP POLICY IF EXISTS "etasks_select_employee" ON public.employee_tasks;
CREATE POLICY "etasks_select_employee" ON public.employee_tasks
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "etasks_update_employee" ON public.employee_tasks;
CREATE POLICY "etasks_update_employee" ON public.employee_tasks
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'employee')
  WITH CHECK (public.get_user_role() = 'employee');

-- عامل: فقط وظایف خودش
DROP POLICY IF EXISTS "etasks_select_agent" ON public.employee_tasks;
CREATE POLICY "etasks_select_agent" ON public.employee_tasks
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'agent' AND assigned_to = auth.uid());

DROP POLICY IF EXISTS "etasks_update_agent" ON public.employee_tasks;
CREATE POLICY "etasks_update_agent" ON public.employee_tasks
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'agent' AND assigned_to = auth.uid())
  WITH CHECK (public.get_user_role() = 'agent' AND assigned_to = auth.uid());


-- ----------------------------------------------------------------------------
-- 7.2 work_hours — ساعات کاری و هزینه‌های کارمندان
-- ----------------------------------------------------------------------------
-- در localStorage با کلید 'work_hours_data' به شکل آرایه‌ای از رکوردها ذخیره می‌شود.
-- هر رکورد یا از نوع 'work' (ساعت کاری) یا 'expense' (هزینه) است.
-- In localStorage as a flat array; each record is either type='work' or 'expense'.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_hours (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_name   TEXT,  -- نام ذخیره‌شده برای سرعت نمایش / denormalized for display speed

    -- نوع رکورد: ساعت کاری یا هزینه
    type            TEXT NOT NULL DEFAULT 'work' CHECK (type IN ('work','expense')),

    date            DATE NOT NULL,

    -- فیلدهای مخصوص ساعت کاری (type = 'work')
    start_time      TIME,
    end_time        TIME,
    total_hours     NUMERIC(6,2),

    -- فیلدهای مخصوص هزینه (type = 'expense')
    amount          NUMERIC(12,2),

    description     TEXT,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),

    -- نرخ ساعتی در زمان ثبت (snapshot برای محاسبه حقوق)
    -- Snapshot of hourly rate at time of entry (for payroll calculation)
    hourly_rate     NUMERIC(12,2),

    -- مدیری که تأیید/رد کرده
    reviewed_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.work_hours IS 'ساعات کاری و هزینه‌های کارمندان / Employee work hours and expense entries';

DROP TRIGGER IF EXISTS trg_work_hours_updated_at ON public.work_hours;
CREATE TRIGGER trg_work_hours_updated_at
  BEFORE UPDATE ON public.work_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_work_hours_employee_id ON public.work_hours(employee_id);
CREATE INDEX IF NOT EXISTS idx_work_hours_date         ON public.work_hours(date);
CREATE INDEX IF NOT EXISTS idx_work_hours_type         ON public.work_hours(type);
CREATE INDEX IF NOT EXISTS idx_work_hours_status       ON public.work_hours(status);

ALTER TABLE public.work_hours ENABLE ROW LEVEL SECURITY;

-- مدیر: دسترسی کامل
DROP POLICY IF EXISTS "wh_all_manager" ON public.work_hours;
CREATE POLICY "wh_all_manager" ON public.work_hours
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

-- کارمند: مشاهده همه + ثبت خودش
DROP POLICY IF EXISTS "wh_select_employee" ON public.work_hours;
CREATE POLICY "wh_select_employee" ON public.work_hours
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "wh_insert_employee" ON public.work_hours;
CREATE POLICY "wh_insert_employee" ON public.work_hours
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'employee' AND employee_id = auth.uid());

DROP POLICY IF EXISTS "wh_update_own_employee" ON public.work_hours;
CREATE POLICY "wh_update_own_employee" ON public.work_hours
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'employee' AND employee_id = auth.uid() AND status = 'pending')
  WITH CHECK (public.get_user_role() = 'employee' AND employee_id = auth.uid());

-- عامل: فقط رکوردهای خودش
DROP POLICY IF EXISTS "wh_own_agent" ON public.work_hours;
CREATE POLICY "wh_own_agent" ON public.work_hours
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'agent' AND employee_id = auth.uid());

DROP POLICY IF EXISTS "wh_insert_agent" ON public.work_hours;
CREATE POLICY "wh_insert_agent" ON public.work_hours
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'agent' AND employee_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 7.3 employee_hourly_rates — نرخ ساعتی هر کارمند
-- ----------------------------------------------------------------------------
-- در localStorage با کلید 'employee_hourly_rates' به شکل { empId: rate } ذخیره می‌شود.
-- Stored in localStorage as { empId: numericRate }.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_hourly_rates (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id  UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    hourly_rate  NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency     TEXT DEFAULT 'تومان',
    updated_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.employee_hourly_rates IS 'نرخ ساعتی کارمندان برای محاسبه حقوق / Per-employee hourly rate for payroll';

ALTER TABLE public.employee_hourly_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ehr_all_manager" ON public.employee_hourly_rates;
CREATE POLICY "ehr_all_manager" ON public.employee_hourly_rates
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

-- کارمند فقط نرخ خودش را می‌بیند
DROP POLICY IF EXISTS "ehr_select_own" ON public.employee_hourly_rates;
CREATE POLICY "ehr_select_own" ON public.employee_hourly_rates
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 7.4 employee_reports — گزارش‌های روزانه کارمندان
-- ----------------------------------------------------------------------------
-- در localStorage با کلید 'employee_reports' به شکل { empId: [...reports] } ذخیره می‌شود.
-- Stored as { empId: [...reports] } in localStorage.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_reports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title        TEXT,
    content      TEXT NOT NULL,
    report_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.employee_reports IS 'گزارش‌های روزانه کارمندان / Daily employee reports';

DROP TRIGGER IF EXISTS trg_employee_reports_updated_at ON public.employee_reports;
CREATE TRIGGER trg_employee_reports_updated_at
  BEFORE UPDATE ON public.employee_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_employee_reports_employee_id ON public.employee_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_reports_date         ON public.employee_reports(report_date);

ALTER TABLE public.employee_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ereports_all_manager" ON public.employee_reports;
CREATE POLICY "ereports_all_manager" ON public.employee_reports
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "ereports_select_employee" ON public.employee_reports;
CREATE POLICY "ereports_select_employee" ON public.employee_reports
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "ereports_write_own_employee" ON public.employee_reports;
CREATE POLICY "ereports_write_own_employee" ON public.employee_reports
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'employee' AND employee_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 7.5 company_accounting — حسابداری شخصی شرکت
-- ----------------------------------------------------------------------------
-- جدا از accounting_transactions (که مربوط به سفارشات است).
-- این جدول درآمد/هزینه/بدهی/طلب کلی شرکت را نگه می‌دارد.
-- In localStorage as 'personal_accounting_data': { transactions, persons, ... }
-- This is SEPARATE from accounting_transactions (which is per-order).
-- This table tracks company-level income / expense / debt / credit.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_accounting (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    type         TEXT NOT NULL CHECK (type IN ('income','expense','debt','credit')),
    amount       NUMERIC(14,2) NOT NULL,
    currency     TEXT DEFAULT 'تومان',

    -- دسته‌بندی (مثل 'درآمد شرکت', 'حقوق و دستمزد', ...)
    category     TEXT,

    description  TEXT,

    -- شخص مرتبط (برای بدهی/طلب)
    person_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    person_name  TEXT,  -- نام ذخیره‌شده برای افراد خارج از سیستم

    -- تراکنش مرتبط در سیستم سفارشات (اختیاری)
    order_tx_id  UUID REFERENCES public.accounting_transactions(id) ON DELETE SET NULL,

    created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.company_accounting IS 'حسابداری کلی شرکت (درآمد/هزینه/بدهی/طلب) — جدا از تراکنش‌های سفارشات / Company-level accounting separate from per-order transactions';

DROP TRIGGER IF EXISTS trg_company_accounting_updated_at ON public.company_accounting;
CREATE TRIGGER trg_company_accounting_updated_at
  BEFORE UPDATE ON public.company_accounting
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_company_accounting_type       ON public.company_accounting(type);
CREATE INDEX IF NOT EXISTS idx_company_accounting_created_at ON public.company_accounting(created_at);
CREATE INDEX IF NOT EXISTS idx_company_accounting_created_by ON public.company_accounting(created_by);

ALTER TABLE public.company_accounting ENABLE ROW LEVEL SECURITY;

-- فقط مدیر و کارمند دسترسی دارند — agent و student دسترسی ندارند
DROP POLICY IF EXISTS "ca_all_manager" ON public.company_accounting;
CREATE POLICY "ca_all_manager" ON public.company_accounting
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "ca_select_employee" ON public.company_accounting;
CREATE POLICY "ca_select_employee" ON public.company_accounting
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'employee');

DROP POLICY IF EXISTS "ca_insert_employee" ON public.company_accounting;
CREATE POLICY "ca_insert_employee" ON public.company_accounting
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'employee');


-- ----------------------------------------------------------------------------
-- 7.6 notifications — اعلان‌های سیستمی (in-app notifications)
-- ----------------------------------------------------------------------------
-- در کد فعلی notifications به شکل آرایه در حافظه Alpine.js نگه‌داری می‌شود
-- و پس از reload از دست می‌رود. این جدول آن‌ها را پایدار می‌کند.
-- Currently stored only in Alpine.js memory (lost on reload).
-- This table makes them persistent.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title        TEXT,
    message      TEXT NOT NULL,
    type         TEXT DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
    read         BOOLEAN DEFAULT false,
    -- لینک اختیاری به سفارش/وظیفه مرتبط
    order_id     UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    task_id      UUID REFERENCES public.employee_tasks(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.notifications IS 'اعلان‌های درون‌برنامه‌ای / In-app notifications (persistent)';

CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read       ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- هر کاربر فقط اعلان‌های خودش را می‌بیند
DROP POLICY IF EXISTS "notif_own_user" ON public.notifications;
CREATE POLICY "notif_own_user" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- مدیر و کارمند می‌توانند اعلان ایجاد کنند (برای دیگران)
DROP POLICY IF EXISTS "notif_insert_staff" ON public.notifications;
CREATE POLICY "notif_insert_staff" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('manager','employee'));

-- مدیر: مشاهده همه اعلان‌ها
DROP POLICY IF EXISTS "notif_select_manager" ON public.notifications;
CREATE POLICY "notif_select_manager" ON public.notifications
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager')
  WITH CHECK (public.get_user_role() = 'manager');


-- ============================================================================
-- خلاصه جداول کامل اسکریپت — COMPLETE TABLE SUMMARY
-- ============================================================================
--
--  جدول                      | کلید localStorage معادل        | نقش
--  ─────────────────────────────────────────────────────────────────────────
--  profiles                  | edu_system_users               | کاربران سیستم
--  orders                    | edu_system_orders              | سفارشات دانشجویان
--  order_types               | (CONFIG.ORDER_TYPES)           | کاتالوگ 37 نوع سفارش
--  student_progress          | prog_{id}_{type}               | پیشرفت مراحل دانشجو
--  step_assignments          | step_assignments               | تخصیص مراحل به کارمند
--  employee_tasks            | employee_tasks                 | وظایف کارمند/عامل
--  work_hours                | work_hours_data                | ساعات کاری + هزینه
--  employee_hourly_rates     | employee_hourly_rates          | نرخ ساعتی کارمندان
--  employee_reports          | employee_reports               | گزارش‌های روزانه
--  company_accounting        | personal_accounting_data       | حسابداری کلی شرکت
--  accounting_transactions   | (embedded in orders)          | تراکنش‌های مالی سفارش
--  messages                  | messages / *Chat_messages      | پیام‌های داخلی
--  notifications             | (Alpine.js memory only)        | اعلان‌های پایدار
--  archived_files            | archive_files                  | آرشیو فایل دانشجویان
--
-- ============================================================================
-- پایان اسکریپت — END OF SCRIPT (v2 complete)
-- ============================================================================
