-- ==============================================================================
-- 004: SECURE STAFF PROFILE DELETION & FOREIGN KEY UNLINKING RPC
-- ==============================================================================
-- Run this in Supabase SQL Editor to allow authorized Owners to cleanly delete
-- staff accounts along with cleaning up any job assignments or inspector references.

create or replace function public.delete_staff_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  -- 1. Security Check: Only workshop owners can delete staff profiles
  select role into caller_role
  from public.profiles
  where id = auth.uid() and is_active = true;

  if caller_role not in ('owner', 'owner_admin') then
    raise exception 'Unauthorized: Only workshop owners can delete staff profiles';
  end if;

  -- 2. Never allow caller to delete their own account
  if target_user_id = auth.uid() then
    raise exception 'Cannot delete your own logged-in owner profile';
  end if;

  -- 3. Delete any job assignments for this technician
  delete from public.job_assignments where technician_id = target_user_id;

  -- 4. Nullify inspector references in inspections and qc checks
  update public.inspections set inspector_id = null where inspector_id = target_user_id;
  update public.qc_checks set inspector_id = null where inspector_id = target_user_id;

  -- 5. Nullify initial_technician_id in job cards
  update public.job_cards set initial_technician_id = null where initial_technician_id = target_user_id;

  -- 6. Delete profile row
  delete from public.profiles where id = target_user_id;

  -- 7. Delete auth user record if exists
  delete from auth.users where id = target_user_id;
end;
$$;

-- Grant execution to authenticated users (role checked inside function)
grant execute on function public.delete_staff_member(uuid) to authenticated;
