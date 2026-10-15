-- Migration 0005: Sign-off authorization, optimistic locking versioning, and project deletion protection.
-- Fixes D-05 (server-side sign-off guard), D-07 (deletion guard), D-27 (version increment), and D-154 (QA insert guard).

-- 1. Add version column for optimistic locking (D-27)
alter table public.projects
  add column if not exists version bigint not null default 0;

-- 2. Helper function to get current user's profile role
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated, service_role;

-- 3. Trigger function to enforce sign-off authorization, optimistic lock, and QA restrictions
create or replace function public.guard_project_mutations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_role text;
  old_signoff jsonb;
  new_signoff jsonb;
  old_rd text;
  new_rd text;
  old_pe text;
  new_pe text;
  old_qa text;
  new_qa text;
  old_rej jsonb;
  new_rej jsonb;
begin
  -- Bypass for background jobs or admin service role
  if auth.role() = 'service_role' then
    return new;
  end if;

  user_role := public.current_user_role();

  -- D-154: QA role cannot create new projects (QA is audit-only)
  if TG_OP = 'INSERT' then
    if user_role = 'qa' then
      raise exception 'QA role is not permitted to create new projects';
    end if;
    new.version := 1;
    return new;
  end if;

  -- TG_OP = 'UPDATE'
  -- D-27: Increment version on every change
  new.version := coalesce(old.version, 0) + 1;

  -- Admin can modify anything
  if public.is_admin() then
    return new;
  end if;

  -- Extract signoff objects
  old_signoff := coalesce(old.data->'basicInfo'->'signOff', '{}'::jsonb);
  new_signoff := coalesce(new.data->'basicInfo'->'signOff', '{}'::jsonb);

  old_rd := coalesce(old_signoff->>'rdSignature', '');
  new_rd := coalesce(new_signoff->>'rdSignature', '');
  old_pe := coalesce(old_signoff->>'engineeringReviewSignature', '');
  new_pe := coalesce(new_signoff->>'engineeringReviewSignature', '');
  old_qa := coalesce(old_signoff->>'qaSignature', '');
  new_qa := coalesce(new_signoff->>'qaSignature', '');

  old_rej := old_signoff->'rejection';
  new_rej := new_signoff->'rejection';

  -- D-05: Enforce that only RD can sign RD signature
  if new_rd <> old_rd and user_role <> 'rd' then
    raise exception 'only RD role can sign or update RD signature';
  end if;

  -- D-05: Enforce that only ENG can sign Engineering Review signature
  if new_pe <> old_pe and user_role <> 'eng' then
    raise exception 'only ENG role can sign or update engineering review signature';
  end if;

  -- D-05: Enforce that only QA can sign QA signature or reject
  if new_qa <> old_qa and user_role <> 'qa' then
    raise exception 'only QA role can sign or update QA signature';
  end if;

  if (new_rej is distinct from old_rej) and user_role <> 'qa' and user_role <> 'admin' then
    -- Allow RD or ENG to submit resubmit (which removes rejection)
    if new_rej is not null and old_rej is null then
      raise exception 'only QA role can reject a project';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_project_mutations() from public;

drop trigger if exists project_guard_mutations_trigger on public.projects;
create trigger project_guard_mutations_trigger
  before insert or update on public.projects
  for each row execute function public.guard_project_mutations();

-- 4. D-07: Deletion guard (template cannot be deleted; signed projects cannot be deleted without revocation; only creator or admin can delete)
create or replace function public.guard_project_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signoff jsonb;
begin
  if auth.role() = 'service_role' or public.is_admin() then
    -- Template protection still applies to everyone
    if old.id = 'default-template' then
      raise exception 'default-template cannot be deleted';
    end if;
    return old;
  end if;

  -- Template protection
  if old.id = 'default-template' then
    raise exception 'default-template cannot be deleted';
  end if;

  -- Signed projects cannot be deleted directly
  signoff := coalesce(old.data->'basicInfo'->'signOff', '{}'::jsonb);
  if coalesce(signoff->>'rdSignature', '') <> ''
     or coalesce(signoff->>'engineeringReviewSignature', '') <> ''
     or coalesce(signoff->>'qaSignature', '') <> '' then
    raise exception 'cannot delete project with active signatures; signatures must be revoked first';
  end if;

  -- Only creator or admin can delete
  if old.updated_by is distinct from auth.uid() then
    raise exception 'only the creator or an administrator can delete this project';
  end if;

  return old;
end;
$$;

revoke all on function public.guard_project_deletion() from public;

drop trigger if exists project_guard_deletion_trigger on public.projects;
create trigger project_guard_deletion_trigger
  before delete on public.projects
  for each row execute function public.guard_project_deletion();
