-- 202604300004_create_ziwei_ai_cache.sql
-- 紫微 AI 解盘结果缓存，由 Edge Function 管理，service_role 读写，前端不可直连

create table if not exists public.ziwei_ai_cache (
  signature   text primary key,
  result_json jsonb not null,
  created_at  timestamptz not null default now(),
  hit_count   int not null default 0
);

comment on table public.ziwei_ai_cache is '紫微 AI 解盘结果缓存，由 Edge Function 管理，service_role 读写，前端不可直连';
comment on column public.ziwei_ai_cache.signature is '命盘签名（基于星曜分布、四化、大限等关键数据生成的唯一哈希）';
comment on column public.ziwei_ai_cache.result_json is 'AI 解盘结果 JSON（含 overview、sections、yearFocus 等结构）';
comment on column public.ziwei_ai_cache.hit_count is '缓存命中次数，用于监控和清理低频缓存';

alter table public.ziwei_ai_cache enable row level security;

-- 无策略 = 前端 anon/authenticated 不可访问，service_role 自动绕过 RLS
-- 仅 Edge Function 通过 service_role 读写

create index idx_ziwei_ai_cache_created
  on public.ziwei_ai_cache (created_at);