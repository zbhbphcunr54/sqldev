-- [2026-05-18] 清理 ai_configs 重复数据，并约束同一供应商下模型唯一

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY provider_id, lower(btrim(model))
      ORDER BY
        is_active DESC,
        last_test_at DESC NULLS LAST,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.ai_configs
),
duplicates AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
)
DELETE FROM public.ai_configs
WHERE id IN (SELECT id FROM duplicates);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_configs_provider_model_normalized
  ON public.ai_configs (provider_id, lower(btrim(model)));
