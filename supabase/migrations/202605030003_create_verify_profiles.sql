-- 202605030003_create_verify_profiles.sql
-- AI 校验环境配置表

-- set_updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.verify_profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  profile_name          text not null default 'default',
  ai_identity           text not null,
  target_db_version     text not null,
  source_db_version     text,
  business_context      text,
  special_requirements  text,
  is_default            boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(user_id, profile_name)
);

comment on table public.verify_profiles is 'AI 校验环境配置，每个用户可保存多套配置（如不同项目）';
comment on column public.verify_profiles.user_id is '所属用户 ID';
comment on column public.verify_profiles.ai_identity is 'AI 身份设定，如「资深 Oracle→MySQL 迁移专家，10年经验」';
comment on column public.verify_profiles.target_db_version is '目标数据库版本，如 MySQL 8.0 / PostgreSQL 16';
comment on column public.verify_profiles.source_db_version is '源数据库版本，如 Oracle 19c，用于判断兼容性边界';
comment on column public.verify_profiles.business_context is '业务场景描述，帮助 AI 判断性能/数据量/并发等风险';
comment on column public.verify_profiles.special_requirements is '用户自定义校验关注点';
comment on column public.verify_profiles.is_default is '是否为默认配置，每用户仅一个默认（部分唯一索引强制）';

alter table public.verify_profiles enable row level security;

create policy "verify_profiles_select_own" on public.verify_profiles
  for select to authenticated using (auth.uid() = user_id);
create policy "verify_profiles_insert_own" on public.verify_profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "verify_profiles_update_own" on public.verify_profiles
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "verify_profiles_delete_own" on public.verify_profiles
  for delete to authenticated using (auth.uid() = user_id);

-- set_updated_at trigger (复用 existing pattern)
create trigger verify_profiles_set_updated_at
  before update on public.verify_profiles
  for each row execute function public.set_updated_at();

-- 每用户只能有一个默认配置
create unique index idx_verify_profiles_one_default
  on public.verify_profiles (user_id)
  where is_default = true;
