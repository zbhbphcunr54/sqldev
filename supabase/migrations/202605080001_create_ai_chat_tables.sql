-- 202605080001_create_ai_chat_tables.sql
-- AI 对话功能：会话、消息、每日配额

create table if not exists public.ai_chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text,
  provider_slug text,
  model         text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.ai_chat_sessions is 'AI 对话会话表';
comment on column public.ai_chat_sessions.user_id is '用户 ID';
comment on column public.ai_chat_sessions.title is '会话标题，由首条用户消息生成';
comment on column public.ai_chat_sessions.provider_slug is 'AI 供应商标识（如 openai / deepseek）';
comment on column public.ai_chat_sessions.model is '使用的模型名称';

create table if not exists public.ai_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_chat_sessions(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

comment on table public.ai_chat_messages is 'AI 对话消息表';
comment on column public.ai_chat_messages.session_id is '所属会话 ID';
comment on column public.ai_chat_messages.role is '消息角色：user 或 assistant';
comment on column public.ai_chat_messages.content is '消息内容';

create index idx_ai_chat_messages_session
  on public.ai_chat_messages (session_id, created_at);

create table if not exists public.ai_chat_quota (
  user_id    uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'Asia/Shanghai')::date,
  used_count int not null default 0,
  primary key (user_id, usage_date)
);

comment on table public.ai_chat_quota is 'AI 对话每日配额，每用户每天限制次数';
comment on column public.ai_chat_quota.user_id is '用户 ID';
comment on column public.ai_chat_quota.used_count is '已使用次数';
comment on column public.ai_chat_quota.usage_date is '使用日期（UTC+8 自然日）';

-- 配额原子递增函数
create or replace function public.increment_ai_chat_quota(
  p_user_id uuid,
  p_date date
) returns void language plpgsql as $$
begin
  insert into public.ai_chat_quota (user_id, usage_date, used_count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, usage_date)
  do update set used_count = ai_chat_quota.used_count + 1;
end;
$$;

comment on function public.increment_ai_chat_quota is '原子递增 AI 对话配额计数';

-- RLS：会话表
alter table public.ai_chat_sessions enable row level security;

create policy "ai_chat_sessions_select_own" on public.ai_chat_sessions
  for select to authenticated using (auth.uid() = user_id);

create policy "ai_chat_sessions_insert_own" on public.ai_chat_sessions
  for insert to authenticated with check (auth.uid() = user_id);

create policy "ai_chat_sessions_update_own" on public.ai_chat_sessions
  for update to authenticated using (auth.uid() = user_id);

create policy "ai_chat_sessions_delete_own" on public.ai_chat_sessions
  for delete to authenticated using (auth.uid() = user_id);

-- RLS：消息表
alter table public.ai_chat_messages enable row level security;

create policy "ai_chat_messages_select_own" on public.ai_chat_messages
  for select to authenticated using (
    exists (select 1 from public.ai_chat_sessions s
            where s.id = ai_chat_messages.session_id and s.user_id = auth.uid())
  );

create policy "ai_chat_messages_insert_own" on public.ai_chat_messages
  for insert to authenticated with check (
    exists (select 1 from public.ai_chat_sessions s
            where s.id = ai_chat_messages.session_id and s.user_id = auth.uid())
  );

-- RLS：配额表（仅查询，写入通过 RPC 函数由 service_role 完成）
alter table public.ai_chat_quota enable row level security;

create policy "ai_chat_quota_select_own" on public.ai_chat_quota
  for select to authenticated using (auth.uid() = user_id);

-- 会话更新时自动更新 updated_at
create or replace function public.update_ai_chat_session_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_ai_chat_sessions_updated_at
  before update on public.ai_chat_sessions
  for each row execute function public.update_ai_chat_session_timestamp();
