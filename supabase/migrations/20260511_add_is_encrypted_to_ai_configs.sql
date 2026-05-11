-- [2026-05-11] ai_configs.api_key 加密存储
-- 新增 is_encrypted 列标记是否已加密，默认 false（兼容现有明文数据）
ALTER TABLE public.ai_configs ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ai_configs.is_encrypted IS 'API Key 是否已加密存储（AES-256-GCM）';
