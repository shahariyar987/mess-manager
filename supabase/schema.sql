create extension if not exists "uuid-ossp";
create table if not exists public.messes (id uuid primary key default uuid_generate_v4(), name text not null, currency text default 'BDT', created_at timestamptz default now());
create table if not exists public.mess_members (id uuid primary key default uuid_generate_v4(), mess_id uuid references public.messes(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, member_code text not null, display_name text not null, room_rent numeric(12,2) not null default 0 check(room_rent >= 0), default_daily_meals numeric(4,2) not null default 2.5 check(default_daily_meals >= 0), role text not null default 'member' check (role in ('admin','member')), joined_at timestamptz default now(), unique(mess_id,user_id), unique(mess_id,member_code));
create table if not exists public.meals (id uuid primary key default uuid_generate_v4(), mess_id uuid references public.messes(id) on delete cascade, member_id uuid references public.mess_members(id) on delete cascade, meal_date date not null, breakfast boolean default false, lunch boolean default false, dinner boolean default false, created_at timestamptz default now(), unique(member_id, meal_date));
create table if not exists public.expenses (id uuid primary key default uuid_generate_v4(), mess_id uuid references public.messes(id) on delete cascade, added_by uuid references public.mess_members(id), title text not null, category text default 'groceries', amount numeric(12,2) not null check(amount >= 0), expense_date date default current_date, notes text, created_at timestamptz default now());
create table if not exists public.meal_adjustment_requests (id uuid primary key default uuid_generate_v4(), mess_id uuid references public.messes(id) on delete cascade, member_id uuid references public.mess_members(id) on delete cascade, meal_date date not null, requested_meals numeric(4,2) not null check(requested_meals >= 0), reason text not null, status text not null default 'pending' check(status in ('pending','approved','rejected')), reviewed_by uuid references public.mess_members(id), reviewed_at timestamptz, created_at timestamptz default now());
create table if not exists public.shared_bills (id uuid primary key default uuid_generate_v4(), mess_id uuid references public.messes(id) on delete cascade, month date not null, maid numeric(12,2) not null default 0, electricity numeric(12,2) not null default 0, wifi numeric(12,2) not null default 0, gas numeric(12,2) not null default 0, unique(mess_id, month));
create table if not exists public.monthly_snapshots (id uuid primary key default uuid_generate_v4(), mess_id uuid references public.messes(id) on delete cascade, month date not null, due_date date not null, total_people integer default 0, total_meals numeric(12,2) default 0, total_commodity_cost numeric(12,2) default 0, meal_rate numeric(12,2) default 0, shared_bills numeric(12,2) default 0, member_balances jsonb default '{}'::jsonb, closed_at timestamptz, unique(mess_id, month));
create table if not exists public.mess_app_state (mess_id uuid primary key references public.messes(id) on delete cascade, state jsonb not null default '{}'::jsonb, updated_by uuid references auth.users(id), updated_at timestamptz not null default now());
alter table public.meals add column if not exists meal_count numeric(4,2) not null default 0 check (meal_count >= 0);
create table if not exists public.community_messages (id uuid primary key default uuid_generate_v4(), mess_id uuid not null references public.messes(id) on delete cascade, author_id uuid not null references auth.users(id) on delete cascade, body text not null check (length(trim(body)) > 0), created_at timestamptz not null default now());
create table if not exists public.community_rules (id uuid primary key default uuid_generate_v4(), mess_id uuid not null references public.messes(id) on delete cascade, body text not null check (length(trim(body)) > 0), created_by uuid not null references auth.users(id), created_at timestamptz not null default now());
create table if not exists public.community_settings (mess_id uuid primary key references public.messes(id) on delete cascade, pinned_message_id uuid references public.community_messages(id) on delete set null, updated_by uuid references auth.users(id), updated_at timestamptz not null default now());
alter table public.messes enable row level security;
alter table public.mess_members enable row level security;
alter table public.meals enable row level security;
alter table public.expenses enable row level security;
alter table public.monthly_snapshots enable row level security;
alter table public.meal_adjustment_requests enable row level security;
alter table public.shared_bills enable row level security;
alter table public.mess_app_state enable row level security;
alter table public.community_messages enable row level security;
alter table public.community_rules enable row level security;
alter table public.community_settings enable row level security;

drop policy if exists "members can read their mess" on public.mess_members;
drop policy if exists "admins manage members" on public.mess_members;
drop policy if exists "members read meals" on public.meals;
drop policy if exists "members write own meals" on public.meals;
drop policy if exists "admins update meals" on public.meals;
drop policy if exists "members read expenses" on public.expenses;
drop policy if exists "members add expenses" on public.expenses;
drop policy if exists "members read requests" on public.meal_adjustment_requests;
drop policy if exists "members create requests" on public.meal_adjustment_requests;
drop policy if exists "admins review requests" on public.meal_adjustment_requests;
drop policy if exists "members read shared bills" on public.shared_bills;
drop policy if exists "admins manage shared bills" on public.shared_bills;
drop policy if exists "members read snapshots" on public.monthly_snapshots;
drop policy if exists "admins close snapshots" on public.monthly_snapshots;
drop policy if exists "members read app state" on public.mess_app_state;
drop policy if exists "members insert app state" on public.mess_app_state;
drop policy if exists "members update app state" on public.mess_app_state;
drop policy if exists "members read community messages" on public.community_messages;
drop policy if exists "members create community messages" on public.community_messages;
drop policy if exists "members read community rules" on public.community_rules;
drop policy if exists "admins manage community rules" on public.community_rules;
drop policy if exists "members read community settings" on public.community_settings;
drop policy if exists "admins manage community settings" on public.community_settings;

-- Membership helper keeps all policies scoped to the current user's mess.
create or replace function public.is_mess_member(target_mess uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.mess_members where mess_id = target_mess and user_id = auth.uid()); $$;
create or replace function public.is_mess_admin(target_mess uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.mess_members where mess_id = target_mess and user_id = auth.uid() and role = 'admin'); $$;

create policy "members can read their mess" on public.mess_members for select using (public.is_mess_member(mess_id));
create policy "admins manage members" on public.mess_members for all using (public.is_mess_admin(mess_id)) with check (public.is_mess_admin(mess_id));
create policy "members read meals" on public.meals for select using (public.is_mess_member(mess_id));
create policy "members write own meals" on public.meals for insert with check (public.is_mess_member(mess_id) and member_id in (select id from public.mess_members where user_id = auth.uid()));
create policy "admins update meals" on public.meals for update using (public.is_mess_admin(mess_id)) with check (public.is_mess_admin(mess_id));
create policy "members read expenses" on public.expenses for select using (public.is_mess_member(mess_id));
create policy "members add expenses" on public.expenses for insert with check (public.is_mess_member(mess_id));
create policy "members read requests" on public.meal_adjustment_requests for select using (public.is_mess_member(mess_id));
create policy "members create requests" on public.meal_adjustment_requests for insert with check (public.is_mess_member(mess_id) and member_id in (select id from public.mess_members where user_id = auth.uid()));
create policy "admins review requests" on public.meal_adjustment_requests for update using (public.is_mess_admin(mess_id)) with check (public.is_mess_admin(mess_id));
create policy "members read shared bills" on public.shared_bills for select using (public.is_mess_member(mess_id));
create policy "admins manage shared bills" on public.shared_bills for all using (public.is_mess_admin(mess_id)) with check (public.is_mess_admin(mess_id));
create policy "members read snapshots" on public.monthly_snapshots for select using (public.is_mess_member(mess_id));
create policy "admins close snapshots" on public.monthly_snapshots for all using (public.is_mess_admin(mess_id)) with check (public.is_mess_admin(mess_id));
create policy "members read app state" on public.mess_app_state for select using (public.is_mess_member(mess_id));
create policy "members insert app state" on public.mess_app_state for insert with check (public.is_mess_member(mess_id));
create policy "members update app state" on public.mess_app_state for update using (public.is_mess_member(mess_id)) with check (public.is_mess_member(mess_id));
create policy "members read community messages" on public.community_messages for select using (public.is_mess_member(mess_id));
create policy "members create community messages" on public.community_messages for insert with check (public.is_mess_member(mess_id) and author_id = auth.uid());
create policy "members read community rules" on public.community_rules for select using (public.is_mess_member(mess_id));
create policy "admins manage community rules" on public.community_rules for all using (public.is_mess_admin(mess_id)) with check (public.is_mess_admin(mess_id));
create policy "members read community settings" on public.community_settings for select using (public.is_mess_member(mess_id));
create policy "admins manage community settings" on public.community_settings for all using (public.is_mess_admin(mess_id)) with check (public.is_mess_admin(mess_id));
