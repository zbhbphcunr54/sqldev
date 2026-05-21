-- 202605140002_operation_logs_perf_indexes.sql
-- 操作日志查询性能索引优化（按实际筛选维度）

create index if not exists idx_operation_logs_user_operation_created
  on public.operation_logs (user_id, operation, created_at desc);

create index if not exists idx_operation_logs_status_created
  on public.operation_logs (response_status, created_at desc);

create index if not exists idx_operation_logs_success_created
  on public.operation_logs (created_at desc)
  where response_status >= 200 and response_status < 400;

create index if not exists idx_operation_logs_fail_created
  on public.operation_logs (created_at desc)
  where response_status is null or response_status < 200 or response_status >= 400;
