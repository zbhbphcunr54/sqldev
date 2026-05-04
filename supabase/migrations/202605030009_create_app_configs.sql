-- [2026-05-03] 新建：应用配置表（替代部分 Supabase Secrets）
CREATE TABLE public.app_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL,
  key           TEXT NOT NULL,
  value         TEXT,
  value_type    TEXT NOT NULL DEFAULT 'string',
  description   TEXT,
  is_encrypted  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT app_configs_category_key_unique UNIQUE(category, key)
);

-- 表注释
COMMENT ON TABLE public.app_configs IS '应用配置表，通过 category+key 管理所有可配置参数';
COMMENT ON COLUMN public.app_configs.category IS '配置分类：cors / ziwei / ziwei_qa / ziwei_chart / convert / convert_verify / rate_limit / system';
COMMENT ON COLUMN public.app_configs.key IS '配置键名，语义化命名如 primary_origin / api_key / rate_limit_requests';
COMMENT ON COLUMN public.app_configs.value IS '配置值，字符串格式存储';
COMMENT ON COLUMN public.app_configs.value_type IS '值类型：string / number / boolean / jsonb';
COMMENT ON COLUMN public.app_configs.is_encrypted IS 'true 时 value 存储 AES-256-GCM 加密后的密文（Base64 编码）';
COMMENT ON COLUMN public.app_configs.is_active IS 'false 时配置不生效，用于临时禁用而非删除';

-- RLS 策略
ALTER TABLE public.app_configs ENABLE ROW LEVEL SECURITY;

-- 管理员可读写，普通用户只读非加密配置
CREATE POLICY "app_configs_admin_all" ON public.app_configs
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

CREATE POLICY "app_configs_auth_read" ON public.app_configs
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND is_active = TRUE
    AND is_encrypted = FALSE
  );

-- 索引
CREATE INDEX idx_app_configs_category ON public.app_configs (category);
CREATE INDEX idx_app_configs_key ON public.app_configs (key);
CREATE INDEX idx_app_configs_active ON public.app_configs (is_active) WHERE is_active = TRUE;

-- updated_at 触发器
CREATE TRIGGER trg_app_configs_updated_at
  BEFORE UPDATE ON public.app_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
