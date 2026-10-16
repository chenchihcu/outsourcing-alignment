-- =========================================================================
-- 新機種委外加工對齊系統 — Supabase 初始 Schema (P2)
-- 於 Supabase Dashboard → SQL Editor 貼上執行,或用 supabase CLI 套用。
-- 設計:profiles(角色)+ projects(機種,data 以 JSONB 整包儲存)。
-- 安全:Row-Level Security,僅登入者可存取共享工作區的機種。
-- =========================================================================

-- ---- 擴充 ----
create extension if not exists "pgcrypto";

-- =========================================================================
-- profiles:對應 auth.users,儲存角色/單位/簽章
-- =========================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  unit       text,                         -- 研發單位 / 工程單位 / 品保處 / 管理處
  role       text not null default 'rd',   -- rd | eng | qa | admin
  level      text,                         -- 顯示用職級
  signature  text,                         -- 電子簽章圖(dataURL / base64)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 註冊時自動建立 profile(從 auth metadata 帶入)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, unit, role, level)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'unit',
    coalesce(new.raw_user_meta_data->>'role', 'rd'),
    new.raw_user_meta_data->>'level'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- projects:機種(發包方 ↔ 加工廠 共享的對齊資料)
-- data 為整包 JSONB(對應前端 parseRequirementExcel 結果),
-- original_wb 為原始 Excel 的 base64(保留匯出格式)。
-- =========================================================================
create table if not exists public.projects (
  id              text primary key,         -- 沿用前端產生的 id(proj_uuid / default-template)
  name            text not null,
  data            jsonb not null default '{}'::jsonb,
  original_wb     text,                     -- 原始 .xlsx 的 base64
  alignment_rate  int not null default 0,
  workspace       text not null default 'default', -- 區隔正式/admin 測試資料庫
  updated_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists projects_workspace_idx on public.projects(workspace);
create index if not exists projects_updated_at_idx on public.projects(updated_at desc);

-- 自動維護 updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- =========================================================================
-- Row-Level Security
-- 共享工作區模型:任一登入者皆可讀寫機種(雙向對齊本質上是協作)。
-- 如需依組織/廠別細分,可在此加入 workspace 對應的成員表與條件。
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;

-- profiles:本人可讀寫自己的;所有登入者可讀(顯示簽核者資訊)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_upsert_self on public.profiles;
create policy profiles_upsert_self on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (auth.uid() = id);

-- projects:登入者皆可存取共享工作區
drop policy if exists projects_all on public.projects;
create policy projects_all on public.projects
  for all to authenticated using (true) with check (true);

-- =========================================================================
-- Realtime:讓 projects 變更可被即時訂閱(P3)
-- 使用 pg_publication_tables 防呆檢查，避免重複加入 publication 時報錯
-- =========================================================================
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'projects'
  ) then
    alter publication supabase_realtime add table public.projects;
  end if;
end $$;
