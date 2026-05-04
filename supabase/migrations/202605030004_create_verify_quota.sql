-- 202605030004_create_verify_quota.sql
-- AI 校验每日配额表

create table if not exists public.verify_quota (
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('ddl', 'func', 'proc')),
  usage_date  date not null default (now() at time zone 'Asia/Shanghai')::date,
  used_count  int not null default 0,
  primary key (user_id, kind, usage_date)
);

comment on table public.verify_quota is 'AI 校验每日配额，每用户每类型每天 10 次';
comment on column public.verify_quota.user_id is '用户 ID';
comment on column public.verify_quota.kind is '校验类型：ddl / func / proc（与 convert_verify_results.kind 一致）';
comment on column public.verify_quota.used_count is '已使用次数，缓存命中不计数';
comment on column public.verify_quota.usage_date is '使用日期（UTC+8 自然日）';

alter table public.verify_quota enable row level security;

create policy "verify_quota_select_own" on public.verify_quota
  for select to authenticated using (auth.uid() = user_id);

-- 仅 service_role 可写入
-- 无 insert/update/delete 策略 = 前端不可写

create index idx_verify_quota_date
  on public.verify_quota (usage_date);

-- 配额递增函数（原子操作）
create or replace function public.increment_verify_quota(
  p_user_id uuid,
  p_kind text,
  p_date date
) returns void language plpgsql as $$
begin
  insert into public.verify_quota (user_id, kind, usage_date, used_count)
  values (p_user_id, p_kind, p_date, 1)
  on conflict (user_id, kind, usage_date)
  do update set used_count = verify_quota.used_count + 1;
end;
$$;

comment on function public.increment_verify_quota is '原子递增校验配额计数';
