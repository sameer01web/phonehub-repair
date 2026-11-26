-- ==============================================================================
-- 009: FIX PROFILES PERMISSIONS & RLS RECURSION (COMPLETE & PERMANENT FIX)
-- ==============================================================================
-- Run this ENTIRE script in your Supabase Project > SQL Editor.
-- This immediately and permanently fixes:
-- 1. "infinite recursion detected in policy for relation 'profiles'" (Error 42P17)
-- 2. "permission denied for table profiles" (Error 42501)
-- 3. Enables owners/managers to edit staff names and roles (e.g. Technician -> Manager)
-- 4. Ensures menubar, role preview, and protected dashboard load without errors.

-- ------------------------------------------------------------------------------
-- Step 1: Drop all old/problematic policies on public.profiles
-- ------------------------------------------------------------------------------
drop policy if exists profile_owner_manage on public.profiles;
drop policy if exists profile_staff_read on public.profiles;
drop policy if exists profile_self_read on public.profiles;
drop policy if exists profile_read_all on public.profiles;
drop policy if exists profile_anon_read on public.profiles;
drop policy if exists profile_self_update on public.profiles;
drop policy if exists profile_update on public.profiles;
drop policy if exists profile_insert on public.profiles;
drop policy if exists profile_delete on public.profiles;
drop policy if exists staff_read on public.profiles;
drop policy if exists staff_write on public.profiles;

-- ------------------------------------------------------------------------------
-- Step 2: Grant table privileges to authenticated, anon and service_role
-- ------------------------------------------------------------------------------
grant select on public.profiles to anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- ------------------------------------------------------------------------------
-- Step 3: Enable Row Level Security (RLS)
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- ------------------------------------------------------------------------------
-- Step 4: Security Definer helper functions (Run as postgres, zero RLS recursion)
-- ------------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  );
$$;

grant execute on function public.is_staff() to authenticated, anon;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'owner_admin', 'workshop_manager') and is_active = true
  ) or (auth.jwt() ->> 'email') = 'phone@gmail.com';
$$;

grant execute on function public.is_admin_or_owner() to authenticated, anon;

-- ------------------------------------------------------------------------------
-- Step 5: Clean Non-Recursive RLS Policies
-- ------------------------------------------------------------------------------

-- SELECT Policy: Authenticated users can view workshop staff profiles
create policy profile_read_all on public.profiles
  for select to authenticated
  using (true);

-- SELECT Policy for anon (allows login check)
create policy profile_anon_read on public.profiles
  for select to anon
  using (true);

-- INSERT Policy: Authenticated users can create profile records
create policy profile_insert on public.profiles
  for insert to authenticated
  with check (true);

-- UPDATE Policy: Staff can update own profile, Owners/Managers can update any staff
create policy profile_update on public.profiles
  for update to authenticated
  using (
    id = auth.uid()
    or (auth.jwt() ->> 'email') = 'phone@gmail.com'
    or public.is_admin_or_owner()
  )
  with check (
    id = auth.uid()
    or (auth.jwt() ->> 'email') = 'phone@gmail.com'
    or public.is_admin_or_owner()
  );

-- DELETE Policy: Owners can delete staff records
create policy profile_delete on public.profiles
  for delete to authenticated
  using (
    (auth.jwt() ->> 'email') = 'phone@gmail.com'
    or public.is_admin_or_owner()
  );

-- ------------------------------------------------------------------------------
-- Step 6: Secure RPC for updating staff profile and role
-- ------------------------------------------------------------------------------
create or replace function public.update_staff_member(
  target_user_id uuid,
  new_full_name text,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_email text;
begin
  caller_email := coalesce(auth.jwt() ->> 'email', '');

  -- Allow phone@gmail.com or active owner/admin/manager
  select role into caller_role
  from public.profiles
  where id = auth.uid() and is_active = true;

  if caller_email <> 'phone@gmail.com' and coalesce(caller_role, '') not in ('owner', 'owner_admin', 'workshop_manager') then
    raise exception 'Unauthorized: Only workshop owners can edit staff profiles and roles';
  end if;

  -- Validate role is one of valid workshop roles
  if new_role not in ('owner', 'owner_admin', 'workshop_manager', 'technician', 'inventory', 'qc_inspector', 'procurement', 'sales') then
    raise exception 'Invalid role: %', new_role;
  end if;

  -- Update profiles table
  update public.profiles
  set
    full_name = coalesce(nullif(trim(new_full_name), ''), full_name),
    role = new_role
  where id = target_user_id;

  if not found then
    raise exception 'Staff member with ID % not found', target_user_id;
  end if;
end;
$$;

grant execute on function public.update_staff_member(uuid, text, text) to authenticated;

-- ------------------------------------------------------------------------------
-- Step 7: Ensure primary owner (phone@gmail.com) is active owner in profiles
-- ------------------------------------------------------------------------------
update public.profiles
set
  role = 'owner',
  is_active = true
where id in (
  select id from auth.users where email = 'phone@gmail.com'
);
