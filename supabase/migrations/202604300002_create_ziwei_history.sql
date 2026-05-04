-- 202604300002_create_ziwei_history.sql
-- 紫微斗数排盘历史记录，登录用户可查看自己最近 30 条

create table if not exists public.ziwei_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  input_json  jsonb not null,
  result_json jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.ziwei_history is '紫微斗数排盘历史记录，登录用户可查看自己最近 30 条';
comment on column public.ziwei_history.input_json is '排盘输入参数（出生日期、时辰、性别、流派等）';
comment on column public.ziwei_history.result_json is '排盘结果快照（命盘数据、星曜分布等），可为空表示仅保存输入';

alter table public.ziwei_history enable row level security;

create policy "ziwei_history_select_own" on public.ziwei_history
  for select to authenticated using (auth.uid() = user_id);
create policy "ziwei_history_insert_own" on public.ziwei_history
  for insert to authenticated with check (auth.uid() = user_id);
create policy "ziwei_history_delete_own" on public.ziwei_history
  for delete to authenticated using (auth.uid() = user_id);

create index idx_ziwei_history_user_time
  on public.ziwei_history (user_id, created_at desc);