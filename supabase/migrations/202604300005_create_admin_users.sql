-- 202604300006_create_admin_users.sql
-- 管理员邮箱白名单，仅 service_role 可写

create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is '管理员邮箱白名单，仅 service_role 可写';

alter table public.admin_users enable row level security;

-- 无策略 = 前端不可访问，service_role 自动绕过