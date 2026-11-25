-- ==============================================================================
-- PHONE HUB — MIGRATION 003: ACCESSORIES INVENTORY SCHEMA
-- ==============================================================================
-- Creates dedicated accessories table for mobile workshop inventory:
-- Chargers, USB cables, Mobile covers, Tempered glass, Earphones, Power banks, etc.
-- Includes barcode tracking, minimum stock thresholds, and secure role-based RLS.
-- ==============================================================================

create table if not exists public.accessories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  sku text not null unique,
  barcode text unique,
  purchase_price numeric(12,2) not null default 0 check(purchase_price >= 0),
  selling_price numeric(12,2) not null default 0 check(selling_price >= 0),
  current_stock integer not null default 0 check(current_stock >= 0),
  minimum_stock integer not null default 5 check(minimum_stock >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indices for rapid barcode and SKU scanning
create index if not exists idx_accessories_barcode on public.accessories(barcode);
create index if not exists idx_accessories_sku on public.accessories(sku);
create index if not exists idx_accessories_category on public.accessories(category);

-- Enable RLS
alter table public.accessories enable row level security;

-- Read policy: active authenticated staff can read accessories
drop policy if exists "accessories_read_active_staff" on public.accessories;
create policy "accessories_read_active_staff"
  on public.accessories
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_active = true
    )
  );

-- Management policy: owner, workshop_manager, inventory, procurement can insert/update/delete
drop policy if exists "accessories_manage_staff" on public.accessories;
create policy "accessories_manage_staff"
  on public.accessories
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and is_active = true
        and role in ('owner', 'workshop_manager', 'inventory', 'procurement')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and is_active = true
        and role in ('owner', 'workshop_manager', 'inventory', 'procurement')
    )
  );
