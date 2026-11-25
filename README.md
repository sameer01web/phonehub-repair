# Phone Hub — Single-Shop Repair & Resale

A React + TypeScript + Vite application with a Supabase/PostgreSQL backend foundation for one mobile-phone repair and resale shop. It is **not** a multi-tenant SaaS application.

## Technology
- React 18, TypeScript (strict), Vite
- Tailwind CSS, responsive custom enterprise UI, Lucide icons
- React Router, TanStack Query, React Hook Form/Zod dependencies
- Supabase Auth + PostgreSQL + Row Level Security
- Recharts dependency for future analytics modules

## Requirements
- Node.js 20 LTS (recommended) or newer compatible LTS
- npm
- Supabase project

## Open in Antigravity / VS Code
1. Extract the ZIP.
2. Open the folder that contains `package.json` (the root `PHONE_HUB_SINGLE_SHOP` folder).
3. Open Terminal in that exact folder.
4. Run:
   ```bash
   npm install
   ```
5. Copy `.env.example` to `.env`.
6. Add your Supabase Project URL and anon/publishable key to `.env`.
7. In Supabase Dashboard → SQL Editor, run `supabase/migrations/001_phone_hub_single_shop.sql`.
8. Create a user through Supabase Auth. Then find that user's UUID in Authentication → Users and run the owner update SQL shown at the bottom of the migration.
9. Start the app:
   ```bash
   npm run dev
   ```
10. Open the local URL printed by Vite.

## Current implementation status
Included and wired to Supabase:
- Responsive single-shop application shell and dashboard
- Devices: create, list and search; IMEI1 uniqueness is enforced by the database
- Job cards: create, list and search
- Spare parts catalogue: create, list and search
- Sales: create, list and search
- Database tables for shipments, technician assignments, inspections, stock ledger, QC, customers and audit logs
- Supabase profile/role foundation and authenticated staff RLS baseline

Navigation placeholders / database foundation only (not yet full workflows):
- Shipments, detailed inspection forms, technician task/time tracking, barcode/QR camera scanning and label printing, QC/rework UI, customer management, purchase orders and goods receipt, FIFO/weighted-average costing, device cost rollup, returns/warranty, advanced reports, offline synchronization and full audit UI.
- No production-ready offline writes are claimed.
- Role-specific write permissions need to be tightened and tested against the final staff permission matrix before production.
- This is a functional MVP foundation, not a fully audited production ERP. Do not use it for live financial/stock operations until workflows, RLS and tests are completed.

## Troubleshooting
- `ENOENT package.json`: terminal is in the wrong folder. Run `dir` and confirm `package.json` is visible before `npm install`.
- Supabase not configured: ensure `.env` is at project root, variable names exactly match `.env.example`, and restart `npm run dev`.
- RLS error: confirm you created an Auth user, assigned the intended role, and ran the SQL migration successfully.
- Never put the Supabase `service_role` secret in a browser `.env`; only use the anon/publishable key in this frontend.

## Build
```bash
npm run typecheck
npm run build
```
