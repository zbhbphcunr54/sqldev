-- [2026-05-03] 新建：AI 供应商定义表
CREATE TABLE public.ai_providers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  label         TEXT NOT NULL,
  region        TEXT NOT NULL DEFAULT 'international',
  base_url      TEXT NOT NULL,
  api_format    TEXT NOT NULL DEFAULT 'openai_compat',
  default_model TEXT NOT NULL,
  models        JSONB NOT NULL DEFAULT '[]',
  icon_url      TEXT,
  doc_url       TEXT,
  is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_providers IS 'AI 供应商定义表，存储支持的 AI 服务商（如 OpenAI/Anthropic/硅基流动等）';
COMMENT ON COLUMN public.ai_providers.slug IS '供应商唯一标识，如 openai / anthropic / silicontflow';
COMMENT ON COLUMN public.ai_providers.label IS '供应商展示名称，如 OpenAI / Anthropic / 硅基流动';
COMMENT ON COLUMN public.ai_providers.region IS '服务区域：international（中国大陆以外）/ domestic（国内）';
COMMENT ON COLUMN public.ai_providers.base_url IS 'API 基础地址，OpenAI 兼容格式';
COMMENT ON COLUMN public.ai_providers.api_format IS 'API 格式：openai_compat（OpenAI 兼容）';
COMMENT ON COLUMN public.ai_providers.default_model IS '默认使用模型';
COMMENT ON COLUMN public.ai_providers.models IS '支持模型列表 JSONB，每项含 id/label/max_tokens/price 等';
COMMENT ON COLUMN public.ai_providers.icon_url IS '供应商图标 URL';
COMMENT ON COLUMN public.ai_providers.doc_url IS '供应商文档链接';
COMMENT ON COLUMN public.ai_providers.is_enabled IS '是否启用，禁用后用户不可见';
COMMENT ON COLUMN public.ai_providers.sort_order IS '展示排序，数字越小越靠前';

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

-- 已登录用户可读启用供应商；仅管理员可写（检查 admin_users 表）
CREATE POLICY "ai_providers_authenticated_read_enabled" ON public.ai_providers
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_enabled = TRUE);

-- 检查用户邮箱是否在 admin_users 白名单中
CREATE POLICY "ai_providers_admin_write" ON public.ai_providers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

CREATE INDEX idx_ai_providers_slug ON public.ai_providers (slug);
CREATE INDEX idx_ai_providers_region ON public.ai_providers (region);

-- updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_providers_updated_at
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
