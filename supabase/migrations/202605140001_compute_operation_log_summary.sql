-- 202605140001_compute_operation_log_summary.sql
-- 操作日志统计聚合函数（DB 端计算，支持权限与筛选）

CREATE OR REPLACE FUNCTION public.compute_operation_log_summary(
  p_is_admin boolean,
  p_user_id uuid,
  p_search_user_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL, -- 'success' | 'fail' | NULL
  p_operation text DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_requests bigint,
  success_rate numeric(5,1),
  fail_count bigint,
  avg_duration_ms numeric,
  p95_duration_ms numeric,
  active_users bigint
)
LANGUAGE sql
STABLE
ROWS 1
AS $$
  WITH filtered AS (
    SELECT
      response_status,
      duration_ms,
      user_email
    FROM public.operation_logs
    WHERE
      (
        (p_is_admin AND (p_search_user_id IS NULL OR user_id = p_search_user_id))
        OR
        (NOT p_is_admin AND user_id = p_user_id)
      )
      AND (
        p_status IS NULL
        OR (
          p_status = 'success'
          AND response_status >= 200
          AND response_status < 400
        )
        OR (
          p_status = 'fail'
          AND (
            response_status IS NULL
            OR response_status < 200
            OR response_status >= 400
          )
        )
      )
      AND (p_operation IS NULL OR operation = p_operation)
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
  )
  SELECT
    COUNT(*)::bigint AS total_requests,
    CASE
      WHEN COUNT(*) > 0 THEN ROUND(
        COUNT(*) FILTER (WHERE response_status >= 200 AND response_status < 400)::numeric
        / COUNT(*)::numeric
        * 100,
        1
      )
      ELSE 0::numeric
    END AS success_rate,
    COUNT(*) FILTER (
      WHERE response_status IS NULL
        OR response_status < 200
        OR response_status >= 400
    )::bigint AS fail_count,
    COALESCE(ROUND(AVG(duration_ms)::numeric, 0), 0::numeric) AS avg_duration_ms,
    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 0::numeric) AS p95_duration_ms,
    COUNT(DISTINCT user_email) FILTER (WHERE user_email IS NOT NULL)::bigint AS active_users
  FROM filtered;
$$;

GRANT EXECUTE ON FUNCTION public.compute_operation_log_summary TO service_role;

COMMENT ON FUNCTION public.compute_operation_log_summary IS
  '操作日志聚合统计（DB 端计算），按权限+状态+操作+日期范围过滤';
