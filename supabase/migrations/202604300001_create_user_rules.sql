-- 202604300001_create_user_rules.sql
-- SQL 转换规则：系统默认规则（user_id = NULL）+ 用户自定义规则

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.user_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('ddl', 'body')),
  rules_json  jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- user_id + kind 唯一约束：同一用户每种规则只有一条，系统规则（NULL）可多条
-- PostgreSQL 中 NULL 不参与唯一约束，所以 unique(user_id, kind) 自然允许多个 NULL user_id
create unique index idx_user_rules_user_kind
  on public.user_rules (user_id, kind)
  where user_id is not null;

comment on table public.user_rules is 'SQL 转换规则，系统默认规则 user_id 为 NULL，用户自定义规则绑定 user_id';
comment on column public.user_rules.user_id is '所属用户 ID，NULL 表示系统默认规则（所有用户可读）';
comment on column public.user_rules.kind is '规则类型';
comment on column public.user_rules.rules_json is '规则 JSON 数组，每项含 source/target（DDL）或 s/t（Body）';

alter table public.user_rules enable row level security;

-- 系统规则（user_id is null）和自己的规则，登录用户可读
create policy "user_rules_select" on public.user_rules
  for select to authenticated
  using (user_id is null or auth.uid() = user_id);

-- 只能写自己的规则
create policy "user_rules_insert" on public.user_rules
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "user_rules_update" on public.user_rules
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_rules_delete" on public.user_rules
  for delete to authenticated
  using (auth.uid() = user_id);

create trigger user_rules_set_updated_at
  before update on public.user_rules
  for each row execute function public.set_updated_at();
