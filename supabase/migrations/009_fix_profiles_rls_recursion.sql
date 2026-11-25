-- ==============================================================================
-- 009: FIX PROFILES RLS INFINITE RECURSION
-- ==============================================================================
-- Run this query in your Supabase Project > SQL Editor.
-- This permanently fixes:
-- "infinite recursion detected in policy for relation 'profiles'" (Error 42P17)

-- 1. Drop all recursive policies on profiles
drop policy if exists profile_owner_manage on public.profiles;
drop policy if exists profile_staff_read on public.profiles;
drop policy if exists profile_self_read on public.profiles;
drop policy if exists profile_read_all on public.profiles;
drop policy if exists profile_self_update on public.profiles;
drop policy if exists staff_read on public.profiles;
drop policy if exists staff_write on public.profiles;

-- 2. Non-recursive SELECT policy:
-- Any authenticated workshop user can read staff profiles without table subqueries
create policy profile_read_all on public.profiles
  for select to authenticated
  using (true);

-- 3. Non-recursive UPDATE policy for own profile:
create policy profile_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 4. Grant table privileges to authenticated
grant select, insert, update on public.profiles to authenticated;

-- 5. Fix is_staff function to be SECURITY DEFINER with public search_path
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

grant execute on function public.is_staff() to authenticated;
