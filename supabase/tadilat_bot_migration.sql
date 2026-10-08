-- ============================================================
-- tadilat_bot_migration.sql
--
-- وضعیت گفتگوی ربات چتی را در Supabase نگه می‌دارد تا روی
-- Edge Function (که حافظهٔ دائمی ندارد) کار کند.
--
-- اجرا:  Supabase Dashboard → SQL Editor → این متن را بچسبانید → Run
-- ============================================================

-- ── ۱) جدول وضعیت (کلید/مقدار JSON) ────────────────────────
create table if not exists public.bot_state (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists bot_state_updated_idx
  on public.bot_state (updated_at desc);

comment on table public.bot_state is
  'وضعیت گفتگوی ربات تلگرام تعدیلات — offset و مرحلهٔ هر کاربر';

-- ── ۲) دسترسی (مثل بقیهٔ جداول پروژه: anon همه‌کاره) ───────
alter table public.bot_state enable row level security;

drop policy if exists "anon all bot_state" on public.bot_state;
create policy "anon all bot_state" on public.bot_state
  for all using (true) with check (true);

-- ── ۳) ستون‌های کمکی درخواست‌ها (اگر نبودند) ───────────────
alter table public.tadilat_requests
  add column if not exists due_at timestamptz;

alter table public.tadilat_requests
  add column if not exists telegram_user_id bigint;

alter table public.tadilat_requests
  add column if not exists telegram_username text;

alter table public.tadilat_requests
  add column if not exists telegram_name text;

create index if not exists tadilat_requests_tg_idx
  on public.tadilat_requests (telegram_user_id);

create index if not exists tadilat_requests_student_idx
  on public.tadilat_requests (student_id);

-- ── ۴) پاک‌سازی خودکار وضعیت‌های قدیمی ─────────────────────
-- (وضعیت گفتگوی رها‌شده بعد از ۳۰ روز حذف می‌شود)
create or replace function public.bot_state_cleanup()
returns void
language sql
security definer
as $$
  delete from public.bot_state
   where key like 'chat:%'
     and updated_at < now() - interval '30 days';
$$;

-- ── بررسی ───────────────────────────────────────────────────
select 'bot_state' as جدول, count(*) as ردیف from public.bot_state;
