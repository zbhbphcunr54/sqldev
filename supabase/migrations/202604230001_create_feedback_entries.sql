create extension if not exists pgcrypto;

-- [2026-05-03] 补充：添加表和列注释
create table if not exists public.feedback_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('feature', 'ux', 'performance', 'bug', 'other')),
  content text not null check (char_length(content) between 6 and 1200),
  contact text,                           -- 联系方式（可选）
  source text,                             -- 来源渠道（web/android/ios）
  scene text,                              -- 使用场景
  page text,                               -- 提交时的页面路径
  theme text,                               -- 用户偏好主题（light/dark/auto）
  user_agent text,                         -- 浏览器 User-Agent
  user_id uuid references auth.users(id) on delete set null,  -- 提交用户 ID，未登录时为空
  client_ip text                            -- 客户端 IP 地址
);

COMMENT ON TABLE public.feedback_entries IS '用户反馈表，支持匿名提交，所有用户可插入，管理员可读';
COMMENT ON COLUMN public.feedback_entries.category IS '反馈类型：feature（功能建议）/ ux（体验优化）/ performance（性能问题）/ bug（缺陷报告）/ other（其他）';
COMMENT ON COLUMN public.feedback_entries.content IS '反馈内容，6-1200 字符';
COMMENT ON COLUMN public.feedback_entries.contact IS '用户联系方式（邮箱或手机），可选，用于后续联系';
COMMENT ON COLUMN public.feedback_entries.source IS '来源渠道，如 web/android/ios';
COMMENT ON COLUMN public.feedback_entries.scene IS '使用场景描述';
COMMENT ON COLUMN public.feedback_entries.page IS '提交反馈时所在的页面路径';
COMMENT ON COLUMN public.feedback_entries.theme IS '用户当前主题设置：light/dark/auto';
COMMENT ON COLUMN public.feedback_entries.user_agent IS '浏览器 User-Agent 字符串';
COMMENT ON COLUMN public.feedback_entries.user_id IS '关联 auth.users.id，未登录用户为空';
COMMENT ON COLUMN public.feedback_entries.client_ip IS '客户端 IP 地址，用于统计分析';

create index if not exists idx_feedback_entries_created_at
  on public.feedback_entries (created_at desc);

create index if not exists idx_feedback_entries_user_id
  on public.feedback_entries (user_id);

create index if not exists idx_feedback_entries_category
  on public.feedback_entries (category);

create index if not exists idx_feedback_entries_source
  on public.feedback_entries (source);

create index if not exists idx_feedback_entries_client_ip
  on public.feedback_entries (client_ip);

create index if not exists idx_feedback_entries_user_id_created_at
  on public.feedback_entries (user_id, created_at desc);

alter table public.feedback_entries enable row level security;

drop policy if exists "feedback_select_none" on public.feedback_entries;
create policy "feedback_select_none"
on public.feedback_entries
for select
to anon, authenticated
using (false);

drop policy if exists "feedback_insert_none" on public.feedback_entries;
create policy "feedback_insert_none"
on public.feedback_entries
for insert
to anon, authenticated
with check (false);

drop policy if exists "feedback_update_none" on public.feedback_entries;
create policy "feedback_update_none"
on public.feedback_entries
for update
to anon, authenticated
using (false)
with check (false);

drop policy if exists "feedback_delete_none" on public.feedback_entries;
create policy "feedback_delete_none"
on public.feedback_entries
for delete
to anon, authenticated
using (false);
