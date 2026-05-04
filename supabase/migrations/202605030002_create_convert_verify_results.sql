-- 202605030002_create_convert_verify_results.sql
-- AI 转换校验结果缓存表

create table if not exists public.convert_verify_results (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid references auth.users(id) on delete set null,
  kind            text not null check (kind in ('ddl', 'func', 'proc')),
  from_db         text not null,
  to_db           text not null,
  input_sql       text not null,
  output_sql      text not null,
  input_hash      text not null,
  output_hash     text not null,
  ai_model        text not null,
  overall_score   int check (overall_score between 0 and 100),
  syntax_issues   jsonb not null default '[]',
  semantic_issues jsonb not null default '[]',
  logic_risks     jsonb not null default '[]',
  suggestions     jsonb not null default '[]',
  summary         text,
  raw_response    jsonb,
  duration_ms     int,
  error_message   text
);

comment on table public.convert_verify_results is 'AI 转换校验结果，记录语法/语义/业务逻辑校验报告';
comment on column public.convert_verify_results.overall_score is '综合评分 0-100，100=完全无问题';
comment on column public.convert_verify_results.syntax_issues is '语法问题清单，JSON 数组，每项含 line/severity/message/fix';
comment on column public.convert_verify_results.semantic_issues is '语义问题清单，JSON 数组，每项含 severity/message/original/converted';
comment on column public.convert_verify_results.logic_risks is '业务逻辑风险清单，JSON 数组，每项含 category/severity/message/impact';
comment on column public.convert_verify_results.suggestions is '修改建议清单，JSON 数组，每项含 priority/target_sql/explanation';
comment on column public.convert_verify_results.summary is 'AI 生成的总体评价文本';
comment on column public.convert_verify_results.input_hash is '原始 SQL 的 SHA-256 哈希';
comment on column public.convert_verify_results.output_hash is '转换后 SQL 的 SHA-256 哈希';
comment on column public.convert_verify_results.ai_model is '使用的 AI 模型名称';

alter table public.convert_verify_results enable row level security;

-- 用户可查自己的校验结果
create policy "verify_results_select_own" on public.convert_verify_results
  for select to authenticated using (auth.uid() = user_id);

-- 管理员可查所有（依赖 admin_users 表）
create policy "verify_results_select_admin" on public.convert_verify_results
  for select to authenticated
  using (exists (select 1 from public.admin_users where email = auth.email()));

-- 仅 service_role 可写入
-- 无 insert/update/delete 策略 = 前端不可写

-- 索引
create index idx_verify_results_user_created
  on public.convert_verify_results (user_id, created_at desc);
create index idx_verify_results_hashes
  on public.convert_verify_results (input_hash, output_hash);

-- 自动清理：保留 30 天
create or replace function public.cleanup_convert_verify_results()
returns void language sql as $$
  delete from public.convert_verify_results
  where created_at < now() - interval '30 days';
$$;
