-- 20260512_add_ai_perf_indexes.sql
-- AI 配置查询性能优化：为 ai_providers / ai_configs 添加覆盖索引

-- 供应商列表查询：WHERE is_enabled = true ORDER BY sort_order
CREATE INDEX IF NOT EXISTS idx_ai_providers_enabled_sort
  ON public.ai_providers (is_enabled, sort_order)
  WHERE is_enabled = TRUE;

COMMENT ON INDEX idx_ai_providers_enabled_sort IS '非管理员供应商列表查询覆盖索引';

-- 配置列表查询：ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_ai_configs_created_at
  ON public.ai_configs (created_at DESC);

COMMENT ON INDEX idx_ai_configs_created_at IS 'AI 配置按创建时间倒序查询索引';
