-- Migration 0005: Sign-off, Approval, Deletion guardrails, and optimistic locking version
-- Backward compatible; safeguards data integrity on Supabase for projects table.
-- DO NOT APPLY TO PRODUCTION WITHOUT PRIOR AUTHORIZATION (Dry-run / Specification only).

-- 1. Add version column for optimistic locking (D-27)
alter table public.projects
  add column if not exists version bigint not null default 0;

-- 2. Trigger function to auto-increment version on every update
create or replace function public.increment_project_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.version = coalesce(old.version, 0) + 1;
  return new;
end;
$$;

revoke all on function public.increment_project_version() from public;

drop trigger if exists trg_increment_project_version on public.projects;
create trigger trg_increment_project_version
  before update on public.projects
  for each row execute function public.increment_project_version();

-- 3. Trigger function to enforce sign-off, approval, and form modification rules (D-05, OD-10, OD-12, OD-13)
create or replace function public.protect_project_signoff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_old_rd text;
  v_new_rd text;
  v_old_pe text;
  v_new_pe text;
  v_old_qa text;
  v_new_qa text;
  v_old_qa_app text;
  v_new_qa_app text;
  v_old_reject text;
  v_new_reject text;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Fetch current user's profile role
  select role into v_role
  from public.profiles
  where id = auth.uid();

  if v_role is null then
    raise exception 'user profile not found or inactive';
  end if;

  -- Extract sign-off signatures
  v_old_rd := old.data->'basicInfo'->'signOff'->>'rdSignature';
  v_new_rd := new.data->'basicInfo'->'signOff'->>'rdSignature';
  v_old_pe := old.data->'basicInfo'->'signOff'->>'engineeringReviewSignature';
  v_new_pe := new.data->'basicInfo'->'signOff'->>'engineeringReviewSignature';
  v_old_qa := old.data->'basicInfo'->'signOff'->>'qaSignature';
  v_new_qa := new.data->'basicInfo'->'signOff'->>'qaSignature';

  v_old_qa_app := old.data->'basicInfo'->'qaApproval'->>'status';
  v_new_qa_app := new.data->'basicInfo'->'qaApproval'->>'status';
  v_old_reject := old.data->'basicInfo'->'signOff'->'rejection'->>'reason';
  v_new_reject := new.data->'basicInfo'->'signOff'->'rejection'->>'reason';

  -- RD signature check
  if v_new_rd is distinct from v_old_rd then
    if v_role <> 'rd' then
      raise exception 'only RD role may update RD signature';
    end if;
  end if;

  -- PE signature check (Must be PE/eng, and RD must already be signed - OD-13)
  if v_new_pe is distinct from v_old_pe then
    if v_role <> 'eng' then
      raise exception 'only engineering role may update PE signature';
    end if;
    if v_new_pe is not null and v_new_pe <> '' and (v_new_rd is null or v_new_rd = '') then
      raise exception 'cannot sign PE before RD signature is completed';
    end if;
  end if;

  -- QA signature check (Must be QA, and PE must already be signed - OD-13)
  if v_new_qa is distinct from v_old_qa then
    if v_role <> 'qa' then
      raise exception 'only QA role may update QA signature';
    end if;
    if v_new_qa is not null and v_new_qa <> '' and (v_new_pe is null or v_new_pe = '') then
      raise exception 'cannot sign QA before PE signature is completed';
    end if;
  end if;

  -- QA approval check
  if v_new_qa_app is distinct from v_old_qa_app or v_new_reject is distinct from v_old_reject then
    if v_role <> 'qa' and v_role <> 'admin' then
      raise exception 'only QA or Admin role may change QA approval/rejection state';
    end if;
  end if;

  -- OD-12: If already signed and modifying other fields without revoking signatures, block modification
  if (v_old_rd is not null and v_old_rd <> '') or (v_old_pe is not null and v_old_pe <> '') or (v_old_qa is not null and v_old_qa <> '') then
    -- If signatures are not being revoked (i.e. Still present in new), check if other critical sections are tampered
    if (v_new_rd is not null and v_new_rd <> '') and (new.data - 'basicInfo' is distinct from old.data - 'basicInfo') then
      -- Modifying form while signature exists is forbidden; signatures must be revoked first
      raise exception 'cannot modify project form while signatures are active; revoke signatures first';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_project_signoff() from public;

drop trigger if exists trg_protect_project_signoff on public.projects;
create trigger trg_protect_project_signoff
  before update on public.projects
  for each row execute function public.protect_project_signoff();

-- 4. Trigger function to enforce deletion constraints (D-07, OD-06)
create or replace function public.protect_project_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_rd text;
  v_pe text;
  v_qa text;
begin
  if auth.role() = 'service_role' then
    return old;
  end if;

  -- Protect default template
  if old.id = 'default-template' then
    raise exception 'cannot delete system default template';
  end if;

  -- Check user role
  select role into v_role
  from public.profiles
  where id = auth.uid();

  -- OD-06: Only creator or admin can delete
  if v_role <> 'admin' and old.updated_by <> auth.uid() then
    raise exception 'only the creator or an administrator may delete a project';
  end if;

  -- OD-06: Projects with any active signature cannot be deleted without revoking first
  v_rd := old.data->'basicInfo'->'signOff'->>'rdSignature';
  v_pe := old.data->'basicInfo'->'signOff'->>'engineeringReviewSignature';
  v_qa := old.data->'basicInfo'->'signOff'->>'qaSignature';

  if (v_rd is not null and v_rd <> '') or (v_pe is not null and v_pe <> '') or (v_qa is not null and v_qa <> '') then
    raise exception 'cannot delete project with active signatures; signatures must be revoked first';
  end if;

  return old;
end;
$$;

revoke all on function public.protect_project_deletion() from public;

drop trigger if exists trg_protect_project_deletion on public.projects;
create trigger trg_protect_project_deletion
  before delete on public.projects
  for each row execute function public.protect_project_deletion();

-- 5. QA cannot insert projects (D-154, OD-05)
drop policy if exists projects_insert_scoped on public.projects;
create policy projects_insert_scoped on public.projects
  for insert to authenticated
  with check (
    (workspace = 'default' or (workspace = 'admin_test' and public.is_admin()))
    and updated_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('rd', 'eng', 'admin')
    )
  );
