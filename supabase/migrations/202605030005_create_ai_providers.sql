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

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

-- 已登录用户可读启用供应商；仅管理员可写
CREATE POLICY "ai_providers_authenticated_read_enabled" ON public.ai_providers
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_enabled = TRUE);

CREATE POLICY "ai_providers_admin_write" ON public.ai_providers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_admin')::boolean = true
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
