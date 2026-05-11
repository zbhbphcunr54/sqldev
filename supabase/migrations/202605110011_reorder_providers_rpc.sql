-- 202605110011_reorder_providers_rpc.sql
-- 批量重排 provider 排序：用 UNNEST 单条 SQL 代替 N 次 UPDATE

CREATE OR REPLACE FUNCTION reorder_providers(p_orders jsonb)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE ai_providers AS t
  SET sort_order = o.sort_order
  FROM (
    SELECT * FROM jsonb_to_recordset(p_orders) AS x(provider_id uuid, sort_order int)
  ) AS o
  WHERE t.id = o.provider_id;
$$;
