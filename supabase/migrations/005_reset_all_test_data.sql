-- ==============================================================================
-- 005: PHONE HUB OPERATIONAL TEST DATA RESET (FK SAFE)
-- ==============================================================================
-- Run this script in the Supabase Dashboard SQL Editor (https://supabase.com/dashboard)
-- It safely and completely purges all test/demo operational data while strictly
-- preserving your 4 Staff Profiles (aziz, technicians) and Auth accounts.
-- ==============================================================================

-- Option A: Instant Truncate with Cascade (Recommended - Immune to foreign key order)
TRUNCATE TABLE
  public.inventory_batch_movements,
  public.stock_ledger,
  public.inventory_batches,
  public.goods_receipt_items,
  public.goods_receipts,
  public.purchase_order_items,
  public.purchase_orders,
  public.job_assignments,
  public.inspections,
  public.qc_checks,
  public.device_cost_entries,
  public.device_timeline,
  public.job_cards,
  public.devices,
  public.shipments,
  public.spare_parts,
  public.suppliers
CASCADE;

-- Grant table DELETE permissions to authenticated staff for future UI operations
GRANT DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Verification: Check remaining counts
SELECT 'devices' AS table_name, count(*) AS remaining FROM public.devices
UNION ALL
SELECT 'job_cards', count(*) FROM public.job_cards
UNION ALL
SELECT 'job_assignments', count(*) FROM public.job_assignments
UNION ALL
SELECT 'inspections', count(*) FROM public.inspections
UNION ALL
SELECT 'qc_checks', count(*) FROM public.qc_checks
UNION ALL
SELECT 'spare_parts', count(*) FROM public.spare_parts
UNION ALL
SELECT 'goods_receipts', count(*) FROM public.goods_receipts
UNION ALL
SELECT 'purchase_orders', count(*) FROM public.purchase_orders
UNION ALL
SELECT 'inventory_batches', count(*) FROM public.inventory_batches
UNION ALL
SELECT 'stock_ledger', count(*) FROM public.stock_ledger
UNION ALL
SELECT 'inventory_batch_movements', count(*) FROM public.inventory_batch_movements
UNION ALL
SELECT 'profiles (PRESERVED STAFF)', count(*) FROM public.profiles;
