-- PHONE HUB SINGLE-SHOP DATABASE EXTENSION (002)
-- Idempotent schema migration for Procurement, FIFO Batches, Device Timeline, QC & Costing.
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- 1. SUPPLIERS TABLE
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

-- 2. PURCHASE ORDERS TABLE
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text unique not null,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  status text not null default 'draft' check(status in ('draft','ordered','partially_received','received','cancelled')),
  total_amount numeric(12,2) not null default 0 check(total_amount >= 0),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 3. PURCHASE ORDER ITEMS TABLE
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  spare_part_id uuid not null references public.spare_parts(id) on delete restrict,
  ordered_quantity integer not null check(ordered_quantity > 0),
  unit_cost numeric(12,2) not null default 0 check(unit_cost >= 0)
);

-- 4. GOODS RECEIPTS TABLE
create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  grn_number text unique not null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  received_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- 5. GOODS RECEIPT ITEMS TABLE
create table if not exists public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references public.goods_receipts(id) on delete cascade,
  purchase_order_item_id uuid references public.purchase_order_items(id) on delete set null,
  received_quantity integer not null default 0 check(received_quantity >= 0),
  accepted_quantity integer not null default 0 check(accepted_quantity >= 0),
  rejected_quantity integer not null default 0 check(rejected_quantity >= 0),
  unit_cost numeric(12,2) not null default 0
);

-- 6. INVENTORY BATCHES (FIFO BATCH TRACKING)
create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  spare_part_id uuid not null references public.spare_parts(id) on delete cascade,
  received_quantity integer not null check(received_quantity > 0),
  remaining_quantity integer not null check(remaining_quantity >= 0),
  unit_cost numeric(12,2) not null default 0,
  received_at timestamptz not null default now()
);

-- 7. DEVICE TIMELINE (360 DEGREE AUDITABLE LIFECYCLE)
create table if not exists public.device_timeline (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

-- 8. EXTEND COLUMNS IF MISSING
alter table public.spare_parts add column if not exists compatible_models text default '';
alter table public.job_cards add column if not exists complaint text;
alter table public.job_cards add column if not exists diagnosis text;
alter table public.qc_checks add column if not exists job_card_id uuid references public.job_cards(id) on delete set null;
alter table public.qc_checks add column if not exists failure_reason text;
alter table public.qc_checks add column if not exists rework_notes text;
alter table public.qc_checks add column if not exists checked_at timestamptz not null default now();

-- 9. INDEXES FOR HIGH-EFFICIENCY LOOKUPS
create index if not exists idx_po_supplier on public.purchase_orders(supplier_id);
create index if not exists idx_poi_po on public.purchase_order_items(purchase_order_id);
create index if not exists idx_gr_po on public.goods_receipts(purchase_order_id);
create index if not exists idx_gri_gr on public.goods_receipt_items(goods_receipt_id);
create index if not exists idx_batches_part_qty on public.inventory_batches(spare_part_id, remaining_quantity);
create index if not exists idx_timeline_device on public.device_timeline(device_id, created_at desc);

-- 10. ENABLE RLS POLICIES FOR NEW TABLES
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_items enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.device_timeline enable row level security;

do $$ declare t text; begin
 foreach t in array array['suppliers','purchase_orders','purchase_order_items','goods_receipts','goods_receipt_items','inventory_batches','device_timeline'] loop
  execute format('drop policy if exists staff_read on public.%I', t);
  execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())', t);
  execute format('drop policy if exists staff_write on public.%I', t);
  execute format('create policy staff_write on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
 end loop;
end $$;

-- 11. SECURE DATABASE FUNCTION: receive_spare_part_fifo
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

  -- 1. Create FIFO batch
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

  -- 2. Update spare_parts on-hand current_stock and latest purchase_price
  update public.spare_parts
  set current_stock = coalesce(current_stock, 0) + p_quantity,
      purchase_price = p_unit_cost
  where id = p_spare_part_id
  returning current_stock into v_new_quantity;

  -- 3. Record in stock_ledger
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

-- 12. SECURE DATABASE FUNCTION: issue_spare_part_fifo
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

  -- Check available stock from current_stock
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

  -- Look up device_id from job card for timeline audit
  select device_id into v_device_id
  from public.job_cards
  where id = p_job_card_id;

  -- Iterate through batches in FIFO order (oldest received_at first)
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

    -- Log stock ledger entry for each consumed batch
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

  -- If unallocated units remain, fallback to purchase_price
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

  -- Update master stock quantity in current_stock
  update public.spare_parts
  set current_stock = current_stock - p_quantity
  where id = p_spare_part_id;

  -- Audit in device timeline if job card is linked to a device
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

-- 13. SECURE FUNCTION: calculate_device_cost
create or replace function public.calculate_device_cost(p_device_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_cost numeric(12,2) := 0;
  v_parts_cost numeric(12,2) := 0;
  v_labor_cost numeric(12,2) := 0;
  v_total_cost numeric(12,2) := 0;
begin
  -- 1. Acquisition cost
  select coalesce(purchase_cost, 0) into v_purchase_cost
  from public.devices
  where id = p_device_id;

  -- 2. Consumed parts cost (from stock_ledger linked to this device's job cards)
  select coalesce(sum(abs(sl.quantity_delta) * sl.unit_cost), 0) into v_parts_cost
  from public.stock_ledger sl
  join public.job_cards jc on jc.id = sl.reference_id
  where jc.device_id = p_device_id
    and sl.movement_type = 'issue';

  -- 3. Labor cost (from job assignments)
  select coalesce(sum(ja.labor_cost), 0) into v_labor_cost
  from public.job_assignments ja
  join public.job_cards jc on jc.id = ja.job_id
  where jc.device_id = p_device_id;

  v_total_cost := v_purchase_cost + v_parts_cost + v_labor_cost;

  return jsonb_build_object(
    'device_id', p_device_id,
    'purchase_cost', v_purchase_cost,
    'parts_cost', v_parts_cost,
    'labor_cost', v_labor_cost,
    'total_cost', v_total_cost
  );
end;
$$;
