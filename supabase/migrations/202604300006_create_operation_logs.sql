-- 202604300005_create_operation_logs.sql
-- 用户操作日志，记录所有关键操作和 API 调用，供管理员审计和用户自查

create table if not exists public.operation_logs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid references auth.users(id) on delete set null,
  user_email      text,
  client_ip       text,
  operation       text not null,
  api_name        text,
  request_body    jsonb,
  response_body   jsonb,
  response_status int,
  duration_ms     int,
  error_message   text,
  extra           jsonb
);

comment on table public.operation_logs is '用户操作日志，记录所有关键操作和 API 调用，供管理员审计和用户自查';
comment on column public.operation_logs.user_id is '操作用户 ID，未登录时为空';
comment on column public.operation_logs.user_email is '操作用户邮箱快照，便于查询时直接展示（避免 join）';
comment on column public.operation_logs.client_ip is '客户端 IP 地址，从请求头 X-Forwarded-For 或 CF-Connecting-IP 提取';
comment on column public.operation_logs.operation is '操作类型，如 convert_ddl / convert_func / rule_save / feedback_submit / ziwei_ai_analysis 等';
comment on column public.operation_logs.api_name is 'Edge Function 名称，如 convert / rules / feedback / ziwei-analysis';
comment on column public.operation_logs.request_body is '上送报文（脱敏后），敏感字段（token/key/password）已移除';
comment on column public.operation_logs.response_body is '返回报文（脱敏后），大型响应截断至前 2000 字符';
comment on column public.operation_logs.response_status is 'HTTP 响应状态码，200/400/401/500 等';
comment on column public.operation_logs.duration_ms is '请求处理耗时（毫秒），从接收到返回';
comment on column public.operation_logs.error_message is '错误信息，成功时为空';
comment on column public.operation_logs.extra is '扩展字段，存储业务特定上下文（如 fromDb/toDb/kind/cached 等）';

alter table public.operation_logs enable row level security;

-- 管理员可查所有日志（通过 admin_users 表判断）
create policy "operation_logs_select_admin" on public.operation_logs
  for select to authenticated
  using (
    exists (select 1 from public.admin_users where email = auth.email())
  );

-- 用户可查自己的操作日志
create policy "operation_logs_select_own" on public.operation_logs
  for select to authenticated
  using (auth.uid() = user_id);

-- 仅 service_role 可写入（Edge Function 记录日志）
-- 无 insert/update/delete 策略 = 前端不可写，service_role 自动绕过 RLS

-- 索引：按时间、用户、操作类型查询
create index idx_operation_logs_created_at
  on public.operation_logs (created_at desc);
create index idx_operation_logs_user_created
  on public.operation_logs (user_id, created_at desc);
create index idx_operation_logs_operation
  on public.operation_logs (operation, created_at desc);
create index idx_operation_logs_api_name
  on public.operation_logs (api_name, created_at desc);

-- 自动清理：保留 90 天
create or replace function public.cleanup_operation_logs()
returns void language sql as $$
  delete from public.operation_logs
  where created_at < now() - interval '90 days';
$$;