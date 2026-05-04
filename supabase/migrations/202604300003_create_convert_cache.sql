-- 202604300003_create_convert_cache.sql
-- SQL 转换结果缓存，由 Edge Function 管理，service_role 读写，前端不可直连

create table if not exists public.convert_cache (
  cache_key   text primary key,
  kind        text not null,
  from_db     text not null,
  to_db       text not null,
  input_hash  text not null,
  rules_ver   text not null,
  output_sql  text not null,
  created_at  timestamptz not null default now(),
  hit_count   int not null default 0
);

comment on table public.convert_cache is 'SQL 转换结果缓存，由 Edge Function 管理，service_role 读写，前端不可直连';
comment on column public.convert_cache.cache_key is '缓存键：kind|from_db|to_db|rules_ver|input_hash 拼接';
comment on column public.convert_cache.input_hash is '输入 SQL 的哈希值（SHA-256），用于去重';
comment on column public.convert_cache.rules_ver is '规则版本号，规则变更时旧缓存自动失效';
comment on column public.convert_cache.hit_count is '缓存命中次数，用于监控和清理低频缓存';

alter table public.convert_cache enable row level security;

-- 无策略 = 前端 anon/authenticated 不可访问，service_role 自动绕过 RLS
-- 仅 Edge Function 通过 service_role 读写

-- 7 天自动清理
create or replace function public.cleanup_convert_cache()
returns void language sql as $$
  delete from public.convert_cache
  where created_at < now() - interval '7 days';
$$;

-- 索引
create index idx_convert_cache_created
  on public.convert_cache (created_at);