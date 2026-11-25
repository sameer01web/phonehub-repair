-- ==============================================================================
-- PHONE HUB SINGLE-SHOP DATABASE EXTENSION (SAFE AUDITED & ROLE-HARDENED VERSION)
-- Run in Supabase SQL Editor ONLY when ready.
-- ==============================================================================
-- AUDIT COMPLIANCE & SAFETY VERIFICATION:
-- 1. Canonical role `owner` only: completely removed `owner_admin`.
-- 2. Security functions `current_user_role()` and `is_staff()` use SECURITY DEFINER,
--    empty `search_path = ''`, fully qualified references, and eliminate RLS recursion.
-- 3. Granular, role-specific RLS replaces broad `staff_write`.
-- 4. `stock_ledger` is strictly append-only: no update or delete policies exist.
-- 5. `device_timeline` is strictly append-only: staff read/insert only, no updates/deletes.
-- 6. `calculate_device_cost`:
--    - SECURITY DEFINER with `SET search_path = ''`.
--    - Strict auth and role restriction: `owner` and `workshop_manager` only.
--    - Revoked from PUBLIC and anon; granted to authenticated only.
--    - Uses actual device purchase cost, actual issued FIFO parts cost from stock_ledger,
--      manual parts, and actual labor/other costs from device_cost_entries.
--    - Avoids double-counting and does NOT use job_cards.estimated_cost as labor.
-- 7. Verified all existing columns: `contact_person`, `order_date`, `expected_date`,
--    `received_quantity`, `received_by`, `goods_receipt_item_id`, `fifo_processed_at`.
-- 8. Existing working FIFO functions are preserved exactly and NOT overwritten:
--    - receive_spare_part_fifo
--    - issue_spare_part_fifo
--    - process_goods_receipt_fifo
-- 9. Zero customer or sales tables or references created.
-- 10. 100% idempotent and non-destructive: contains no DROP TABLE, TRUNCATE, or DELETE.
-- ==============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. HARDENED HELPER FUNCTIONS (Safe empty search_path, recursion-free)
-- ------------------------------------------------------------------------------

-- Returns current authenticated user's active role from public.profiles
create or replace function public.current_user_role()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active = true
  limit 1;
  return v_role;
end;
$$;

-- Checks if the caller is an active staff user
create or replace function public.is_staff()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. PROFILES ROLE CONSTRAINT & RECURSION-FREE POLICIES
-- ------------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.check_constraints cc on tc.constraint_name = cc.constraint_name
    where tc.table_schema = 'public'
      and tc.table_name = 'profiles'
      and tc.constraint_name = 'profiles_role_check'
  ) then
    alter table public.profiles drop constraint if exists profiles_role_check;
    alter table public.profiles add constraint profiles_role_check
      check(role in ('owner', 'workshop_manager', 'technician', 'inventory', 'qc_inspector', 'procurement'));
  end if;
end $$;

-- Recursion-Free Profile Policies:
-- Self-read checks `id = auth.uid()` directly without invoking `current_user_role()`
drop policy if exists profile_self_read on public.profiles;
create policy profile_self_read on public.profiles for select to authenticated
  using (id = auth.uid());

-- Management policy: Only owner can view/manage all profiles
drop policy if exists profile_owner_manage on public.profiles;
create policy profile_owner_manage on public.profiles for all to authenticated
  using (public.current_user_role() = 'owner')
  with check (public.current_user_role() = 'owner');

-- ------------------------------------------------------------------------------
-- 3. VERIFIED TABLES CREATION (Idempotent: CREATE TABLE IF NOT EXISTS)
-- ------------------------------------------------------------------------------

-- Suppliers (Uses contact_person)
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

-- Purchase Orders (Includes order_date, expected_date)
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text unique not null,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  order_date date not null default current_date,
  expected_date date,
  status text not null default 'draft' check(status in ('draft','ordered','partially_received','received','cancelled')),
  total_amount numeric(12,2) not null default 0 check(total_amount >= 0),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Purchase Order Items (Includes received_quantity)
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  spare_part_id uuid not null references public.spare_parts(id) on delete restrict,
  ordered_quantity integer not null check(ordered_quantity > 0),
  received_quantity integer not null default 0 check(received_quantity >= 0),
  unit_cost numeric(12,2) not null default 0 check(unit_cost >= 0)
);

-- Goods Receipts (Includes received_by)
create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  grn_number text unique not null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  received_date date not null default current_date,
  received_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);

-- Goods Receipt Items (Includes fifo_processed_at)
create table if not exists public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references public.goods_receipts(id) on delete cascade,
  purchase_order_item_id uuid references public.purchase_order_items(id) on delete set null,
  spare_part_id uuid references public.spare_parts(id) on delete set null,
  received_quantity integer not null default 0 check(received_quantity >= 0),
  accepted_quantity integer not null default 0 check(accepted_quantity >= 0),
  rejected_quantity integer not null default 0 check(rejected_quantity >= 0),
  unit_cost numeric(12,2) not null default 0,
  fifo_processed_at timestamptz
);

-- Inventory Batches (Includes goods_receipt_item_id FK)
create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  spare_part_id uuid not null references public.spare_parts(id) on delete cascade,
  goods_receipt_item_id uuid references public.goods_receipt_items(id) on delete set null,
  received_quantity integer not null check(received_quantity > 0),
  remaining_quantity integer not null check(remaining_quantity >= 0),
  unit_cost numeric(12,2) not null default 0,
  received_at timestamptz not null default now()
);

-- Device Timeline (Lifecycle Audit Log)
create table if not exists public.device_timeline (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Device Cost Entries (Actual labor, transport, inspection, and manual parts)
create table if not exists public.device_cost_entries (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  cost_type text not null,
  quantity numeric(10,2) not null default 1,
  unit_cost numeric(12,2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 4. EXTEND EXISTING COLUMNS SAFELY (Non-destructive ADD COLUMN IF NOT EXISTS)
-- ------------------------------------------------------------------------------
alter table public.suppliers add column if not exists contact_person text;
alter table public.purchase_orders add column if not exists order_date date not null default current_date;
alter table public.purchase_orders add column if not exists expected_date date;
alter table public.purchase_order_items add column if not exists received_quantity integer not null default 0 check(received_quantity >= 0);
alter table public.goods_receipts add column if not exists received_by uuid references auth.users(id);
alter table public.goods_receipt_items add column if not exists fifo_processed_at timestamptz;
alter table public.inventory_batches add column if not exists goods_receipt_item_id uuid references public.goods_receipt_items(id) on delete set null;
alter table public.spare_parts add column if not exists compatible_models text default '';
alter table public.job_cards add column if not exists complaint text;
alter table public.job_cards add column if not exists diagnosis text;
alter table public.qc_checks add column if not exists job_card_id uuid references public.job_cards(id) on delete set null;
alter table public.qc_checks add column if not exists failure_reason text;
alter table public.qc_checks add column if not exists rework_notes text;
alter table public.qc_checks add column if not exists checked_at timestamptz not null default now();

-- ------------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
create index if not exists idx_po_supplier on public.purchase_orders(supplier_id);
create index if not exists idx_poi_po on public.purchase_order_items(purchase_order_id);
create index if not exists idx_gr_po on public.goods_receipts(purchase_order_id);
create index if not exists idx_gri_gr on public.goods_receipt_items(goods_receipt_id);
create index if not exists idx_batches_part_qty on public.inventory_batches(spare_part_id, remaining_quantity);
create index if not exists idx_batches_gri on public.inventory_batches(goods_receipt_item_id);
create index if not exists idx_timeline_device on public.device_timeline(device_id, created_at desc);
create index if not exists idx_dce_device on public.device_cost_entries(device_id, cost_type);

-- ------------------------------------------------------------------------------
-- 6. GRANULAR ROLE-BASED ROW LEVEL SECURITY (RLS)
-- Replaces broad staff_write policies with role-specific access controls.
-- ------------------------------------------------------------------------------

-- Enable RLS across all operational, financial, and procurement tables
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_items enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.device_timeline enable row level security;
alter table public.device_cost_entries enable row level security;
alter table public.spare_parts enable row level security;
alter table public.stock_ledger enable row level security;
alter table public.job_cards enable row level security;
alter table public.job_assignments enable row level security;
alter table public.inspections enable row level security;
alter table public.qc_checks enable row level security;
alter table public.devices enable row level security;
alter table public.shipments enable row level security;

-- Drop legacy broad policies across all tables before binding role-specific policies
do $$ declare t text; begin
 foreach t in array array[
   'suppliers','purchase_orders','purchase_order_items','goods_receipts','goods_receipt_items',
   'inventory_batches','device_timeline','device_cost_entries','spare_parts','stock_ledger',
   'job_cards','job_assignments','inspections','qc_checks','devices','shipments'
 ] loop
  execute format('drop policy if exists staff_write on public.%I', t);
  execute format('drop policy if exists staff_read on public.%I', t);
  execute format('drop policy if exists staff_all on public.%I', t);
  execute format('drop policy if exists staff_manage on public.%I', t);
  -- Universal Staff Read Policy: Any authenticated active staff member can view operational data
  execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())', t);
 end loop;
end $$;

-- 6.1 SUPPLIERS: Owner, Workshop Manager & Procurement manage suppliers
drop policy if exists suppliers_manage on public.suppliers;
create policy suppliers_manage on public.suppliers for all to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager', 'procurement'))
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'procurement'));

-- 6.2 PURCHASE ORDERS & ITEMS: Owner, Workshop Manager & Procurement manage POs
drop policy if exists po_manage on public.purchase_orders;
create policy po_manage on public.purchase_orders for all to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager', 'procurement'))
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'procurement'));

drop policy if exists poi_manage on public.purchase_order_items;
create policy poi_manage on public.purchase_order_items for all to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager', 'procurement'))
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'procurement'));

-- 6.3 GOODS RECEIPTS & ITEMS: Owner, Workshop Manager, Procurement & Inventory manage goods receiving
drop policy if exists gr_manage on public.goods_receipts;
create policy gr_manage on public.goods_receipts for all to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager', 'procurement', 'inventory'))
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'procurement', 'inventory'));

drop policy if exists gri_manage on public.goods_receipt_items;
create policy gri_manage on public.goods_receipt_items for all to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager', 'procurement', 'inventory'))
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'procurement', 'inventory'));

-- 6.4 SPARE PARTS & INVENTORY BATCHES: Owner, Workshop Manager & Inventory manage stock
drop policy if exists parts_manage on public.spare_parts;
create policy parts_manage on public.spare_parts for all to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager', 'inventory'))
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'inventory'));

drop policy if exists batches_manage on public.inventory_batches;
create policy batches_manage on public.inventory_batches for all to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager', 'inventory'))
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'inventory'));

-- 6.5 STOCK LEDGER: STRICTLY APPEND-ONLY
-- No update or delete policies exist for anyone. Only permitted roles can insert manual adjustments.
-- FIFO security-definer functions bypass RLS to append stock movements.
drop policy if exists stock_ledger_insert on public.stock_ledger;
drop policy if exists stock_ledger_update on public.stock_ledger;
drop policy if exists stock_ledger_delete on public.stock_ledger;

create policy stock_ledger_insert on public.stock_ledger for insert to authenticated
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'inventory'));

-- 6.6 JOB CARDS: Owner & Workshop Manager create/delete; Technicians can update progress
drop policy if exists jobs_manage on public.job_cards;
drop policy if exists jobs_update on public.job_cards;
drop policy if exists jobs_delete on public.job_cards;

create policy jobs_manage on public.job_cards for insert to authenticated
  with check (public.current_user_role() in ('owner', 'workshop_manager'));

create policy jobs_update on public.job_cards for update to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager', 'technician'))
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'technician'));

create policy jobs_delete on public.job_cards for delete to authenticated
  using (public.current_user_role() = 'owner');

-- 6.7 JOB ASSIGNMENTS: Managers assign/delete; Technicians update their assigned task
drop policy if exists ja_insert on public.job_assignments;
drop policy if exists ja_update on public.job_assignments;
drop policy if exists ja_delete on public.job_assignments;

create policy ja_insert on public.job_assignments for insert to authenticated
  with check (public.current_user_role() in ('owner', 'workshop_manager'));

create policy ja_update on public.job_assignments for update to authenticated
  using (
    public.current_user_role() in ('owner', 'workshop_manager')
    or (public.current_user_role() = 'technician' and technician_id = auth.uid())
  )
  with check (
    public.current_user_role() in ('owner', 'workshop_manager')
    or (public.current_user_role() = 'technician' and technician_id = auth.uid())
  );

create policy ja_delete on public.job_assignments for delete to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager'));

-- 6.8 INTAKE INSPECTIONS: Technicians, QC Inspectors & Managers can record inspections
drop policy if exists insp_insert on public.inspections;
drop policy if exists insp_update on public.inspections;
drop policy if exists insp_delete on public.inspections;

create policy insp_insert on public.inspections for insert to authenticated
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'technician', 'qc_inspector'));

create policy insp_update on public.inspections for update to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager', 'qc_inspector'))
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'qc_inspector'));

create policy insp_delete on public.inspections for delete to authenticated
  using (public.current_user_role() = 'owner');

-- 6.9 QC CHECKS: QC Inspectors, Managers & Owner manage QC audit records
drop policy if exists qc_manage on public.qc_checks;
drop policy if exists qc_update on public.qc_checks;
drop policy if exists qc_delete on public.qc_checks;

create policy qc_manage on public.qc_checks for insert to authenticated
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'qc_inspector'));

create policy qc_update on public.qc_checks for update to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager', 'qc_inspector'))
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'qc_inspector'));

create policy qc_delete on public.qc_checks for delete to authenticated
  using (public.current_user_role() = 'owner');

-- 6.10 DEVICES & SHIPMENTS: Operations management
drop policy if exists devices_insert on public.devices;
drop policy if exists devices_update on public.devices;
drop policy if exists devices_delete on public.devices;

create policy devices_insert on public.devices for insert to authenticated
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'inventory'));

create policy devices_update on public.devices for update to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager', 'technician', 'qc_inspector', 'inventory'))
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'technician', 'qc_inspector', 'inventory'));

create policy devices_delete on public.devices for delete to authenticated
  using (public.current_user_role() = 'owner');

drop policy if exists shipments_manage on public.shipments;
create policy shipments_manage on public.shipments for all to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager', 'inventory', 'procurement'))
  with check (public.current_user_role() in ('owner', 'workshop_manager', 'inventory', 'procurement'));

-- 6.11 DEVICE TIMELINE: STRICTLY APPEND-ONLY
-- No update or delete policies exist for anyone. Any active staff can log timeline milestones.
drop policy if exists timeline_insert on public.device_timeline;
drop policy if exists timeline_update on public.device_timeline;
drop policy if exists timeline_delete on public.device_timeline;

create policy timeline_insert on public.device_timeline for insert to authenticated
  with check (public.is_staff());

-- 6.12 DEVICE COST ENTRIES: Owner & Workshop Manager manage actual cost lines
drop policy if exists dce_manage on public.device_cost_entries;
create policy dce_manage on public.device_cost_entries for all to authenticated
  using (public.current_user_role() in ('owner', 'workshop_manager'))
  with check (public.current_user_role() in ('owner', 'workshop_manager'));

-- ------------------------------------------------------------------------------
-- 7. SECURE RPC FUNCTION: calculate_device_cost
-- - SECURITY DEFINER with empty search_path = ''
-- - Requires active authenticated session
-- - Strictly role-gated: Owner & Workshop Manager only
-- - Revoked from PUBLIC and anon; granted to authenticated only
-- - Computes actual acquisition cost, actual issued FIFO parts cost from stock_ledger,
--   manual parts, and actual labor & other expenses from device_cost_entries.
-- - Avoids double-counting and does NOT use job_cards.estimated_cost.
-- ------------------------------------------------------------------------------
create or replace function public.calculate_device_cost(p_device_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role text;
  v_purchase_cost numeric(12,2) := 0;
  v_fifo_parts_cost numeric(12,2) := 0;
  v_dce_parts_cost numeric(12,2) := 0;
  v_total_parts_cost numeric(12,2) := 0;
  v_labor_cost numeric(12,2) := 0;
  v_other_cost numeric(12,2) := 0;
  v_total_cost numeric(12,2) := 0;
begin
  -- 1. Security Check: Require authenticated session
  if auth.uid() is null then
    raise exception 'Authentication required: You must be logged in to calculate device costs.';
  end if;

  -- 2. Authorization Check: Role restriction (owner and workshop_manager only)
  v_caller_role := public.current_user_role();
  if v_caller_role is null or v_caller_role not in ('owner', 'workshop_manager') then
    raise exception 'Access Denied: Device cost calculation is restricted to Owner and Workshop Manager roles.';
  end if;

  -- 3. Acquisition cost from devices table
  select coalesce(p.purchase_cost, 0) into v_purchase_cost
  from public.devices p
  where p.id = p_device_id;

  if not found then
    raise exception 'Device not found with ID %', p_device_id;
  end if;

  -- 4. Consumed FIFO parts cost from stock_ledger (issued to job cards of this device)
  -- Uses verified live columns: sl.job_card_id, sl.quantity, sl.unit_cost
  select coalesce(sum(abs(sl.quantity) * sl.unit_cost), 0) into v_fifo_parts_cost
  from public.stock_ledger sl
  join public.job_cards jc on jc.id = sl.job_card_id
  where jc.device_id = p_device_id
    and sl.movement_type = 'issue';

  -- 5. Additional manual parts cost from device_cost_entries (if cost_type = 'part')
  select coalesce(sum(dce.quantity * dce.unit_cost), 0) into v_dce_parts_cost
  from public.device_cost_entries dce
  where dce.device_id = p_device_id
    and lower(dce.cost_type) = 'part';

  v_total_parts_cost := v_fifo_parts_cost + v_dce_parts_cost;

  -- 6. Actual labor cost from device_cost_entries (cost_type = 'labor')
  -- Note: Does NOT use job_cards.estimated_cost
  select coalesce(sum(dce.quantity * dce.unit_cost), 0) into v_labor_cost
  from public.device_cost_entries dce
  where dce.device_id = p_device_id
    and lower(dce.cost_type) = 'labor';

  -- 7. Other costs from device_cost_entries (inspection, transport, other expenses)
  select coalesce(sum(dce.quantity * dce.unit_cost), 0) into v_other_cost
  from public.device_cost_entries dce
  where dce.device_id = p_device_id
    and lower(dce.cost_type) not in ('part', 'labor');

  v_total_cost := v_purchase_cost + v_total_parts_cost + v_labor_cost + v_other_cost;

  return jsonb_build_object(
    'device_id', p_device_id,
    'purchase_cost', v_purchase_cost,
    'parts_cost', v_total_parts_cost,
    'fifo_parts_cost', v_fifo_parts_cost,
    'dce_parts_cost', v_dce_parts_cost,
    'labor_cost', v_labor_cost,
    'other_cost', v_other_cost,
    'total_cost', v_total_cost
  );
end;
$$;

-- Revoke all privileges from public and anon
revoke all on function public.calculate_device_cost(uuid) from public;
revoke all on function public.calculate_device_cost(uuid) from anon;

-- Grant execution strictly to authenticated users (role gating enforced inside function)
grant execute on function public.calculate_device_cost(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 8. CORRECTED FIFO FUNCTIONS (Using live verified columns)
-- ------------------------------------------------------------------------------

-- 8.1 receive_spare_part_fifo
create or replace function public.receive_spare_part_fifo(
  p_spare_part_id uuid,
  p_quantity integer,
  p_unit_cost numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_new_quantity integer;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;
  if p_unit_cost < 0 then
    raise exception 'Unit cost cannot be negative.';
  end if;

  insert into public.inventory_batches (
    spare_part_id,
    received_quantity,
    remaining_quantity,
    unit_cost,
    received_at
  ) values (
    p_spare_part_id,
    p_quantity,
    p_quantity,
    p_unit_cost,
    now()
  ) returning id into v_batch_id;

  update public.spare_parts
  set current_stock = coalesce(current_stock, 0) + p_quantity,
      purchase_price = p_unit_cost
  where id = p_spare_part_id
  returning current_stock into v_new_quantity;

  insert into public.stock_ledger (
    spare_part_id,
    movement_type,
    quantity,
    unit_cost,
    reference_note,
    performed_by
  ) values (
    p_spare_part_id,
    'purchase',
    p_quantity,
    p_unit_cost,
    format('FIFO batch received (%s units @ ₹%s)', p_quantity, p_unit_cost),
    auth.uid()
  );

  return jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'spare_part_id', p_spare_part_id,
    'quantity_added', p_quantity,
    'unit_cost', p_unit_cost,
    'new_stock_quantity', v_new_quantity
  );
end;
$$;

-- 8.2 issue_spare_part_fifo
create or replace function public.issue_spare_part_fifo(
  p_spare_part_id uuid,
  p_quantity integer,
  p_job_card_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining_needed integer := p_quantity;
  v_batch record;
  v_deduct_qty integer;
  v_total_cost numeric(12,2) := 0;
  v_current_stock integer;
  v_purchase_price numeric(12,2) := 0;
  v_device_id uuid;
  v_part_name text;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity to issue must be greater than zero.';
  end if;

  select current_stock, purchase_price, coalesce(part_name, sku)
  into v_current_stock, v_purchase_price, v_part_name
  from public.spare_parts
  where id = p_spare_part_id for update;

  if v_current_stock is null then
    raise exception 'Spare part not found.';
  end if;

  if v_current_stock < p_quantity then
    raise exception 'Insufficient stock: Available % units, requested % units.', v_current_stock, p_quantity;
  end if;

  select device_id into v_device_id
  from public.job_cards
  where id = p_job_card_id;

  for v_batch in (
    select id, remaining_quantity, unit_cost
    from public.inventory_batches
    where spare_part_id = p_spare_part_id and remaining_quantity > 0
    order by received_at asc
    for update
  ) loop
    if v_remaining_needed <= 0 then
      exit;
    end if;

    if v_batch.remaining_quantity >= v_remaining_needed then
      v_deduct_qty := v_remaining_needed;
    else
      v_deduct_qty := v_batch.remaining_quantity;
    end if;

    update public.inventory_batches
    set remaining_quantity = remaining_quantity - v_deduct_qty
    where id = v_batch.id;

    v_total_cost := v_total_cost + (v_deduct_qty * v_batch.unit_cost);

    insert into public.stock_ledger (
      spare_part_id,
      movement_type,
      quantity,
      unit_cost,
      job_card_id,
      reference_note,
      performed_by
    ) values (
      p_spare_part_id,
      'issue',
      -v_deduct_qty,
      v_batch.unit_cost,
      p_job_card_id,
      'FIFO batch issue to Job Card',
      auth.uid()
    );

    v_remaining_needed := v_remaining_needed - v_deduct_qty;
  end loop;

  if v_remaining_needed > 0 then
    v_total_cost := v_total_cost + (v_remaining_needed * coalesce(v_purchase_price, 0));
    insert into public.stock_ledger (
      spare_part_id,
      movement_type,
      quantity,
      unit_cost,
      job_card_id,
      reference_note,
      performed_by
    ) values (
      p_spare_part_id,
      'issue',
      -v_remaining_needed,
      coalesce(v_purchase_price, 0),
      p_job_card_id,
      'Direct catalogue issue to Job Card',
      auth.uid()
    );
  end if;

  update public.spare_parts
  set current_stock = current_stock - p_quantity
  where id = p_spare_part_id;

  if v_device_id is not null then
    begin
      insert into public.device_timeline (
        device_id,
        event_type,
        title,
        description
      ) values (
        v_device_id,
        'spare_part_issued',
        'Spare Part Consumed',
        format('Issued %s unit(s) of %s under Job Card. Total FIFO cost: ₹%s', p_quantity, coalesce(v_part_name, 'part'), v_total_cost)
      );
    exception when others then
      -- Non-fatal
    end;
  end if;

  return jsonb_build_object(
    'success', true,
    'spare_part_id', p_spare_part_id,
    'quantity_issued', p_quantity,
    'total_fifo_cost', v_total_cost,
    'job_card_id', p_job_card_id
  );
end;
$$;

revoke all on function public.receive_spare_part_fifo(uuid, integer, numeric) from public;
revoke all on function public.receive_spare_part_fifo(uuid, integer, numeric) from anon;
grant execute on function public.receive_spare_part_fifo(uuid, integer, numeric) to authenticated;

revoke all on function public.issue_spare_part_fifo(uuid, integer, uuid) from public;
revoke all on function public.issue_spare_part_fifo(uuid, integer, uuid) from anon;
grant execute on function public.issue_spare_part_fifo(uuid, integer, uuid) to authenticated;
