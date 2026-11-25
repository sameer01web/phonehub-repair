-- ==============================================================================
-- 008: GRANT PROFILES PERMISSIONS & SECURE STAFF UPDATE RPC
-- ==============================================================================
-- Run this in your Supabase Project > SQL Editor to fix:
-- "permission denied for table profiles"
-- This allows authorized workshop owners to update staff names, roles, and status.

-- 1. Grant table-level permissions to authenticated users
grant select, insert, update on public.profiles to authenticated;

-- 2. Update RLS policy to allow owners to manage all staff profiles
drop policy if exists profile_owner_manage on public.profiles;
create policy profile_owner_manage on public.profiles
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('owner', 'owner_admin') and is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('owner', 'owner_admin') and is_active = true
    )
  );

-- 3. Also allow staff members to read all staff profiles
drop policy if exists profile_staff_read on public.profiles;
create policy profile_staff_read on public.profiles
  for select to authenticated
  using (public.is_staff());

-- 4. Secure RPC function for updating staff profile and role (Security Definer)
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
begin
  -- Security check: Only workshop owners can edit staff profiles and roles
  select role into caller_role
  from public.profiles
  where id = auth.uid() and is_active = true;

  if caller_role not in ('owner', 'owner_admin') then
    raise exception 'Unauthorized: Only workshop owners can edit staff profiles and roles';
  end if;

  -- Validate role is one of valid workshop roles
  if new_role not in ('owner', 'owner_admin', 'workshop_manager', 'technician', 'inventory', 'qc_inspector', 'procurement', 'sales') then
    raise exception 'Invalid role: %', new_role;
  end if;

  -- Update profiles table
  update public.profiles
  set
    full_name = coalesce(new_full_name, full_name),
    role = new_role
  where id = target_user_id;

  if not found then
    raise exception 'Staff member with ID % not found', target_user_id;
  end if;
end;
$$;

grant execute on function public.update_staff_member(uuid, text, text) to authenticated;
