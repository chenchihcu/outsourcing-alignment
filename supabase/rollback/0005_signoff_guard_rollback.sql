-- Rollback Migration 0005: Reverts sign-off protection, deletion checks, and restores 0004 insert policy.
-- WARNING: Reverting this weakens server-side signature validation and optimistic locking.

-- 1. Restore projects_insert_scoped from 0004
drop policy if exists projects_insert_scoped on public.projects;
create policy projects_insert_scoped on public.projects
  for insert to authenticated
  with check (
    (workspace = 'default' or (workspace = 'admin_test' and public.is_admin()))
    and updated_by = auth.uid()
  );

-- 2. Drop deletion protection trigger and function
drop trigger if exists trg_protect_project_deletion on public.projects;
drop function if exists public.protect_project_deletion();

-- 3. Drop sign-off protection trigger and function
drop trigger if exists trg_protect_project_signoff on public.projects;
drop function if exists public.protect_project_signoff();

-- 4. Drop version increment trigger and function
drop trigger if exists trg_increment_project_version on public.projects;
drop function if exists public.increment_project_version();

-- 5. Drop version column (Optional: keep column or drop)
alter table public.projects drop column if exists version;
