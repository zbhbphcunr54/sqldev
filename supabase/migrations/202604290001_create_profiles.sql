-- [2026-05-03] 补充：添加表和列注释
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,  -- 关联 auth.users.id，删除用户时同步删除
  email text,                              -- 用户邮箱（从 auth.users 同步）
  nickname text,                           -- 用户昵称（可选，用于展示）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

COMMENT ON TABLE public.profiles IS '用户资料扩展表，与 auth.users 一对一关联';
COMMENT ON COLUMN public.profiles.id IS '关联 auth.users.id，ON DELETE CASCADE 同步删除';
COMMENT ON COLUMN public.profiles.email IS '用户邮箱，从 auth.users.email 同步';
COMMENT ON COLUMN public.profiles.nickname IS '用户昵称（可选），用于评论区、消息等场景展示';

alter table public.profiles enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
