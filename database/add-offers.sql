-- إضافة قسم العروض إلى مشروع Supabase موجود مسبقًا
-- شغّل هذا الملف في Supabase > SQL Editor بعد تشغيل schema.sql القديم.

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  branch_id text references public.branches(id) on delete cascade,
  name text not null,
  description text not null default '',
  original_price numeric(12,2) not null default 0 check (original_price >= 0),
  offer_price numeric(12,2) not null default 0 check (offer_price >= 0),
  image_url text not null default '',
  image_path text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_dates_order_check check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index if not exists offers_active_dates_idx on public.offers(is_active, starts_at, ends_at);
create index if not exists offers_branch_order_idx on public.offers(branch_id, sort_order);

drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at before update on public.offers
for each row execute function public.set_updated_at();

alter table public.offers enable row level security;
revoke all on public.offers from anon, authenticated;
grant select on public.offers to anon, authenticated;
grant insert, update, delete on public.offers to authenticated;

drop policy if exists offers_public_read on public.offers;
create policy offers_public_read on public.offers
for select to anon, authenticated using (
  (is_active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()))
  or (select public.is_menu_admin())
);
drop policy if exists offers_admin_write on public.offers;
create policy offers_admin_write on public.offers
for all to authenticated using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));
