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

COMMENT ON TABLE public.ai_configs IS '全局 AI 配置表，存储各供应商的 API Key（加密），管理员可配置多套';
COMMENT ON COLUMN public.ai_configs.created_by IS '配置创建者用户 ID';
COMMENT ON COLUMN public.ai_configs.provider_id IS '关联 ai_providers.id，指定使用哪个供应商';
COMMENT ON COLUMN public.ai_configs.name IS '配置名称，如「我的 OpenAI」用于管理员识别';
COMMENT ON COLUMN public.ai_configs.base_url IS 'API 地址，覆盖供应商默认值';
COMMENT ON COLUMN public.ai_configs.model IS '使用的模型名称，如 gpt-4o / claude-3-5-sonnet';
COMMENT ON COLUMN public.ai_configs.api_key_enc IS 'API Key（AES-256-GCM 加密存储）';
COMMENT ON COLUMN public.ai_configs.timeout_ms IS '请求超时时间（毫秒），默认 30000';
COMMENT ON COLUMN public.ai_configs.is_active IS '是否激活，全站同一时间只能有一条为 true';
COMMENT ON COLUMN public.ai_configs.last_test_ok IS '最近一次连通性测试是否成功';
COMMENT ON COLUMN public.ai_configs.last_test_ms IS '最近一次测试耗时（毫秒）';
COMMENT ON COLUMN public.ai_configs.last_test_at IS '最近一次测试时间';

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
