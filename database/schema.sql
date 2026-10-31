-- مطعم الغنّام: قاعدة بيانات المنيو ولوحة الإدارة
-- شغّل الملف كله مرة واحدة في Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.branches (
  id text primary key,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'staff' check (role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  branch_id text not null references public.branches(id) on delete cascade,
  name text not null,
  slug text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, slug),
  unique (id, branch_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  branch_id text not null references public.branches(id) on delete cascade,
  category_id uuid not null,
  name text not null,
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  image_url text not null default '',
  image_path text not null default '',
  is_available boolean not null default true,
  sort_order integer not null default 0,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_category_same_branch_fk
    foreign key (category_id, branch_id)
    references public.categories(id, branch_id)
    on delete restrict
);

-- Offers can target one branch or all branches (branch_id IS NULL).
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

create index if not exists categories_branch_order_idx
  on public.categories(branch_id, sort_order);
create index if not exists products_branch_category_order_idx
  on public.products(branch_id, category_id, sort_order);
create index if not exists products_available_idx
  on public.products(branch_id, is_available);
create index if not exists offers_active_dates_idx
  on public.offers(is_active, starts_at, ends_at);
create index if not exists offers_branch_order_idx
  on public.offers(branch_id, sort_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists branches_set_updated_at on public.branches;
create trigger branches_set_updated_at before update on public.branches
for each row execute function public.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at before update on public.offers
for each row execute function public.set_updated_at();

-- Create a profile automatically for every new Auth user; it is NOT an administrator by default.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'staff')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Security-definer helper avoids recursive RLS checks against profiles.
create or replace function public.is_menu_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('owner', 'manager')
  );
$$;
revoke all on function public.is_menu_admin() from public;
grant execute on function public.is_menu_admin() to authenticated;

-- Enable row-level security everywhere exposed to the browser.
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.offers enable row level security;

-- Minimize browser privileges, then grant only the required operations.
revoke all on public.branches, public.profiles, public.categories, public.products, public.offers from anon, authenticated;
grant select on public.branches, public.categories, public.products, public.offers to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert, update, delete on public.branches, public.categories, public.products, public.offers to authenticated;

-- Public visitors can view active branches and categories and available menu items only.
drop policy if exists branches_public_read on public.branches;
create policy branches_public_read on public.branches
for select to anon, authenticated using (is_active = true or (select public.is_menu_admin()));
drop policy if exists branches_admin_write on public.branches;
create policy branches_admin_write on public.branches
for all to authenticated using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
for select to authenticated using (id = (select auth.uid()) or (select public.is_menu_admin()));
-- Profiles cannot change their own role through the browser.
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
for update to authenticated using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
for select to anon, authenticated using (is_active = true or (select public.is_menu_admin()));
drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories
for all to authenticated using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
for select to anon, authenticated using (is_available = true or (select public.is_menu_admin()));
drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products
for all to authenticated using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));

drop policy if exists offers_public_read on public.offers;
create policy offers_public_read on public.offers
for select to anon, authenticated using (
  (is_active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()))
  or (select public.is_menu_admin())
);
drop policy if exists offers_admin_write on public.offers;
create policy offers_admin_write on public.offers
for all to authenticated using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));

-- Public bucket for product photos; only authorized managers can upload/change/delete.
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists menu_images_public_read on storage.objects;
create policy menu_images_public_read on storage.objects
for select to anon, authenticated using (bucket_id = 'menu-images');
drop policy if exists menu_images_admin_insert on storage.objects;
create policy menu_images_admin_insert on storage.objects
for insert to authenticated with check (bucket_id = 'menu-images' and (select public.is_menu_admin()));
drop policy if exists menu_images_admin_update on storage.objects;
create policy menu_images_admin_update on storage.objects
for update to authenticated using (bucket_id = 'menu-images' and (select public.is_menu_admin()))
with check (bucket_id = 'menu-images' and (select public.is_menu_admin()));
drop policy if exists menu_images_admin_delete on storage.objects;
create policy menu_images_admin_delete on storage.objects
for delete to authenticated using (bucket_id = 'menu-images' and (select public.is_menu_admin()));

-- Seed existing branches (safe to rerun).
insert into public.branches (id, name, description, sort_order) values
  ('grill', 'فرع المشاوي', 'الدورة، شارع المصافي، مجاور مصرف الرشيد', 1),
  ('fastfood', 'فرع الوجبات السريعة', 'الدورة، شارع المصافي', 2),
  ('falafel', 'فرع الفلافل', 'الإعلام، سوق أميمة، مقابل جامع المصطفى', 3)
on conflict (id) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

-- Seed category lists per branch. Product records are migrated/added separately in the dashboard.
insert into public.categories (branch_id, name, slug, sort_order) values
  ('fastfood','الشاورما','shawarma',1),
  ('fastfood','الكنتاكي والستربس','kentucky-strips',2),
  ('fastfood','السندويشات','sandwiches',3),
  ('fastfood','الريزو','rizo',4),
  ('fastfood','الفنكر','fries',5),
  ('fastfood','البيتزا','pizza',6),
  ('fastfood','البركر','burger',7),
  ('fastfood','الصاج','saj',8),
  ('fastfood','الفلافل','falafel',9),
  ('fastfood','المقبلات','appetizers',10),
  ('fastfood','الإضافات','extras',11),
  ('fastfood','الصوص','sauces',12),
  ('fastfood','المشروبات','drinks',13),
  ('falafel','الفلافل','falafel',1),
  ('falafel','البركر','burger',2),
  ('falafel','الإضافات','extras',3),
  ('falafel','المشروبات','drinks',4),
  ('grill','المشويات بالكيلو','grilled-by-weight',1),
  ('grill','المقبلات','appetizers',2),
  ('grill','المشوي نفرات','skewers',3),
  ('grill','الفطور الصباحي','breakfast',4),
  ('grill','الدجاج','chicken',5),
  ('grill','القوزي','quzi',6),
  ('grill','الشاورما','shawarma',7),
  ('grill','الإضافات','extras',8),
  ('grill','المشروبات','drinks',9)
on conflict (branch_id, slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- IMPORTANT: After creating your login user in Authentication, promote ONLY that email using:
-- update public.profiles set role = 'owner' where email = 'YOUR_OWNER_EMAIL';
