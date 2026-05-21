-- [2026-05-18] 支持 AI 配置按用户独立管理，并保留管理员全局兜底配置

ALTER TABLE public.ai_configs
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.ai_configs
SET scope = 'global',
    owner_user_id = NULL
WHERE scope IS NULL
   OR scope = '';

ALTER TABLE public.ai_configs
  DROP CONSTRAINT IF EXISTS ai_configs_scope_owner_ck;

ALTER TABLE public.ai_configs
  ADD CONSTRAINT ai_configs_scope_owner_ck
  CHECK (
    (scope = 'global' AND owner_user_id IS NULL)
    OR (scope = 'user' AND owner_user_id IS NOT NULL)
  );

COMMENT ON COLUMN public.ai_configs.scope IS '配置作用域：global=管理员全局兜底，user=用户个人配置';
COMMENT ON COLUMN public.ai_configs.owner_user_id IS '当 scope=user 时，表示该配置归属的用户';

DROP POLICY IF EXISTS "ai_configs_admin_all" ON public.ai_configs;
DROP POLICY IF EXISTS "ai_configs_user_select_own" ON public.ai_configs;
DROP POLICY IF EXISTS "ai_configs_user_insert_own" ON public.ai_configs;
DROP POLICY IF EXISTS "ai_configs_user_update_own" ON public.ai_configs;
DROP POLICY IF EXISTS "ai_configs_user_delete_own" ON public.ai_configs;
DROP POLICY IF EXISTS "ai_configs_admin_global_all" ON public.ai_configs;

CREATE POLICY "ai_configs_user_select_own" ON public.ai_configs
  FOR SELECT USING (
    scope = 'user'
    AND owner_user_id = auth.uid()
  );

CREATE POLICY "ai_configs_user_insert_own" ON public.ai_configs
  FOR INSERT WITH CHECK (
    scope = 'user'
    AND owner_user_id = auth.uid()
  );

CREATE POLICY "ai_configs_user_update_own" ON public.ai_configs
  FOR UPDATE USING (
    scope = 'user'
    AND owner_user_id = auth.uid()
  )
  WITH CHECK (
    scope = 'user'
    AND owner_user_id = auth.uid()
  );

CREATE POLICY "ai_configs_user_delete_own" ON public.ai_configs
  FOR DELETE USING (
    scope = 'user'
    AND owner_user_id = auth.uid()
  );

CREATE POLICY "ai_configs_admin_global_all" ON public.ai_configs
  FOR ALL USING (
    scope = 'global'
    AND EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE email = auth.email()
    )
  )
  WITH CHECK (
    scope = 'global'
    AND EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE email = auth.email()
    )
  );

DROP INDEX IF EXISTS public.idx_ai_configs_active;
DROP INDEX IF EXISTS public.uq_ai_configs_provider_model_normalized;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_configs_global_active
  ON public.ai_configs (is_active)
  WHERE scope = 'global' AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_configs_user_active
  ON public.ai_configs (owner_user_id)
  WHERE scope = 'user' AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_configs_global_provider_model_normalized
  ON public.ai_configs (provider_id, lower(btrim(model)))
  WHERE scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_configs_user_provider_model_normalized
  ON public.ai_configs (owner_user_id, provider_id, lower(btrim(model)))
  WHERE scope = 'user';

CREATE INDEX IF NOT EXISTS idx_ai_configs_scope_owner_active
  ON public.ai_configs (scope, owner_user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_ai_configs_scope_provider
  ON public.ai_configs (scope, owner_user_id, provider_id);
