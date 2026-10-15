-- Emergency rollback for 0005_signoff_guard.sql.
-- WARNING: this removes server-side signature checks, deletion guards, and automatic version incrementing.

drop trigger if exists project_guard_deletion_trigger on public.projects;
drop function if exists public.guard_project_deletion();

drop trigger if exists project_guard_mutations_trigger on public.projects;
drop function if exists public.guard_project_mutations();

drop function if exists public.current_user_role();

-- Note: we do not drop the version column to prevent data loss, but rollback triggers and guards
