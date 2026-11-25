-- PHONE HUB SINGLE-SHOP DATABASE
-- Run in Supabase SQL Editor. No shop/tenant table: this schema is for one business.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 role text not null default 'technician' check(role in ('owner_admin','workshop_manager','technician','inventory','qc_inspector','procurement','sales')),
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists public.shipments (
 id uuid primary key default gen_random_uuid(),
 shipment_code text unique not null,
 supplier_name text,
 received_date date not null default current_date,
 notes text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);

create table if not exists public.devices (
 id uuid primary key default gen_random_uuid(),
 shipment_id uuid references public.shipments(id) on delete set null,
 imei1 text unique,
 imei2 text,
 serial_number text,
 brand text not null,
 model text not null,
 color text,
 condition text not null default 'Good',
 status text not null default 'Received',
 purchase_cost numeric(12,2) not null default 0 check(purchase_cost>=0),
 accessories text,
 notes text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.job_cards (
 id uuid primary key default gen_random_uuid(),
 job_number bigint generated always as identity unique,
 device_id uuid not null references public.devices(id),
 title text not null,
 description text,
 priority text not null default 'Normal',
 status text not null default 'open',
 estimated_cost numeric(12,2) not null default 0,
 actual_labor_cost numeric(12,2) not null default 0,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 completed_at timestamptz
);

create table if not exists public.job_assignments (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.job_cards(id) on delete cascade,
 technician_id uuid not null references public.profiles(id),
 task_name text not null,
 status text not null default 'assigned',
 started_at timestamptz,
 completed_at timestamptz,
 labor_cost numeric(12,2) not null default 0,
 created_at timestamptz not null default now()
);

create table if not exists public.inspections (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references public.devices(id) on delete cascade,
 inspector_id uuid references public.profiles(id),
 checklist jsonb not null default '{}'::jsonb,
 defects text[],
 grade text,
 notes text,
 created_at timestamptz not null default now()
);

create table if not exists public.spare_parts (
 id uuid primary key default gen_random_uuid(),
 sku text unique not null,
 name text not null,
 category text,
 quantity integer not null default 0 check(quantity>=0),
 reorder_level integer not null default 0 check(reorder_level>=0),
 unit_cost numeric(12,2) not null default 0,
 created_at timestamptz not null default now()
);

create table if not exists public.stock_ledger (
 id uuid primary key default gen_random_uuid(),
 part_id uuid not null references public.spare_parts(id),
 movement_type text not null check(movement_type in ('opening','purchase','issue','return','adjustment')),
 quantity_delta integer not null,
 unit_cost numeric(12,2) not null default 0,
 reference_type text,
 reference_id uuid,
 idempotency_key text unique,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);

create table if not exists public.qc_checks (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references public.devices(id),
 job_id uuid references public.job_cards(id),
 inspector_id uuid references public.profiles(id),
 result text not null check(result in ('passed','rejected','rework')),
 checklist jsonb not null default '{}'::jsonb,
 notes text,
 created_at timestamptz not null default now()
);

create table if not exists public.customers (
 id uuid primary key default gen_random_uuid(),
 full_name text not null,
 phone text,
 email text,
 address text,
 created_at timestamptz not null default now()
);

create table if not exists public.sales (
 id uuid primary key default gen_random_uuid(),
 invoice_number bigint generated always as identity unique,
 device_id uuid not null references public.devices(id),
 customer_id uuid references public.customers(id),
 customer_name text not null,
 customer_phone text,
 total_amount numeric(12,2) not null check(total_amount>=0),
 payment_method text not null default 'Cash',
 sold_at timestamptz not null default now(),
 created_by uuid references auth.users(id)
);

create table if not exists public.audit_logs (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references auth.users(id),
 action text not null,
 entity_type text not null,
 entity_id uuid,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create index if not exists idx_devices_status on public.devices(status);
create index if not exists idx_devices_imei2 on public.devices(imei2);
create index if not exists idx_jobs_device on public.job_cards(device_id);
create index if not exists idx_jobs_status on public.job_cards(status);
create index if not exists idx_stock_part on public.stock_ledger(part_id,created_at desc);
create index if not exists idx_sales_date on public.sales(sold_at desc);

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() and is_active=true $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and is_active=true) $$;

alter table public.profiles enable row level security;
alter table public.shipments enable row level security;
alter table public.devices enable row level security;
alter table public.job_cards enable row level security;
alter table public.job_assignments enable row level security;
alter table public.inspections enable row level security;
alter table public.spare_parts enable row level security;
alter table public.stock_ledger enable row level security;
alter table public.qc_checks enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.audit_logs enable row level security;

-- Authenticated staff can read operational data. Writes are scoped to authenticated staff;
-- role-specific production policies should be tightened after the shop's staff matrix is confirmed.
do $$ declare t text; begin
 foreach t in array array['shipments','devices','job_cards','job_assignments','inspections','spare_parts','stock_ledger','qc_checks','customers','sales','audit_logs'] loop
  execute format('drop policy if exists staff_read on public.%I',t);
  execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())',t);
  execute format('drop policy if exists staff_write on public.%I',t);
  execute format('create policy staff_write on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',t);
 end loop;
end $$;
drop policy if exists profile_self_read on public.profiles;
create policy profile_self_read on public.profiles for select to authenticated using (id=auth.uid() or public.current_user_role()='owner_admin');
drop policy if exists profile_owner_manage on public.profiles;
create policy profile_owner_manage on public.profiles for all to authenticated using (public.current_user_role()='owner_admin') with check (public.current_user_role()='owner_admin');

-- Create a profile row for new signups. New users default to technician; owner role must be assigned securely by an existing owner.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$ begin insert into public.profiles(id,full_name,role) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''), 'technician') on conflict(id) do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Initial owner setup:
-- 1) Sign up through Supabase Auth.
-- 2) In SQL Editor, run:
-- update public.profiles set role='owner_admin' where id='YOUR_AUTH_USER_UUID';
