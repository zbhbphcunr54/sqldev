-- 202605110001_fix_ai_chat_quota_race.sql
-- 原子配额检查+递增，消除 check-then-increment 竞态
-- 同时添加 ai_chat_sessions 的 user_id 索引

-- 改造配额函数：接受 limit 参数，仅在未超限时递增
create or replace function public.increment_ai_chat_quota(
  p_user_id uuid,
  p_date date,
  p_limit int
) returns table(allowed boolean, used_count int, remaining int) language plpgsql as $$
begin
  insert into public.ai_chat_quota (user_id, usage_date, used_count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, usage_date)
  do update set used_count = case
    when ai_chat_quota.used_count < p_limit then ai_chat_quota.used_count + 1
    else ai_chat_quota.used_count
  end
  returning used_count into used_count;

  allowed := used_count <= p_limit;
  remaining := greatest(0, p_limit - used_count);

  return next;
end;
$$;

comment on function public.increment_ai_chat_quota is '原子递增 AI 对话配额计数，仅在未超限时递增，返回是否允许';

-- ai_chat_sessions 查询索引（按 user_id + updated_at 排序）
create index if not exists idx_ai_chat_sessions_user
  on public.ai_chat_sessions (user_id, updated_at desc);
