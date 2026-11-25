-- ==============================================================================
-- 005: PHONE HUB OPERATIONAL TEST DATA RESET & PERMISSION FIX
-- ==============================================================================
-- Run this script in the Supabase Dashboard SQL Editor (https://supabase.com/dashboard)
-- It safely purges all test/demo operational data in foreign-key dependency order,
-- and grants standard DELETE permissions so authorized Owners can manage records.
--
-- PRESERVED ASSETS:
-- - All Authentication accounts (auth.users)
-- - All 4 Staff & Owner profiles (public.profiles)
-- - All database tables, columns, constraints, RLS policies, and FIFO RPC functions.
-- ==============================================================================

BEGIN;

-- 1. Delete child transactional records
DELETE FROM public.job_assignments;
DELETE FROM public.inspections;
DELETE FROM public.qc_checks;
DELETE FROM public.device_cost_entries;
DELETE FROM public.device_timeline;
DELETE FROM public.stock_ledger;
DELETE FROM public.inventory_batches;
DELETE FROM public.goods_receipt_items;
DELETE FROM public.purchase_order_items;

-- 2. Delete parent operational records
DELETE FROM public.goods_receipts;
DELETE FROM public.purchase_orders;
DELETE FROM public.job_cards;
DELETE FROM public.devices;
DELETE FROM public.shipments;
DELETE FROM public.spare_parts;
DELETE FROM public.suppliers;

-- 3. Grant table DELETE permissions to authenticated users
-- (This ensures the authenticated owner account can delete records from the app UI)
GRANT DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

COMMIT;

-- 4. Verification Query: Confirm 0 operational records and preserved staff profiles
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
SELECT 'profiles (PRESERVED STAFF)', count(*) FROM public.profiles;
