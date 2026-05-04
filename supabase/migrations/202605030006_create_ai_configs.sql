-- [2026-05-03] 新建：全局 AI 配置表（API Key 加密存储）
CREATE TABLE public.ai_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_id   UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL DEFAULT '',
  base_url      TEXT NOT NULL,
  model         TEXT NOT NULL,
  api_key_enc   BYTEA NOT NULL,
  timeout_ms    INT NOT NULL DEFAULT 30000,
  is_active     BOOLEAN NOT NULL DEFAULT FALSE,
  last_test_ok  BOOLEAN,
  last_test_ms  INT,
  last_test_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_configs ENABLE ROW LEVEL SECURITY;

-- 仅管理员可访问原始配置表
CREATE POLICY "ai_configs_admin_all" ON public.ai_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_admin')::boolean = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_admin')::boolean = true
    )
  );

-- 全站最多 20 条配置
CREATE OR REPLACE FUNCTION check_ai_config_limit()
RETURNS TRIGGER AS $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM public.ai_configs;
  IF cnt >= 20 THEN
    RAISE EXCEPTION 'ai_config_limit_exceeded: 全站最多 20 条 AI 配置';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_config_limit
  BEFORE INSERT ON public.ai_configs
  FOR EACH ROW EXECUTE FUNCTION check_ai_config_limit();

-- 确保全站只有一条 is_active = TRUE
CREATE UNIQUE INDEX idx_ai_configs_active
  ON public.ai_configs (is_active) WHERE is_active = TRUE;

CREATE INDEX idx_ai_configs_provider ON public.ai_configs (provider_id);

CREATE TRIGGER trg_ai_configs_updated_at
  BEFORE UPDATE ON public.ai_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
