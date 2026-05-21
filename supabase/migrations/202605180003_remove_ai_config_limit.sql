-- [2026-05-18] 移除 AI 配置数量上限

DROP TRIGGER IF EXISTS trg_ai_config_limit ON public.ai_configs;
DROP FUNCTION IF EXISTS public.check_ai_config_limit();

UPDATE app_configs
SET
  is_active = false,
  description = CASE
    WHEN coalesce(description, '') LIKE '%已停用%' THEN description
    ELSE coalesce(description, '') || '（已停用：AI 配置数量不再限制）'
  END,
  updated_at = now()
WHERE category = 'ai_config'
  AND key = 'max_configs_global'
  AND is_active = true;
