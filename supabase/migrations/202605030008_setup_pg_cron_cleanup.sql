-- [2026-05-03] 使用 Supabase pg_cron 替代 GitHub Actions 进行定时清理
-- pg_cron 是 Supabase 免费提供的定时任务功能

-- 启用 pg_cron 扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 授予必要权限
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL ON SCHEMA cron TO postgres;

-- 创建定时清理任务（每天 UTC 03:00，即北京时间 11:00）
-- 直接调用清理函数，比通过 Edge Function 更高效
SELECT cron.schedule(
  'cleanup-stale-data',
  '0 3 * * *',
  $$
  SELECT
    cleanup_convert_cache(),
    cleanup_operation_logs(),
    cleanup_convert_verify_results();
  $$
);

-- 验证定时任务是否创建成功
-- SELECT cron.jobid, jobname, schedule, command FROM cron.job;
