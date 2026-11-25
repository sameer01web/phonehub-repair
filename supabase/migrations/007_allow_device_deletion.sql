-- ==============================================================================
-- 007: ALLOW HANDSET / DEVICE DELETION & TIMELINE CASCADE
-- ==============================================================================
-- Run this in Supabase SQL Editor so handsets can be cleanly deleted:
-- 1. Updates foreign key constraint on device_timeline to ON DELETE CASCADE.
-- 2. Creates DELETE policy on device_timeline for authenticated workshop staff.
-- 3. Provides a secure delete_device(target_device_id uuid) RPC function.

-- 1. Update foreign key to cascade delete
alter table if exists public.device_timeline
  drop constraint if exists device_timeline_device_id_fkey;

alter table if exists public.device_timeline
  add constraint device_timeline_device_id_fkey
  foreign key (device_id) references public.devices(id)
  on delete cascade;

-- 2. Allow staff / owners to delete from device_timeline
drop policy if exists timeline_delete on public.device_timeline;
create policy timeline_delete on public.device_timeline
  for delete to authenticated
  using (public.is_staff());

-- 3. Secure RPC function to safely delete handset and all child records
create or replace function public.delete_device(target_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  v_job_count int;
begin
  -- Security Check: Only workshop owners and managers can delete handsets
  select role into caller_role
  from public.profiles
  where id = auth.uid() and is_active = true;

  if caller_role not in ('owner', 'owner_admin', 'manager') then
    raise exception 'Unauthorized: Only workshop owners and managers can delete handsets';
  end if;

  -- Verify no active or existing job cards
  select count(*) into v_job_count
  from public.job_cards
  where device_id = target_device_id;

  if v_job_count > 0 then
    raise exception 'Cannot delete handset: It has % associated repair job card(s). Complete or remove job cards first.', v_job_count;
  end if;

  -- Clean up child records
  delete from public.device_timeline where device_id = target_device_id;
  delete from public.device_cost_entries where device_id = target_device_id;
  delete from public.qc_checks where device_id = target_device_id;
  delete from public.inspections where device_id = target_device_id;

  -- Delete the handset
  delete from public.devices where id = target_device_id;
end;
$$;

-- Grant execution to authenticated staff
grant execute on function public.delete_device(uuid) to authenticated;
