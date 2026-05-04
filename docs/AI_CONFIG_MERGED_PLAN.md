# SQLDev AI 助手配置模块 — 融合设计方案

> 综合 Proposal A（Mimo 双表方案）与 Proposal B（MuleRun 单表+加密方案）的最佳实践，形成统一的 Vue 3 + Supabase 实施蓝图。

---

## 目录

1. [设计目标与原则](#1-设计目标与原则)
2. [数据模型](#2-数据模型)
3. [AI 供应商种子数据](#3-ai-供应商种子数据)
4. [安全体系](#4-安全体系)
5. [Edge Functions 设计](#5-edge-functions-设计)
6. [前端架构（Vue 3 Composition API）](#6-前端架构vue-3-composition-api)
7. [UI 设计](#7-ui-设计)
8. [与 ziwei-analysis 集成](#8-与-ziwei-analysis-集成)
9. [实施步骤](#9-实施步骤)
10. [附录：类型定义汇总](#10-附录类型定义汇总)

---

## 1. 设计目标与原则

| # | 目标 | 说明 |
|---|------|------|
| G1 | **数据库驱动供应商列表** | 供应商（Provider）信息存储在 `ai_providers` 表，前端不硬编码，管理员可随时增删改。 |
| G2 | **管理员统一维护 AI 配置** | AI 配置（`ai_configs`）由管理员集中维护；普通登录用户只能进入配置界面查看脱敏后的供应商、模型、状态，不能新增、编辑、删除、激活或测试。 |
| G3 | **API Key 服务端加密** | 管理员录入的 API Key 以 AES-256-GCM 加密存储（`api_key_enc`）；前端永远只收到脱敏值 `sk-****xxxx`，普通用户不接触明文或密文。 |
| G4 | **统一代理网关** | 所有 AI 调用经 Edge Function `ai-proxy` 统一转发，避免前端暴露密钥。 |
| G5 | **优雅降级** | 当管理员未配置全局激活 AI 配置时，ziwei-analysis 等功能自动回退到环境变量默认配置。 |
| G6 | **Vue 3 最佳实践** | 采用 Composition API + Feature-Sliced 目录结构，barrel exports，composables 复用。 |
| G7 | **全局配置上限** | 全站最多保留 20 条 AI 配置，防止配置膨胀与误用。 |

### 设计原则

- **最小权限**：RLS + Bearer Token 双重校验；Edge Function 内解密密钥，绝不透传前端。
- **关注点分离**：供应商元数据与全局 AI 配置分离为两张表，均由管理员维护；普通用户仅查看脱敏后的运行状态。
- **可扩展**：新增供应商只需 INSERT 一行，无需改代码。
- **可测试**：配置页内置连通性测试；测试、保存、激活等写操作仅管理员可见且可用。

## 2. 数据模型

### 2.1 `ai_providers` — 供应商定义表（管理员维护，普通用户可读启用项）

```sql
-- [2026-04-29] 新建：AI 供应商定义表（管理员维护，所有已登录用户可读）
CREATE TABLE public.ai_providers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,          -- 'deepseek', 'openai', 'claude' ...
  label         TEXT NOT NULL,                 -- 显示名称
  region        TEXT NOT NULL DEFAULT 'international',  -- 'cn' | 'international'
  base_url      TEXT NOT NULL,                 -- 默认 API 地址
  api_format    TEXT NOT NULL DEFAULT 'openai_compat', -- 'openai_compat' | 'anthropic' | 'custom'
  default_model TEXT NOT NULL,                 -- 推荐默认模型
  models        JSONB NOT NULL DEFAULT '[]',   -- 可选模型列表 ["gpt-4o","gpt-4o-mini"]
  icon_url      TEXT,                          -- 图标 URL
  doc_url       TEXT,                          -- 官方文档链接
  is_enabled    BOOLEAN NOT NULL DEFAULT TRUE, -- 管理员可临时下架
  sort_order    INT NOT NULL DEFAULT 0,        -- 排序权重
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_providers IS 'AI 供应商定义表，管理员通过 Supabase Dashboard 维护，已登录用户可读';
COMMENT ON COLUMN public.ai_providers.slug IS '供应商唯一标识，如 deepseek / openai / claude，用于前端路由和日志';
COMMENT ON COLUMN public.ai_providers.region IS '供应商区域：cn（国内）/ international（国际），用于前端筛选 Tab';
COMMENT ON COLUMN public.ai_providers.base_url IS '供应商默认 API 地址，管理员可在 ai_configs 中覆盖';
COMMENT ON COLUMN public.ai_providers.api_format IS 'API 调用格式：openai_compat（默认）/ anthropic / custom，ai-proxy 内部据此分发适配器';
COMMENT ON COLUMN public.ai_providers.models IS '可选模型列表，JSON 数组字符串，如 ["gpt-4o","gpt-4o-mini"]，前端下拉读取';
COMMENT ON COLUMN public.ai_providers.is_enabled IS '管理员开关，false 时前端不展示该供应商';
COMMENT ON COLUMN public.ai_providers.sort_order IS '排序权重，数值越小越靠前';

-- 已登录用户可读启用供应商；仅管理员可写（通过 raw_app_meta_data.is_admin 字段判断）
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
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
```

> **管理员设置**：通过 Supabase Dashboard 的 Authentication → Users 页面，编辑用户，在 `raw_app_meta_data` 中添加 `{"is_admin": true}`。或执行 SQL：
>
> ```sql
> UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
> WHERE email = 'admin@example.com';
> ```

### 2.2 `ai_configs` — 全局 AI 配置表（管理员维护，普通用户只读脱敏视图）

```sql
-- [2026-04-29] 新建：全局 AI 配置表（管理员维护，普通用户仅通过 Edge Function 读取脱敏结果）
CREATE TABLE public.ai_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_id   UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL DEFAULT '',       -- 管理员自定义标签，如 "生产 DeepSeek"
  base_url      TEXT NOT NULL,                  -- 管理员可覆盖供应商默认地址
  model         TEXT NOT NULL,                  -- 管理员选择的模型
  api_key_enc   BYTEA NOT NULL,                 -- AES-256-GCM 加密后的 API Key
  timeout_ms    INT NOT NULL DEFAULT 30000,     -- 单次请求超时（毫秒）
  is_active     BOOLEAN NOT NULL DEFAULT FALSE, -- 当前全局激活配置（全站仅一条为 TRUE）
  last_test_ok  BOOLEAN,                        -- 最近一次测试是否成功
  last_test_ms  INT,                            -- 最近一次测试耗时（毫秒）
  last_test_at  TIMESTAMPTZ,                    -- 最近一次测试时间
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_configs IS '全局 AI 供应商配置表，管理员维护，API Key 以 AES-256-GCM 加密存储';
COMMENT ON COLUMN public.ai_configs.provider_id IS '关联 ai_providers.id，ON DELETE RESTRICT 防止删除有配置的供应商';
COMMENT ON COLUMN public.ai_configs.name IS '管理员自定义配置名称，如"生产 DeepSeek"，便于区分多条配置';
COMMENT ON COLUMN public.ai_configs.api_key_enc IS 'AES-256-GCM 加密后的 API Key，二进制存储，前端永不接触明文';
COMMENT ON COLUMN public.ai_configs.is_active IS '当前全局激活配置标志，通过唯一索引保证全站仅一条为 TRUE';
COMMENT ON COLUMN public.ai_configs.last_test_ok IS '最近一次连通性测试结果：true=成功，false=失败，null=未测试';

-- RLS：原始配置表仅管理员可访问；普通用户不得直接 SELECT，避免接触 api_key_enc 密文。
ALTER TABLE public.ai_configs ENABLE ROW LEVEL SECURITY;
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

-- 全站最多 20 条配置（应用层 + DB 触发器双重保障）
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

-- updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_providers_updated_at BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ai_configs_updated_at BEFORE UPDATE ON public.ai_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

> 普通用户查看配置界面时，不直接查询 `ai_configs` 表；统一调用 `GET /ai-config`，由 Edge Function 返回不含 `api_key_enc` 的脱敏展示字段。

### 2.3 ER 关系

```
┌──────────────┐        ┌──────────────┐
│ ai_providers │ 1───N  │  ai_configs  │
│  (管理员维护)  │◄───────│  (管理员维护)  │
│              │        │              │
│ slug         │        │ created_by   │
│ label        │        │ provider_id  │
│ base_url     │        │ api_key_enc  │
│ models[]     │        │ is_active    │
│ ...          │        │ ...          │
└──────────────┘        └──────────────┘
```

## 3. AI 供应商种子数据

以下为 `ai_providers` 初始 INSERT，涵盖国内外主流供应商：

```sql
INSERT INTO public.ai_providers (slug, label, region, base_url, default_model, models, sort_order) VALUES
-- === 国际 ===
('openai',        'OpenAI',           'international', 'https://api.openai.com/v1',               'gpt-4o',               '["gpt-4o","gpt-4o-mini","gpt-4-turbo","o1-preview","o1-mini"]',       10),
('claude',        'Anthropic Claude', 'international', 'https://api.anthropic.com/v1',             'claude-sonnet-4-20250514',       '["claude-sonnet-4-20250514","claude-3-5-haiku-20241022","claude-3-opus-20240229"]', 20),
('mistral',       'Mistral AI',       'international', 'https://api.mistral.ai/v1',               'mistral-large-latest', '["mistral-large-latest","mistral-medium-latest","mistral-small-latest","codestral-latest"]', 30),
('openrouter',    'OpenRouter',       'international', 'https://openrouter.ai/api/v1',            'meta-llama/llama-3.3-70b-instruct',        '["openai/gpt-4o","anthropic/claude-3.5-sonnet","meta-llama/llama-3.3-70b-instruct"]', 40),
('gemini',        'Google Gemini',    'international', 'https://generativelanguage.googleapis.com/v1beta', 'gemini-2.0-flash', '["gemini-2.0-flash","gemini-2.0-flash-lite","gemini-1.5-flash"]', 45),
('github-models', 'GitHub Models',    'international', 'https://models.inference.ai.azure.com',   'gpt-4o',               '["gpt-4o","gpt-4o-mini","Phi-3.5-MoE-instruct"]',                    50),
('cloudflare',    'Cloudflare AI',    'international', 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1', '@cf/meta/llama-3.1-8b-instruct', '["@cf/meta/llama-3.1-8b-instruct","@cf/mistral/mistral-7b-instruct-v0.2"]', 60),
('groq',          'Groq',             'international', 'https://api.groq.com/openai/v1',          'llama-3.3-70b-versatile', '["llama-3.3-70b-versatile","llama-3.1-8b-instant","llama-4-scout-17b-16e-instruct","qwen3-32b"]', 70),

-- === 国内 ===
('deepseek',      'DeepSeek',         'cn',            'https://api.deepseek.com/v1',             'deepseek-chat',        '["deepseek-chat","deepseek-v3","deepseek-reasoner"]',                 100),
('qwen',          'Qwen (通义千问)',    'cn',            'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen-max', '["qwen-max","qwen-plus","qwen-turbo","qwen-long"]',                  110),
('glm',           'ChatGLM (智谱)',    'cn',            'https://open.bigmodel.cn/api/paas/v4',   'glm-4-flash',          '["glm-4-flash","glm-4.7-flash","glm-4.5-air","glm-4"]',              120),
('doubao',        'Doubao (豆包)',     'cn',            'https://ark.cn-beijing.volces.com/api/v3','doubao-pro-32k',       '["doubao-pro-32k","doubao-lite-32k"]',                                130),
('ernie',         'ERNIE Bot (文心一言)','cn',           'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop', 'ernie-4.0-8k', '["ernie-4.0-8k","ernie-3.5-8k","ernie-speed-8k"]', 140),
('spark',         'Spark (讯飞星火)',   'cn',            'https://spark-api-open.xf-yun.com/v1',   'spark-lite',           '["spark-lite","generalv3.5","generalv3","generalv2"]',                150),
('hunyuan',       'Hunyuan (混元)',    'cn',            'https://hunyuan.tencentcloudapi.com',     'hunyuan-lite',         '["hunyuan-lite","hunyuan-t1","hunyuan-turbos","hunyuan-pro"]',        160),
('moonshot',      'Moonshot (月之暗面)','cn',            'https://api.moonshot.cn/v1',              'moonshot-v1-128k',     '["moonshot-v1-128k","moonshot-v1-32k","moonshot-v1-8k"]',             170),
('minimax',       'MiniMax',          'cn',            'https://api.minimax.chat/v1',             'abab6.5s-chat',        '["abab6.5s-chat","abab6.5-chat","abab5.5-chat"]',                     180),
('siliconflow',   'SiliconFlow',      'cn',            'https://api.siliconflow.cn/v1',           'deepseek-ai/DeepSeek-V3', '["deepseek-ai/DeepSeek-V3","Qwen/Qwen2.5-72B-Instruct"]',    190);

-- 非 OpenAI 兼容供应商的 API 格式标记
UPDATE public.ai_providers SET api_format = 'anthropic' WHERE slug = 'claude';
UPDATE public.ai_providers SET api_format = 'custom' WHERE slug IN ('ernie', 'hunyuan', 'spark');
```

> **说明**：`models` 为 JSONB 数组，前端下拉选择时直接读取，无需额外维护。管理员可通过 Supabase Studio 或后台面板随时更新。

### 3.1 供应商免费 API 可用性（截至 2026 年 4 月）

| 供应商 | 免费 API? | 详情 | 建议 |
|--------|-----------|------|------|
| **OpenAI** | 无永久免费 | 新用户仅有限试用额度（$5-18），用完即止 | 保留但标注"付费" |
| **Anthropic Claude** | 无永久免费 | 纯付费，无免费 API 层 | 保留但标注"付费" |
| **Mistral AI** | 有限免费实验层 | 免费层可用于实验，额度有限 | 保留，标注"有限免费" |
| **OpenRouter** | **有，30+ 免费模型** | Llama 3.3 70B、Qwen3、GPT-OSS 等；20 RPM | 强烈推荐保留 |
| **Google Gemini** | **有，但 2026.6.1 后缩减** | Gemini 2.0 Flash 目前免费（15 RPM, 1500 RPD） | 保留，建议尽快利用 |
| **GitHub Models** | **有** | GPT-4o/mini 等可用，有速率限制 | 保留，适合原型 |
| **Cloudflare AI** | **有** | 10,000 Neurons/天免费 | 保留 |
| **Groq** | **有，无需信用卡** | Llama 3.3-70b、Llama 4 Scout、Qwen3-32B | 强烈推荐保留 |
| **DeepSeek** | 有限（新用户 5M tokens） | 用完后极低价，非永久免费 | 保留，标注"新用户赠送" |
| **Qwen（通义千问）** | 新用户 1M tokens/模型 | 3 个月有效期 | 保留，标注"限时" |
| **ChatGLM（智谱）** | **有，GLM-4-Flash 永久免费** | 无限额度；另有 7 个免费模型 | 强烈推荐，种子数据 `default_model` 已改为 `glm-4-flash` |
| **Doubao（豆包）** | **有，每天 2M tokens** | 通过火山引擎每日重置 | 保留 |
| **ERNIE（文心一言）** | 新用户 1M tokens/模型 | ernie-speed 系列曾永久免费 | 保留 |
| **Spark（讯飞星火）** | **有，Spark Lite 永久免费** | 无限额度 | 种子数据 `default_model` 已改为 `spark-lite` |
| **Hunyuan（混元）** | **有，Hunyuan-Lite 永久免费** | 无限额度 + 100M 旗舰模型 tokens | 种子数据 `default_model` 已改为 `hunyuan-lite` |
| **Moonshot（Kimi）** | 仅新用户 15 元券 | 无永久免费层 | 保留但标注"付费" |
| **MiniMax** | 无永久免费 | 付费 $10/月起，可通过 OpenRouter 免费用 | 考虑降低优先级 |
| **SiliconFlow** | **有，新用户 20M tokens** | 永不过期；另有部分小模型永久免费 | 保留 |

### 3.2 永久免费推荐（适合默认配置）

如果目标是让用户零成本体验 AI 功能，推荐以下组合：

| 优先级 | 供应商 | 免费模型 | 优势 |
|--------|--------|---------|------|
| 1 | **Groq** | llama-3.3-70b | 极速推理，无需信用卡 |
| 2 | **智谱 ChatGLM** | glm-4-flash | 永久免费无限额度，中文优秀 |
| 3 | **腾讯混元** | hunyuan-lite | 永久免费无限额度 |
| 4 | **讯飞星火** | spark-lite | 永久免费无限额度 |
| 5 | **OpenRouter** | 多种模型 | 30+ 免费模型，统一 API |
| 6 | **Cloudflare AI** | llama-3.1-8b | 10K neurons/天免费 |

### 3.3 种子数据变更说明

相对 v1.0 版本的主要变更：

| 供应商 | 变更 | 原因 |
|--------|------|------|
| Groq | `mixtral-8x7b-32768` → `qwen3-32b`；补充 `llama-4-scout-17b-16e-instruct` | Mixtral 已下线 |
| DeepSeek | `deepseek-coder` → `deepseek-v3` | deepseek-coder 已合并到 deepseek-chat |
| ChatGLM（智谱） | `default_model` 改为 `glm-4-flash`；补充 `glm-4.7-flash`、`glm-4.5-air` | GLM-4-Flash 永久免费 |
| Hunyuan（混元） | `default_model` 改为 `hunyuan-lite`；补充 `hunyuan-t1`、`hunyuan-turbos` | Hunyuan-Lite 永久免费 |
| Spark（讯飞星火） | `default_model` 改为 `spark-lite`；补充 `spark-lite` | Spark Lite 永久免费 |
| Google Gemini | **新增** | HTML 预览已有但种子数据遗漏，sort_order = 45 |
| SiliconFlow | `deepseek-ai/DeepSeek-V2.5` → `deepseek-ai/DeepSeek-V3` | DeepSeek-V2.5 已迭代 |
| OpenRouter | `default_model` 改为 `meta-llama/llama-3.3-70b-instruct` | 免费模型优先，降低使用门槛 |

## 4. 安全体系

### 4.1 AES-256-GCM 密钥加密

```
环境变量: AI_CONFIG_ENCRYPT_KEY = <Base64 编码的 32 字节密钥>
```

**加密流程（保存配置时）：**

```typescript
// [2026-04-29] 使用 Deno Web Crypto API 替代 Node.js crypto 模块，兼容 Edge Functions 运行时
const ALGO = { name: 'AES-GCM', length: 256 };
const IV_LENGTH = 12;   // 96-bit IV
const TAG_LENGTH = 16;  // 128-bit tag

async function getKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(Deno.env.get('AI_CONFIG_ENCRYPT_KEY')!), c => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, ALGO, false, ['encrypt', 'decrypt']);
}

export async function encryptApiKey(plaintext: string): Promise<Uint8Array> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = await crypto.subtle.encrypt(
    { ...ALGO, iv, tagLength: TAG_LENGTH * 8 },
    key,
    new TextEncoder().encode(plaintext)
  );
  // AES-GCM 输出结构：[IV(12字节) | 密文 | 认证标签(16字节)]
  // Web Crypto API 自动将认证标签附加到密文末尾
  const result = new Uint8Array(iv.length + enc.byteLength);
  result.set(iv);
  result.set(new Uint8Array(enc), iv.length);
  return result;
}

export async function decryptApiKey(blob: Uint8Array): Promise<string> {
  const key = await getKey();
  const iv = blob.slice(0, IV_LENGTH);
  const enc = blob.slice(IV_LENGTH);
  const dec = await crypto.subtle.decrypt(
    { ...ALGO, iv, tagLength: TAG_LENGTH * 8 },
    key,
    enc
  );
  return new TextDecoder().decode(dec);
}
```

**关键规则：**
- `decryptApiKey` 仅在 `ai-proxy` Edge Function 内调用，用于转发请求前解密。
- 前端永远不会接收到明文密钥；查询接口返回脱敏值：

```typescript
export async function maskApiKey(encrypted: Uint8Array): Promise<string> {
  const plain = await decryptApiKey(encrypted);
  if (plain.length <= 8) return '****';
  return plain.slice(0, 3) + '****' + plain.slice(-4);  // sk-****xxxx
}
```

### 4.2 RLS（Row Level Security）

| 表 | 策略 | 说明 |
|---|------|------|
| `ai_providers` | `SELECT` for authenticated enabled rows；`ALL` for admin | 已登录用户可读启用供应商；仅管理员可新增、编辑、禁用。 |
| `ai_configs`   | `ALL` for admin only | 原始配置表仅管理员可访问，普通用户不能直接 SELECT，避免接触 `api_key_enc`。 |
| `GET /ai-config` | authenticated read-only safe response | 普通用户通过 Edge Function 读取脱敏配置摘要，不读取原表密文字段。 |

### 4.3 Edge Function 鉴权

所有 Edge Function 均验证 `Authorization: Bearer <access_token>`：

```typescript
const { data: { user }, error } = await supabaseClient.auth.getUser(token);
if (error || !user) return new Response('Unauthorized', { status: 401 });
```

### 4.3.1 管理员权限校验

`ai-config` 采用“读写分离”的权限策略：

```typescript
const isAdmin = user.app_metadata?.is_admin === true;

// GET /ai-config：所有登录用户可访问，但只返回脱敏摘要。
// POST/PATCH/DELETE/activate/test：仅管理员可访问。
if (request.method !== 'GET' && !isAdmin) {
  return new Response('Forbidden', { status: 403 });
}
```

配置连通性测试统一走 `POST /ai-config/:id/test`，且仅管理员可调用。

### 4.3.2 前端路由守卫

- `/ai-config` 路由只要求用户已登录；普通用户可查看只读页面。
- 页面内根据 `isAdmin` 控制能力：管理员显示“新增/编辑/删除/测试/激活”，普通用户只显示供应商、模型、激活状态、最近测试状态。
- `AiHeaderIcon.vue` 可对已登录用户展示；管理员显示管理状态点，普通用户显示只读状态点。

```typescript
// router/index.ts
{
  path: '/ai-config',
  component: () => import('@/components/business/ai/AiConfigPage.vue'),
  beforeEnter: (to, from, next) => {
    const user = useAuthStore().user;
    if (user) next();
    else next({ path: '/login', query: { redirect: to.fullPath } });
  },
}
```

### 4.4 完整安全清单

| # | 措施 | 位置 |
|---|------|------|
| S1 | AES-256-GCM 加密 API Key | Edge Function / DB |
| S2 | RLS 行级安全 | Supabase |
| S3 | Bearer Token 鉴权 | Edge Function |
| S4 | API Key 脱敏（`sk-****xxxx`） | Edge Function 返回值 |
| S5 | CORS 白名单 | Edge Function headers |
| S6 | 输入校验（URL 格式、model 非空、key 长度） | Edge Function + 前端 |
| S7 | 错误消息脱敏（不暴露内部堆栈） | Edge Function catch |
| S8 | 全站最多 20 条配置 | DB 触发器 + 应用层 |
| S9 | 测试接口仅管理员可用并限流 6 次/分/管理员 | Edge Function（内存计数或 Redis） |
| S10 | `AI_CONFIG_ENCRYPT_KEY` 仅存于 Supabase Secrets | 运维配置 |
| S11 | 管理员权限校验（`is_admin` in `raw_app_meta_data`） | RLS + Edge Function 写操作 + 前端能力控制 |

## 5. Edge Functions 设计

本方案共两个 Edge Function：

| 函数名 | 路径 | 职责 |
|--------|------|------|
| `ai-config` | `/functions/v1/ai-config` | 配置读取（所有登录用户，脱敏）+ 管理员 CRUD/测试/激活；密钥加密/脱敏 |
| `ai-proxy`  | `/functions/v1/ai-proxy`  | 内部供 ziwei-analysis 等 Edge Function 调用；密钥解密 |

### 5.1 `ai-config` — 配置管理

**端点设计：**

| 方法 | 路径参数 | 说明 |
|------|---------|------|
| `GET`    | `/ai-config`        | 所有登录用户可访问，返回全局配置摘要（api_key 脱敏，不含 api_key_enc） |
| `POST`   | `/ai-config`        | 仅管理员：创建新配置（加密 api_key 后存入 api_key_enc） |
| `PATCH`  | `/ai-config/:id`    | 仅管理员：更新配置（若含 api_key 则重新加密） |
| `DELETE` | `/ai-config/:id`    | 仅管理员：删除配置 |
| `POST`   | `/ai-config/:id/activate` | 仅管理员：将指定配置设为全局 is_active（旧激活项自动取消） |
| `POST`   | `/ai-config/:id/test` | 仅管理员：测试指定配置连通性，记录 last_test_* |

**核心逻辑（伪代码）：**

```typescript
// POST /ai-config
async function createConfig(req: Request, user: User) {
  // 0. 校验管理员身份
  if (!user.app_metadata?.is_admin) return error(403, 'forbidden');

  // 1. 校验全局配置数 < 20
  const { count } = await supabase
    .from('ai_configs')
    .select('*', { count: 'exact', head: true })
  if (count >= 20) return error(400, 'ai_config_limit_exceeded');

  // 2. 校验 provider_id 存在且 is_enabled
  const provider = await supabase
    .from('ai_providers')
    .select('*')
    .eq('id', body.provider_id)
    .single();
  if (!provider.data?.is_enabled) return error(400, 'provider_disabled');

  // 3. 加密 API Key
  const api_key_enc = encryptApiKey(body.api_key);

  // 4. 插入（不含明文 api_key）
  const { data, error } = await supabase.from('ai_configs').insert({
    created_by: user.id,
    provider_id: body.provider_id,
    name: body.name || '',
    base_url: body.base_url || provider.data.base_url,
    model: body.model || provider.data.default_model,
    api_key_enc,
    timeout_ms: body.timeout_ms || 30000,
  }).select().single();

  // 5. 返回脱敏结果
  return respond({ ...data, api_key_masked: maskApiKey(api_key_enc), api_key_enc: undefined });
}
```

### 5.2 `ai-proxy` — AI 调用代理（内部使用）

**端点设计：**

> 连通性测试不放在 `ai-proxy` 中开放，统一走 `POST /ai-config/:id/test`，并且仅管理员可用。

`ai-proxy` 不再对外暴露聊天端点。AI 调用统一由 `ziwei-analysis` 等 Edge Function 在服务端通过 `resolveAiConfig()` 获取配置后直接请求供应商 API。

**测试流程（含限流）：**

```typescript
// 内存级限流（单实例足够，冷启动自动重置）
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 6;       // 6 次
const RATE_WINDOW = 60_000; // 每分钟

async function handleTest(req: Request, user: User) {
  // 0. 仅管理员可测试配置
  if (!user.app_metadata?.is_admin) return error(403, 'forbidden');

  // 1. 限流检查
  const now = Date.now();
  const hits = (rateLimitMap.get(user.id) || []).filter(t => now - t < RATE_WINDOW);
  if (hits.length >= RATE_LIMIT) return error(429, 'rate_limit_exceeded');
  hits.push(now);
  rateLimitMap.set(user.id, hits);

  // 2. 获取配置、解密
  const config = await getConfigById(body.config_id);
  const apiKey = decryptApiKey(config.api_key_enc);

  // 3. 根据供应商 api_format 构造请求（此处简化为 OpenAI 兼容格式示例）
  const start = Date.now();
  try {
    const res = await fetch(`${config.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 16,
      }),
      signal: AbortSignal.timeout(config.timeout_ms),
    });
    const elapsed = Date.now() - start;
    const ok = res.ok;

    // 4. 持久化测试结果
    await supabase.from('ai_configs').update({
      last_test_ok: ok,
      last_test_ms: elapsed,
      last_test_at: new Date().toISOString(),
    }).eq('id', config.id);

    return respond({ ok, elapsed_ms: elapsed, status: res.status });
  } catch (e) {
    const elapsed = Date.now() - start;
    await supabase.from('ai_configs').update({
      last_test_ok: false,
      last_test_ms: elapsed,
      last_test_at: new Date().toISOString(),
    }).eq('id', config.id);
    return respond({ ok: false, elapsed_ms: elapsed, error: sanitizeError(e) });
  }
}
```

## 6. 前端架构（Vue 3 Composition API）

### 6.1 目录结构

```
src/
├── features/ai/
│   ├── types.ts              # 所有 AI 相关类型
│   ├── constants.ts          # 区域标签、默认超时等常量
│   ├── client.ts             # Edge Function 调用封装
│   └── index.ts              # barrel export
├── api/
│   ├── ai-provider.ts        # ai_providers 表 Supabase 查询
│   └── ai-config.ts          # ai-config Edge Function 调用
├── stores/
│   └── ai.ts                 # Pinia store：providers + configs 状态
├── composables/
│   └── useAiTest.ts          # 连通性测试逻辑
├── components/business/ai/
│   ├── AiConfigPage.vue      # /ai-config 路由页面主组件
│   ├── ProviderListPanel.vue # 左侧供应商列表 + 筛选 Tab
│   ├── ConfigTable.vue       # 全局配置列表表格（普通用户只读，管理员可操作）
│   ├── ConfigEditModal.vue   # 新增/编辑配置弹窗
│   └── AiHeaderIcon.vue      # 顶部导航栏 AI 配置图标 + 状态点（已登录可见）
├── router/
│   └── index.ts              # 注册 /ai-config 路由
└── legacy/
    └── ai-bridge.ts          # 旧代码兼容桥接（可选）
```

### 6.2 核心类型（`features/ai/types.ts`）

```typescript
/** 供应商定义（来自 ai_providers 表） */
export interface AiProviderDef {
  id: string;
  slug: string;
  label: string;
  region: 'cn' | 'international';
  base_url: string;
  default_model: string;
  models: string[];               // Supabase JSONB 列，SDK 自动反序列化为 JS 数组
  icon_url?: string;
  doc_url?: string;
  is_enabled: boolean;
  sort_order: number;
}

/** 全局配置摘要（来自 ai-config Edge Function，api_key 已脱敏，不含 api_key_enc） */
export interface AiProviderConfig {
  id: string;
  created_by?: string | null;
  provider_id: string;
  name: string;
  base_url: string;
  model: string;
  api_key_masked: string;       // "sk-****xxxx"，前端展示用
  timeout_ms: number;
  is_active: boolean;
  last_test_ok: boolean | null;
  last_test_ms: number | null;
  last_test_at: string | null;  // ISO 8601
  created_at: string;
  updated_at: string;
  // 关联
  provider?: AiProviderDef;
}

/** 创建/更新配置的请求体 */
export interface AiConfigPayload {
  provider_id: string;
  name?: string;
  base_url?: string;
  model?: string;
  api_key?: string;             // 明文，仅在创建/更新时传输（HTTPS）
  timeout_ms?: number;
}

/** 测试结果 */
export interface TestResult {
  ok: boolean;
  elapsed_ms: number;
  status?: number;
  error?: string;
}
```

### 6.3 Edge Function 调用辅助（`lib/edge.ts`）

```typescript
// [2026-04-29] 新增：统一 Edge Function 调用辅助，封装 Bearer token、超时、错误处理
import { supabase } from '@/lib/supabase';

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Edge Function 请求失败: ${res.status}`);
  }
  return res.json();
}

export const edgeFn = {
  get:    <T>(path: string) => request<T>('GET', path),
  post:   <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch:  <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: (path: string) => request<void>('DELETE', path),
};
```

### 6.4 API 层

**`api/ai-provider.ts`：**

```typescript
import { supabase } from '@/lib/supabase';
import type { AiProviderDef } from '@/features/ai';

export async function fetchProviders(adminView = false): Promise<AiProviderDef[]> {
  let query = supabase
    .from('ai_providers')
    .select('*')
    .order('sort_order');
  // RLS 已对非管理员过滤 is_enabled；管理员视角需看到全部（含禁用）
  if (!adminView) {
    query = query.eq('is_enabled', true);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as AiProviderDef[];
}
```

**`api/ai-config.ts`：**

```typescript
import { edgeFn } from '@/lib/edge';
import type { AiProviderConfig, AiConfigPayload, TestResult } from '@/features/ai';

export const aiConfigApi = {
  list:     ()                          => edgeFn.get<AiProviderConfig[]>('/ai-config'),
  create:   (payload: AiConfigPayload)  => edgeFn.post<AiProviderConfig>('/ai-config', payload),
  update:   (id: string, payload: Partial<AiConfigPayload>) => edgeFn.patch<AiProviderConfig>(`/ai-config/${id}`, payload),
  remove:   (id: string)                => edgeFn.delete(`/ai-config/${id}`),
  activate: (id: string)                => edgeFn.post(`/ai-config/${id}/activate`),
  test:     (id: string)                => edgeFn.post<TestResult>(`/ai-config/${id}/test`),
};
```

### 6.5 Pinia Store（`stores/ai.ts`）

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { fetchProviders } from '@/api/ai-provider';
import { aiConfigApi } from '@/api/ai-config';
import type { AiProviderDef, AiProviderConfig } from '@/features/ai';

export const useAiStore = defineStore('ai', () => {
  const providers = ref<AiProviderDef[]>([]);
  const configs   = ref<AiProviderConfig[]>([]);
  const loading   = ref(false);

  const activeConfig = computed(() => configs.value.find(c => c.is_active) ?? null);
  const hasActiveConfig = computed(() => !!activeConfig.value);

  async function loadProviders() {
    providers.value = await fetchProviders();
  }

  async function loadConfigs() {
    configs.value = await aiConfigApi.list();
    // 关联 provider 对象
    configs.value.forEach(c => {
      c.provider = providers.value.find(p => p.id === c.provider_id);
    });
  }

  async function init() {
    loading.value = true;
    try {
      await loadProviders();
      await loadConfigs();
    } finally {
      loading.value = false;
    }
  }

  async function activateConfig(id: string) {
    await aiConfigApi.activate(id);
    await loadConfigs();
  }

  return { providers, configs, loading, activeConfig, hasActiveConfig, init, loadProviders, loadConfigs, activateConfig };
});
```

### 6.6 Barrel Export（`features/ai/index.ts`）

```typescript
export * from './types';
export * from './constants';
```

## 7. UI 设计

### 7.1 入口方式

| 入口 | 位置 | 行为 |
|------|------|------|
| **AI 配置图标** | 顶部导航栏右侧（`AiHeaderIcon.vue`） | 已登录用户可见。普通用户进入只读配置页；管理员可维护配置。图标右上角绿色状态点表示已有全局激活配置，灰色表示未配置。 |

### 7.2 `/ai-config` 页面布局

```
┌─────────────────────────────────────────────────────────┐
│  面包屑：首页 / AI 助手配置（管理员维护，普通用户只读）           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 筛选 Tab：                                         │  │
│  │ [全部|国内|国际|自定义]                               │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 供应商列表（表格行）                                  │  │
│  │ 图标│名称│区域│模型                                   │  │
│  │ DS  │DeepSeek │国内│deepseek-chat +2                │  │
│  │ 通  │通义千问  │国内│qwen-turbo +3                   │  │
│  │ ...                                                │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 全局配置列表                                        │  │
│  │ ┌────┬──────┬─────┐                                │  │
│  │ │名称│供应商 │状态  │                                │  │
│  │ ├────┼──────┼─────┤                                │  │
│  │ │我的 │DeepSe│✅ 活跃│                               │  │
│  │ │GPT │OpenAI│⬚ 待测│                               │  │
│  │ └────┴──────┴─────┘                                │  │
│  │ [+ 新增配置] (< 20，仅管理员)                         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  底部提示：当前激活配置将用于紫微分析等功能的 AI 调用          │
└─────────────────────────────────────────────────────────┘
```

### 7.3 配置编辑弹窗（`ConfigEditModal.vue`）

| 字段 | 组件 | 说明 |
|------|------|------|
| 配置名称 (`name`) | 原生输入组件 | 管理员自定义标签，如 "生产 GPT-4" |
| 供应商 (`provider_id`) | 原生下拉组件 | 按 region 分组，icon + label |
| 模型 (`model`) | 原生下拉组件 | 动态加载所选供应商的 `models[]`，显示全部可选模型，标注默认模型 |
| API 地址 (`base_url`) | 原生输入组件 | 预填供应商默认值，可覆盖 |
| API Key (`api_key`) | 原生密码输入组件 | 编辑时显示 `sk-****xxxx`，清空后输入新值才会更新 |
| 超时 (`timeout_ms`) | 原生数字输入组件 | 默认 30000，步长 5000，范围 5000-120000 |

弹窗底部操作栏：

- **测试连接**：调用 `POST /ai-config/:id/test`，显示耗时与结果，仅管理员可用
- **保存**：创建或更新配置，仅管理员可用
- **设为激活**：保存后一键激活，仅管理员可用

### 7.4 状态指示

| 状态 | 标记 | 含义 |
|------|------|------|
| `is_active = true` | 绿色徽章 "活跃" | 当前用于 AI 调用的配置 |
| `last_test_ok = true` | 绿色圆点 | 最近测试通过 |
| `last_test_ok = false` | 红色圆点 | 最近测试失败 |
| `last_test_ok = null` | 灰色圆点 | 未测试 |

## 8. 与 ziwei-analysis 集成

当 `ziwei-analysis` Edge Function 需要调用 AI 时，采用以下优先级策略：

```typescript
async function resolveAiConfig(): Promise<{
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}> {
  // 优先级 1：管理员维护的全局激活 AI 配置
  // 必须使用 service_role client 绕过 RLS（ai_configs 仅管理员可读）
  const { data: activeConfig } = await supabaseAdmin
    .from('ai_configs')
    .select('*')
    .eq('is_active', true)
    .single();

  if (activeConfig) {
    return {
      baseUrl:   activeConfig.base_url,
      model:     activeConfig.model,
      apiKey:    decryptApiKey(activeConfig.api_key_enc),
      timeoutMs: activeConfig.timeout_ms,
    };
  }

  // 优先级 2：环境变量默认配置
  return {
    baseUrl:   Deno.env.get('DEFAULT_AI_BASE_URL') || 'https://api.deepseek.com/v1',
    model:     Deno.env.get('DEFAULT_AI_MODEL')    || 'deepseek-chat',
    apiKey:    Deno.env.get('DEFAULT_AI_API_KEY')!,
    timeoutMs: Number(Deno.env.get('DEFAULT_AI_TIMEOUT_MS') || '30000'),
  };
}
```

**集成要点：**

1. `ziwei-analysis` 仍然校验调用用户身份与白名单，但 AI 供应商配置通过 `resolveAiConfig()` 获取全局激活配置。
2. 若管理员未设置全局激活配置，回退到项目级环境变量，保证功能不中断。
3. 在 AI 配置页面底部提示用户："当前全局激活配置将用于紫微分析等功能的 AI 调用。若未配置，将使用系统默认。"
4. 解密操作发生在 Edge Function 服务端，密钥不离开运行时。

## 9. 实施步骤

按依赖顺序分为 6 个阶段，建议总工期 5-7 天：

### 阶段 1：数据库与安全基础（Day 1）

| # | 任务 | 产出 |
|---|------|------|
| 1.1 | 创建 `ai_providers` 表 + RLS + 索引 | migration 文件 |
| 1.2 | 创建 `ai_configs` 表 + RLS + 触发器 + 索引 | migration 文件 |
| 1.3 | INSERT 供应商种子数据（第 3 节全部） | seed 文件 |
| 1.4 | 生成 `AI_CONFIG_ENCRYPT_KEY` 并存入 Supabase Secrets | `supabase secrets set` |
| 1.5 | 本地验证 RLS 策略（用不同用户 Token 测试） | 测试通过 |

### 阶段 2：Edge Functions（Day 2-3）

| # | 任务 | 产出 |
|---|------|------|
| 2.1 | 实现加密/解密/脱敏工具函数 (`_shared/crypto.ts`) | 共享模块 |
| 2.2 | 实现 `ai-config` Edge Function（CRUD + 激活） | `supabase/functions/ai-config/` |
| 2.3 | 实现 `ai-proxy` 内部代理逻辑（供 ziwei-analysis 调用） | `supabase/functions/ai-proxy/` |
| 2.4 | 编写 Edge Function 集成测试（Deno test） | 测试用例 |
| 2.5 | 部署 Edge Functions 到 Supabase | `supabase functions deploy` |

### 阶段 3：前端基础设施（Day 3-4）

| # | 任务 | 产出 |
|---|------|------|
| 3.1 | 创建 `features/ai/types.ts`，定义所有类型 | 类型文件 |
| 3.2 | 创建 `features/ai/constants.ts` + `index.ts` barrel | 常量 + 导出 |
| 3.3 | 创建 `api/ai-provider.ts`（Supabase 查询） | API 层 |
| 3.4 | 创建 `api/ai-config.ts`（Edge Function 调用） | API 层 |
| 3.5 | 创建 `stores/ai.ts`（Pinia Store） | 状态管理 |
| 3.6 | 创建 `composables/useAiTest.ts` | 可复用逻辑 |

### 阶段 4：UI 组件（Day 4-5）

| # | 任务 | 产出 |
|---|------|------|
| 4.1 | `ProviderListPanel.vue` — 供应商筛选 + 卡片网格 | 组件 |
| 4.2 | `ConfigTable.vue` — 全局配置表格 + 状态标记 | 组件 |
| 4.3 | `ConfigEditModal.vue` — 新增/编辑弹窗 + 测试按钮 | 组件 |
| 4.4 | `AiConfigPage.vue` — 组合以上组件，注册路由 `/ai-config` | 页面 |
| 4.5 | `AiHeaderIcon.vue` — 导航栏齿轮 + 状态点 | 组件 |

### 阶段 5：集成与联调（Day 5-6）

| # | 任务 | 产出 |
|---|------|------|
| 5.1 | 将 `AiHeaderIcon` 集成到全局布局 Header | 修改布局文件 |
| 5.2 | 修改 `ziwei-analysis` Edge Function，引入 `resolveAiConfig` | 修改现有函数 |
| 5.3 | 端到端测试：创建配置 → 测试 → 激活 → 紫微调用 | E2E 通过 |
| 5.4 | 旧代码兼容桥接（如需要） | `legacy/ai-bridge.ts` |

### 阶段 6：收尾（Day 6-7）

| # | 任务 | 产出 |
|---|------|------|
| 6.1 | 响应式适配（移动端布局） | CSS 调整 |
| 6.2 | 国际化文案（如项目有 i18n） | locale 文件 |
| 6.3 | 错误边界与空状态引导 | UX 完善 |
| 6.4 | 代码审查 + 安全审查 | Review 通过 |
| 6.5 | 更新项目文档 | 文档更新 |

## 10. 附录：类型定义汇总

以下为 `src/features/ai/types.ts` 完整内容参考：

```typescript
// ============================================================
// features/ai/types.ts — SQLDev AI 模块类型定义
// ============================================================

// ---------- 数据库实体 ----------

/** ai_providers 表行（管理员维护） */
export interface AiProviderDef {
  id: string;
  slug: string;
  label: string;
  region: 'cn' | 'international';
  base_url: string;
  default_model: string;
  models: string[];
  icon_url?: string;
  doc_url?: string;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** ai_configs 脱敏展示行（管理员维护，普通用户只读） */
export interface AiProviderConfig {
  id: string;
  created_by?: string | null;
  provider_id: string;
  name: string;
  base_url: string;
  model: string;
  api_key_masked: string;        // "sk-****xxxx"
  timeout_ms: number;
  is_active: boolean;
  last_test_ok: boolean | null;
  last_test_ms: number | null;
  last_test_at: string | null;
  created_at: string;
  updated_at: string;
  // 前端 join
  provider?: AiProviderDef;
}

// ---------- 请求/响应 ----------

/** 创建/更新配置 */
export interface AiConfigPayload {
  provider_id: string;
  name?: string;
  base_url?: string;
  model?: string;
  api_key?: string;              // 明文，HTTPS 传输，服务端加密
  timeout_ms?: number;
}

/** 测试请求体：配置 ID 从 /ai-config/:id/test 路径获取，body 可为空。 */
export type TestRequest = Record<string, never>;

// ---------- 业务模型 ----------

/** 测试结果 */
export interface TestResult {
  ok: boolean;
  elapsed_ms: number;
  status?: number;
  error?: string;
}

// ---------- UI 辅助 ----------

/** 供应商筛选 Tab */
export type ProviderFilterTab = '全部' | '国内' | '国际' | '自定义';

/** 配置状态 */
export type ConfigStatus = 'active' | 'tested_ok' | 'tested_fail' | 'untested';
```

### 常量参考（`features/ai/constants.ts`）

```typescript
export const PROVIDER_FILTER_TABS = ['全部', '国内', '国际', '自定义'] as const;

export const REGION_MAP: Record<string, string> = {
  cn: '国内',
  international: '国际',
};

export const DEFAULT_TIMEOUT_MS = 30000;
export const MIN_TIMEOUT_MS = 5000;
export const MAX_TIMEOUT_MS = 120000;
export const MAX_CONFIGS_GLOBAL = 20;
```

---

> **文档版本**：v1.1 — 融合 Proposal A（Mimo）+ Proposal B（MuleRun），新增管理员权限控制、免费 API 可用性核实、种子数据模型名更新
> **适用项目**：SQLDev（Vue 3 + Supabase）
> **生成日期**：2026-04-29
