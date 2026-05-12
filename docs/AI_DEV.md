# AI 开发规范（VSCode + AI Coding Agent + Vue + Supabase）

> 本文档用于约束 AI Coding Agent 在本项目中的代码生成与重构行为。
> 目标：统一技术栈、减少返工、确保生成代码可直接运行、可验证、可维护。

---

## 0. 适用环境

- IDE：VSCode
- AI 助手：AI Coding Agent（不绑定具体产品名，Codex / Kilo 等均按本文档执行）
- 前端：Vue 3 + TypeScript + Vite
- 后端能力：Supabase（Auth / Database / Storage / Realtime / Edge Functions）
- Edge Functions 运行时：Deno（非 Node.js）
- 包管理器：pnpm

---

## 1. 技术栈基线（必须遵守）

### 前端

- Vue 3（仅 Composition API）
- TypeScript（strict 模式）
- Vue Router 4
- Pinia
- fetch（统一封装于 `src/api/http.ts`，禁止散写）
- TailwindCSS + Design Token 混合使用：
  - **Vue 模板 (`<template>`)**：优先使用 Tailwind 语义类（如 `bg-panel`, `text-brand-500`）
  - **组件样式 (`<style scoped>` 或 CSS 文件)**：优先使用 CSS 变量（如 `var(--color-border)`）
  - **全局样式 (`main.css` 的 @layer components)**：使用 Tailwind @apply + CSS 变量混写
  - **token 文件 (`tokens.css`)**：仅定义 CSS 变量，不使用 Tailwind
- ESLint + Prettier

### Supabase / 后端

- Supabase JS SDK（`@supabase/supabase-js`）
- Supabase Auth（邮箱/OTP/OAuth 以项目配置为准）
- PostgreSQL（通过 Supabase 提供）
- Row Level Security（RLS）必须启用并配策略
- Edge Functions 仅处理需要服务端权限、第三方密钥、AI 调用、风控/配额等敏感逻辑
- Edge Functions 使用 Deno API（如 `Deno.serve`、`Deno.env`、`Deno.openKv`），禁止套用 Node.js 专属 API
- 必须使用 Supabase CLI 生成的 Database 类型定义（`src/types/database.types.ts`），前端统一从 `@/types` 类型桶导入

---

## 2. AI 输出与执行规则（必须执行）

1. 默认使用 `<script setup lang="ts">`，Composition API only。
2. 涉及 Supabase 的功能，必须区分：
   - 前端可做：用户态查询（受 RLS 限制）
   - 服务端做：管理员权限、敏感写操作、第三方密钥、AI 请求（Edge Function）
3. 实际执行型任务优先直接改代码并验证；总结时说明变更文件、验证结果、是否需要部署。
4. 方案型/说明型任务需要包含：实现方案、变更文件、关键代码或完整代码、Supabase 变更、验证步骤、风险。
5. 前端响应式状态优先使用 `ref`，复杂对象再使用 `reactive`，禁止随意解构导致响应式丢失。
6. 其他代码禁止项详见 [§20 禁止项清单](#20-禁止项清单高优先级)。

---

## 3. 项目实际目录结构（以此为准）

```txt
.
├── docs/
│   ├── AI_DEV.md                  # AI 辅助开发规范（本文件）
│   ├── AI_DEV_REVIEW.md           # 规范审查建议
│   └── CONTEXT_FULL.md            # 项目状态快照与变更记录
├── supabase/
│   ├── migrations/                # 数据库版本控制
│   ├── functions/
│   │   ├── _shared/               # 共享工具（auth / cors / rate-limit / response）
│   │   ├── convert/               # SQL 转换服务
│   │   ├── feedback/              # 反馈提交服务
│   │   ├── verify-profiles/       # 校验配置管理
│   │   └── ziwei-analysis/        # 紫微 AI 分析服务
│   ├── FUNCTION-AUTH-STRATEGY.md  # 函数鉴权策略说明
│   ├── SECURITY-CHECKLIST.md      # 安全检查辅助文档
│   └── config.toml                # Supabase 本地 CLI 配置
├── src/
│   ├── api/                       # Edge Function 请求封装
│   ├── components/
│   │   ├── common/                # 通用 UI 组件（StatePanel 等）
│   │   ├── business/              # 业务组件
│   │   │   ├── ai/               # AI 配置管理
│   │   │   ├── app-config/       # 应用配置管理
│   │   │   ├── auth/             # 认证相关
│   │   │   ├── convert-verify/   # 转换校验与配额
│   │   │   ├── feedback/         # 反馈组件
│   │   │   ├── operation-logs/   # 操作日志
│   │   │   └── workbench/        # 工作台
│   │   │       ├── components/   # 工作台通用组件（SqlEditor 等）
│   │   │       ├── modals/       # 工作台弹窗
│   │   │       └── pages/        # 工作台各功能页
│   │   └── layout/               # 布局组件
│   ├── composables/               # Vue 组合式函数
│   ├── features/                  # 功能模块（优先纯逻辑）
│   │   ├── ai/                    # AI 配置类型与常量
│   │   ├── app-config/           # 应用配置类型
│   │   ├── browser/              # 文件下载与剪贴板
│   │   ├── convert-verify/       # 转换校验（预留）
│   │   ├── id-tools/             # 证件号码工具
│   │   ├── navigation/           # 路由解析与状态同步
│   │   ├── preferences/          # 偏好存储
│   │   ├── rules/                # 规则引擎与持久化
│   │   ├── shared/               # 共享类型与工具
│   │   ├── sql/                  # SQL 文本处理
│   │   └── ziwei/                # 紫微斗数计算与 AI
│   ├── layouts/                  # 全局布局
│   ├── lib/                      # 第三方库实例化
│   ├── pages/                     # 路由页面
│   │   ├── auth/login.vue        # 登录页
│   │   ├── operation-logs/       # 操作日志页
│   │   ├── splash/               # 首页
│   │   └── workbench/            # 工作台入口
│   ├── router/                   # 路由配置与守卫
│   ├── stores/                    # Pinia 状态管理
│   ├── styles/                    # CSS Token + Tailwind 组件层
│   ├── types/                     # TypeScript 类型定义
│   └── utils/                     # 通用工具函数
├── tests/                         # Node .mjs 测试
├── scripts/
│   ├── check-utf8.mjs           # UTF-8 编码校验
│   └── smoke.mjs                 # Smoke 入口代理
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.mjs
```

### 新代码放置规则

- 纯逻辑（无 DOM / 无 Vue 依赖）：放 `src/features/<module>/`
- Vue 响应式可复用逻辑：放 `src/composables/`
- Edge Function 请求封装：放 `src/api/`
- 页面级组件：放 `src/pages/`
- 可复用 UI 组件：放 `src/components/`
- 全局类型：放 `src/types/`
- DOM / 浏览器副作用：优先放 `composables`、组件或明确的 browser adapter，不应混入 parser/converter 纯逻辑

---

## 4. 环境变量规范

### 4.1 前端公开变量

前端只允许使用 `VITE_*` 公开变量：

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_TIMEOUT_MS=30000
```

- `VITE_*` 会进入浏览器产物，绝不能放私密 key。
- 禁止在前端使用 `service_role` key。
- 禁止在客户端代码中使用 `process.env`，Vite 客户端只使用 `import.meta.env`。

### 4.2 Supabase Secrets

服务端私密变量通过 Supabase Secrets 设置：

```powershell
supabase secrets set KEY=value --project-ref <project-ref>
```

常用变量：

| 变量 | 用途 | 作用域 |
|------|------|--------|
| `CORS_PRIMARY_ORIGIN` | 主站 CORS 来源 | convert / feedback / ziwei-analysis |
| `CORS_ALLOWED_ORIGINS` | 额外允许来源，逗号分隔 | convert / feedback / ziwei-analysis |
| `ALLOW_LOCALHOST_ORIGIN` | 是否允许 localhost | convert / feedback / ziwei-analysis |
| `CONVERT_RATE_LIMIT_MAX_REQUESTS` | convert 限流次数 | convert |
| `CONVERT_RATE_LIMIT_WINDOW_MS` | convert 限流窗口 | convert |
| `ZIWEI_ALLOWED_EMAILS` | 紫微 AI 邮箱白名单 | ziwei-analysis |
| `ZIWEI_AI_ANALYSIS_TEMPLATE` | AI 深度解读模板 | ziwei-analysis |
| `ZIWEI_AI_QA_TEMPLATE` | AI 问答模板 | ziwei-analysis |
| `ZIWEI_AI_QA_SUGGESTIONS` | AI 问答下拉建议，JSON 数组 | ziwei-analysis |
| `OPENAI_API_KEY` / 兼容模型 key | AI Provider 密钥 | ziwei-analysis |

### 4.3 环境变量文件层级

| 文件 | 用途 | 是否提交 |
|------|------|----------|
| `.env.example` | 变量模板与说明 | 是 |
| `.env` | 非敏感默认值（按项目约定） | 谨慎 |
| `.env.local` | 本地真实值与私密配置 | 否 |
| `.env.*.local` | 模式特定本地覆盖 | 否 |

---

## 5. Supabase 客户端标准写法

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})
```

---

## 6. Auth 与权限规范

1. 登录态来源以 `supabase.auth.getSession()` + `onAuthStateChange` 为准。
2. 用户信息统一放在 Pinia Store / composable，不在多个组件重复维护。
3. 路由守卫保护需要登录的页面。
4. 登出必须清理用户相关业务状态；主题等非用户偏好可保留。
5. 前端菜单隐藏不是安全边界，敏感能力必须在 Edge Function 内二次校验。
6. 白名单、角色、配额等权限判断必须以服务端结果为准。

### 6.1 订阅与监听资源管理

- 全局订阅必须避免重复注册，如 `initPromise` / 标志位串行化。
- `onAuthStateChange`、`matchMedia`、`addEventListener` 等监听应有清理策略。
- Pinia store 内长期订阅必须考虑 HMR / 测试环境重复挂载。

---

## 7. 数据库与 RLS 规范（关键）

1. 新表默认开启 RLS。
2. 至少按需定义 `select` / `insert` / `update` / `delete` 策略。
3. 用户私有数据必须包含 `user_id` 并绑定 `auth.uid()`。
4. 禁止为了"先跑通"而关闭 RLS 作为长期方案。
5. service_role 只能在 Edge Function / 安全服务器使用。
6. **建表必须有表注释和列注释**：
   - 每张表必须使用 `COMMENT ON TABLE` 说明表的业务用途。
   - 每个非显而易见的列必须使用 `COMMENT ON COLUMN` 说明含义、取值范围或约束。
   - 示例：

```sql
CREATE TABLE public.ai_providers (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  region      text NOT NULL DEFAULT 'domestic',
  protocol    text NOT NULL DEFAULT 'openai',
  models      jsonb NOT NULL DEFAULT '[]',
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_providers IS 'AI 供应商定义表，管理员通过 Dashboard 维护，所有已登录用户可读';
COMMENT ON COLUMN public.ai_providers.region IS '供应商区域：domestic（国内）/ international（国际）/ custom（自定义）';
COMMENT ON COLUMN public.ai_providers.protocol IS 'API 协议格式：openai（OpenAI 兼容）/ gemini（Google Gemini API）';
COMMENT ON COLUMN public.ai_providers.models IS '可用模型列表，JSON 数组，每项含 id/name/free/recommended 字段';
```

### 7.1 数据库类型维护

- 类型定义文件：`src/types/database.types.ts`
- 生成命令：

```powershell
supabase gen types typescript --local > src/types/database.types.ts
```

- 每次 migration 变更后必须重新生成类型并运行 `pnpm typecheck`。
- 禁止手动修改 `database.types.ts`。

### 7.2 Migration 命名与管理

- 命名格式：`YYYYMMDDHHMMSS_descriptive_name.sql`（由 Supabase CLI 自动生成，禁止手动重命名）。
- DDL（结构变更）与 DML（数据迁移）应分文件，不要混在同一个 migration 中。
- 涉及列删除、类型变更等破坏性操作，必须在 migration 中先备份数据或提供回滚说明。
- **迁移文件修改策略（分层）**：
  - **未上线迁移（可改）**：若该 migration 仅在个人本地或临时分支使用、尚未进入共享环境（开发/测试/生产）执行记录，优先直接更新原 SQL 文件，避免碎片化小迁移。
  - **已上线迁移（不可改）**：只要该 migration 已在任一共享环境执行，禁止修改原文件；修正必须新增增量 migration。
  - **判定优先级**：以共享环境执行记录/发布记录为准；无法确认时按“已上线”处理。
- 每个增量迁移应同时准备回滚脚本（或在迁移文件注释中明确回滚方式），确保出问题时能快速恢复。

---

## 8. 前端数据访问规范

1. 所有 Supabase / Edge Function 请求统一封装到 `src/api/*.ts` 或 `src/composables/*.ts`。
2. 页面组件只调用封装函数，不直接拼复杂查询。
3. 异步请求必须处理 `loading / success / error` 三态。
4. 列表页必须考虑空状态（empty state）。
5. fetch 请求必须使用 `src/api/http.ts` 的统一封装，包含超时与 token 刷新。

### 8.1 API 契约与运行时校验（新增）

1. TypeScript 类型只解决编译期问题，关键接口必须有**运行时 schema 校验**（可使用 zod 或等价方案）。
2. 前端发送关键请求前应做最小必要校验（结构、长度、枚举值），服务端必须再次完整校验。
3. Edge Function 对请求体解析失败或字段不合法时，统一返回 `validation_*` 错误码，禁止“容错吞错”继续执行。
4. 接口字段变更必须同步更新：`src/api/*` 类型定义、Edge Function 入参/出参、测试用例与文档。
5. 不兼容变更必须采用版本化策略（如新 endpoint 或向后兼容字段），禁止静默破坏旧客户端。

---

## 9. Edge Function 设计规范

### 9.1 何时使用 Edge Functions

以下场景必须走 Edge Functions：

- 需要 `service_role` 权限
- 聚合多个受限表并返回裁剪结果
- 调用第三方私密 API 或 AI Provider
- 支付、风控、配额、限流等敏感逻辑

### 9.2 设计约束

- 函数入口（`Deno.serve`）只做 CORS、鉴权、解析、分发，业务逻辑应拆分为 handler / `_shared`。
- 共享逻辑（认证、CORS、限流、响应封装）统一放 `supabase/functions/_shared/`。
- `config.toml` 中 `verify_jwt = false` 时，函数内必须自行校验 Bearer token。
- 错误响应必须结构化且脱敏，禁止把上游 AI 原始报文、SQL、stack trace 返回给用户。
- 请求体必须做大小、结构、字段类型校验；大型对象必须设置上限。
- 环境变量通过 `supabase secrets` 管理，禁止硬编码。

### 9.3 CORS 规范

- `CORS_PRIMARY_ORIGIN`：主站 origin，如 `https://gitzhengpeng.github.io`。
- `CORS_ALLOWED_ORIGINS`：逗号分隔的额外 origin。
- `ALLOW_LOCALHOST_ORIGIN`：仅本地开发开启，生产关闭。
- CORS 只识别 origin，不包含路径；`https://gitzhengpeng.github.io/sqldev` 的 origin 是 `https://gitzhengpeng.github.io`。

---

## 10. AI 接入规范

1. AI 请求必须走 Edge Function，禁止前端直连模型 API。
2. Prompt / template 优先通过 Supabase Secrets 配置，不写死在前端。
3. 前端只传必要的结构化命盘/业务数据；禁止传 token、密钥、无关邮箱等敏感信息。
4. Edge Function 必须做鉴权、白名单、限流、超时、错误脱敏。
5. AI 输入与输出长度必须有明确预算；需要完整输出时优先拆阶段或流式/分段，而不是盲目加大超时。
6. AI 失败必须有可理解降级提示，不暴露 provider 原始错误。
7. 问答类功能应使用服务端模板控制回答结构，前端只传问题和上下文。

---

## 11. 错误处理规范（必须遵守）

### 11.1 函数层错误表达

- `src/features/` 中的纯逻辑函数：优先返回 Result 模式，避免 throw。
- `src/api/` 中的请求封装：可 throw `ApiError`，但必须包含 `code` 字段（`snake_case`）。
- 禁止用 `string` 作为错误返回值（如 `return '-- 解析失败'`）。

标准 Result 类型建议：

```ts
export type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E }

export interface AppError {
  code: string
  message: string
  cause?: unknown
}
```

错误码分类（`snake_case`）：

| 前缀 | 含义 | 示例 |
|------|------|------|
| `auth_*` | 认证/授权 | `auth_token_expired`, `auth_unauthorized` |
| `rate_*` | 限流/配额 | `rate_limited`, `rate_quota_exceeded` |
| `convert_*` | SQL 转换 | `convert_parse_failed`, `convert_unsupported_syntax` |
| `ai_*` | AI 服务 | `ai_provider_error`, `ai_timeout`, `ai_blocked` |
| `validation_*` | 输入校验 | `validation_invalid_input`, `validation_too_large` |
| `network_*` | 网络/请求 | `network_timeout`, `network_offline` |
| `internal_*` | 内部错误 | `internal_unknown` |

> **语义说明**：`code` 字段仅用于程序化错误处理（判断类型、流程分支），**禁止**直接展示给用户。面向用户的错误文案统一使用 `message` 字段，并通过 `error-map.ts` 映射为最终 UI 文案。

### 11.2 用户侧错误文案

- 面向用户的错误文案集中管理在 `src/utils/error-map.ts` 或各 feature 的 `error-map.ts` 中。
- 禁止在组件或 composable 中散写错误文案。
- 错误文案必须告诉用户如何处理，而非只说"出错了"。

### 11.3 日志策略

- 开发环境：`console.error` 输出完整错误。
- 生产环境：至少不能静默吞错；后续可接入监控。
- 禁止空 `catch {}`，至少记录错误或返回结构化失败。

### 11.4 可观测性与追踪（新增）

1. 前后端请求链路必须可追踪：统一透传 `request_id`（或 `trace_id`），建议通过 `x-request-id` 请求头传递。
2. Edge Function 入口必须在日志中输出同一 `request_id`，便于跨层排查（前端 -> API 层 -> Edge Function）。
3. 结构化日志最少字段建议：`timestamp`、`level`、`service`、`operation`、`request_id`、`user_id`（可空）、`status`、`duration_ms`、`error_code`。
4. 严禁记录敏感信息（token、密钥、完整 SQL、上游原始报文、隐私数据）。
5. 用户侧错误提示可附短错误 ID（不暴露内部细节），用于快速关联服务端日志排查。

---

## 12. 测试规范（必须遵守）

### 12.1 测试框架与断言

- 当前使用 `node` 直接执行 `.mjs` 测试文件。
- TypeScript 模块测试通过 `tests/helpers/load-ts-module.mjs` 转译加载。
- 断言使用 Node.js 内置 `node:assert/strict`。
- 后续如迁移 Vitest，以迁移后为准。

### 12.2 必须有测试的模块

- `src/features/` 下所有纯逻辑模块（parser / validator / converter / mapper）。
- `src/api/` 中的错误映射和复杂请求策略。
- `src/composables/` 中包含复杂状态逻辑的组合函数。

### 12.3 测试文件规范

- 存放位置：`tests/<feature-name>.mjs`。
- 命名规则：与被测模块对应，如 `tests/ddl-column-parsers.mjs`。
- 每个新增测试必须注册到 `package.json` 的 `scripts` 中，并纳入 `test` 与 `verify`。
- `tests/smoke.mjs` 必须包含新增 feature bridge / 关键架构约束的存在性断言。

### 12.4 Smoke 测试职责

`tests/smoke.mjs` 是集成冒烟测试，必须覆盖：

- 关键入口、路由的存在性。
- `src/features/*/index.ts` 的 barrel 导出完整性。
- 安全与架构关键约束（如 CORS env、redirect sanitizer）。

---

## 13. 代码风格与质量门槛

- 单个函数建议不超过 80 行；超过必须优先拆分。
- Vue 组件 `<script>` 部分不超过 150 行；超过必须抽取 composable 或无状态子组件。
- 复杂正则表达式必须提取为命名常量并添加注释说明意图。
- 可复用逻辑放 `composables` 或 `features`，可复用类型放 `types`。
- **去冗余与复用**：
  - 同一个功能只能有**一个主实现**（Single Source of Truth）。
  - 新需求先查是否已有通用组件/composable/helper，可复用则禁止重复开发。
  - 出现 2 处及以上相同逻辑，必须抽离为公共能力（组件、函数、hook、常量）。
  - UI 控件优先复用现有通用组件，避免"同名不同行为"的平行实现。
  - 新增代码前先搜同类实现；若必须新建，需说明为何不能复用。
  - 若复用现有组件需要大量 props 分支或 hack 才能满足差异需求，可新建专用组件，但必须在 PR 中说明不复用的理由，避免为了"统一"而制造难以维护的过度抽象。
- **变更注释原则**：日常修改依赖 Git commit message 记录变更原因；仅在以下场景添加代码注释：
  - 非直觉的技术决策（如超时值选择、算法取舍）。
  - 大规模重构的迁移批次标记。
  - 临时 workaround 并标注后续清理计划。
  - 日期注释（`// [YYYY-MM-DD] 说明`）仅用于临时 workaround 或需要定期清理的代码，不作为通用强制规则。
- 提交前至少通过：
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm check:utf8`
  - `pnpm test`
- 完整验证使用 `pnpm verify`，CI 应以它作为门禁。

---

## 14. Git 工作流规范

### 14.1 基本规则

- 始终先本地 commit，再 push 到 remote。
- 日常开发操作直接执行，不需要对常规实现细节征求确认。
- 当设计和交互选择可从已有方向明确推断时，直接执行，不额外提问。
- 当前协作约定：如用户明确要求"不要代提交"，AI 只提供提交命令，不执行 commit。

### 14.2 分支命名

- 功能分支：`feat/<简短描述>`
- 修复分支：`fix/<简短描述>`
- 重构分支：`refactor/<简短描述>`

### 14.3 Commit Message

```txt
type(scope): 简短描述

可选的详细说明
```

type 取值：`feat` / `fix` / `refactor` / `chore` / `docs` / `test` / `security` / `perf` / `style` / `ci` / `build` / `revert`

---

## 15. 性能与缓存规范

### 15.1 路由与加载

- 路由页面应优先懒加载：`() => import(...)`。
- 第三方库按需引入，禁止全量导入大型库。
- 列表/表格数据量大时使用虚拟滚动或分页，避免一次性渲染大量 DOM。
- 图片、字体等静态资源需有合理的加载策略（懒加载、预加载关键资源）。

### 15.2 localStorage 管理

- key 命名逐步统一为 `sqldev:<module>:<key>`。
- `getItem` / `setItem` / `removeItem` 均应包裹 `try-catch`。
- 单个 key 内容不应超过 100KB。
- 列表类存储必须设上限。
- 存储格式变更必须有版本号或迁移逻辑。

### 15.3 请求优化

- fetch 请求必须设置超时（建议 15-30s）。
- 重复请求必须有防抖/去重机制。
- 大型请求体必须有体积校验。

### 15.4 响应式设计

#### 15.4.1 适配范围与默认原则

- 本项目为 SQL 开发工具，核心用户为桌面端开发者。新页面和组件默认采用 **desktop-first**：优先保证桌面端信息密度与操作效率，同时确保手机端功能完整可用。
- 面向终端用户的功能（如 splash 首页、反馈组件、紫微斗数页面）可按需采用 mobile-first。
- 手机端功能必须与桌面端对等，用户可在手机上完成完整的 SQL 编辑、转换、配置等操作；不允许”仅缩放可见”的伪适配或只读降级。
- 若页面明确仅桌面端使用（如 DDL 编辑页），需在需求与 PR 中写明不适配移动端的业务理由。

#### 15.4.2 断点与视口基线

| 设备层级 | 宽度范围 | 主要目标 |
|------|------|------|
| 手机 | `375px~767px` | 核心流程可单手操作、单列信息优先 |
| 平板 | `768px~1023px` | 双栏/分栏增强、保留触控友好 |
| 桌面 | `>=1024px` | 信息密度与效率优先（核心按 `1280px+` 优化） |

- 断点优先复用现有 Tailwind 断点与 token，禁止组件内散写”临时 magic breakpoint”。
- Tailwind 默认断点与本规范三级断点的对应关系：

| 规范层级 | Tailwind 前缀 | 宽度 | 使用场景 |
|------|------|------|------|
| 手机 | 无前缀 / `sm:` | `<768px` | 手机竖/横屏，单列布局 |
| 平板 | `md:` | `768px-1023px` | 平板，双栏/分栏增强 |
| 桌面 | `lg:` / `xl:` / `2xl:` | `>=1024px` | 桌面端，信息密度优先 |

- 验收最低视口：`375x812`（手机）、`768x1024`（平板）、`1280x800`（桌面）。
- 至少覆盖：手机竖屏 + 手机横屏 + 平板竖屏（或横屏）各 1 组。

#### 15.4.3 布局与容器规范

- 禁止关键布局依赖固定 `px` 宽高主容器；优先使用 `flex/grid` + `min/max/clamp`。
- 页面主容器应支持内容自适应换行，避免固定列数导致溢出。
- 侧边栏在手机端应收敛为抽屉/折叠菜单，不得强占固定宽度造成主区不可读。
- 顶部/底部固定区域必须考虑安全区域：
  - 使用 `env(safe-area-inset-top/right/bottom/left)`
  - 避免刘海屏、手势条遮挡关键按钮。
- 高度布局优先使用 `dvh/svh` 相关策略，避免移动端浏览器地址栏伸缩导致内容跳动。

#### 15.4.4 组件级适配规范

- **按钮/可点击元素**：移动端热区不小于 `44x44px`。
- **表单**：输入框、下拉、日期选择在手机端保证可直接触控，不依赖 hover 提示。
- **Modal/Drawer**：
  - 手机端优先全宽弹层或底部抽屉。
  - 桌面端可居中弹窗。
  - 打开后必须锁定背景滚动并保证焦点可达。
- **Dropdown/Popover**：必须防止超出可视区，支持自动翻转或滚动容器。
- **表格/Table**：手机端必须提供降级方案，禁止出现”列被截断但不可查看”。降级策略按以下优先级选择：
  - 列数 ≤4 → 横向滚动（保持表格结构，牺牲部分视口宽度）
  - 每行有明确主体标识（如名称、ID、标题）→ 卡片化（每条记录渲染为独立卡片）
  - 列有明确主次之分 → 默认折叠次要列，提供展开查看完整信息
- **卡片/Card**：在小屏下由多列自动降为单列；摘要信息优先展示，次要信息折叠。
- **代码编辑器（CodeMirror）**：手机端必须支持完整的 SQL 输入与编辑。键盘弹出时编辑器视口自动收缩、保持光标可见，避免被键盘遮挡。语法高亮和代码补全在手机端保持开启；如低端设备性能不足，可降级关闭语法高亮但保留编辑能力。

#### 15.4.5 导航与信息架构

- 手机端导航不超过两层可见深度，避免多级悬浮菜单。
- 桌面端“顶部 + 侧边栏”组合在手机端需简化为单入口导航（抽屉、底栏或分段导航）。
- 面包屑在手机端可收敛为“返回 + 当前标题”模式，减少首屏占用。

#### 15.4.6 触控交互与可访问性

- 禁止关键功能只绑定 hover；移动端必须有 click/tap 等效路径。
- 长列表需支持自然滚动与惯性滚动，避免嵌套滚动冲突。
- 文字、图标、按钮在小屏下仍需满足可读性与对比度要求（遵循 §21.5）。
- 键盘弹起（输入场景）时，表单底部操作按钮不得被遮挡。

#### 15.4.7 移动端性能约束

- 移动端首屏优先加载核心路径，非首屏模块延迟加载。
- 避免在手机端首屏一次性渲染超长列表；使用分页/虚拟列表。
- 图片资源提供响应式尺寸，避免把桌面大图直接下发到手机。
- 弱网场景（如 4G）下关键操作必须有 loading 与失败重试提示。

#### 15.4.8 实施与验收清单

- PR 描述中必须说明：本次改动影响的断点区间和降级策略。
- 新增页面或重大布局重构时，附手机、平板、桌面各 1 张截图（共 3 张）。常规 UI 调整（文案、间距、颜色微调）仅需验证实际影响的断点，不强制三端截图。
- 涉及复杂交互（弹窗、下拉、表格）时，必须说明手机端行为差异。
- 若明确”仅桌面”，需在需求与 PR 中写明不适配移动端的业务理由。

### 15.5 构建产物与缓存

- 使用 Vite hash 文件名作为缓存破坏机制。
- 禁止手工维护 `app.20260422a.js`、`style.20260422a.css` 等版本文件。
- 禁止手写资源 `?v=` 版本参数。
- 发布时以 `pnpm build` 生成的 `dist/` 为准。

---

## 16. 编辑器组件规范

### 16.1 SQL 编辑器

SQL 编辑器使用 CodeMirror 6：

```vue
<!-- src/components/business/workbench/components/SqlEditor.vue -->
```

**核心特性**：
- 语法高亮：支持 Oracle/PLSQL、MySQL、PostgreSQL 方言
- 行号与代码折叠
- SQL 关键字自动补全（100+ 关键字）
- 深色/浅色主题自动跟随系统
- 搜索（Ctrl/Cmd+F）
- 多选、括号匹配

**依赖**：
```bash
pnpm add @codemirror/state @codemirror/view @codemirror/commands \
  @codemirror/language @codemirror/autocomplete @codemirror/lang-sql \
  @codemirror/search @codemirror/lint
```

**Props**：
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `modelValue` | `string` | - | 编辑器内容 |
| `readonly` | `boolean` | `false` | 只读模式 |
| `language` | `'oracle' \| 'mysql' \| 'postgresql' \| 'sql'` | `'sql'` | SQL 方言 |

**事件**：
| 事件 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `value: string` | 内容变化 |
| `submit` | - | Ctrl/Cmd+Enter 提交 |

### 16.2 编辑器主题配置

CodeMirror 6 使用 `EditorView.theme()` 自定义样式：

- 浅色主题：`lightTheme`
- 深色主题：`darkTheme`
- 主题通过 `prefers-color-scheme` 媒体查询自动跟随系统，同时支持手动覆盖

---

## 17. Workbench 模块结构

### 17.1 目录组织

```
src/components/business/workbench/
├── WorkbenchApp.vue          # 工作台根容器
├── WorkbenchSidebar.vue      # 侧边栏导航
├── WorkbenchHeader.vue       # 顶部栏
├── WorkbenchActionBar.vue    # 操作工具栏
├── DbPicker.vue              # 数据库选择器
├── components/
│   └── SqlEditor.vue         # SQL 编辑器
├── modals/
│   ├── AlertModal.vue        # 提示弹窗
│   └── ConfirmModal.vue      # 确认弹窗
└── pages/
    ├── DdlPage.vue          # DDL 翻译页
    ├── FunctionPage.vue     # 函数翻译页
    ├── ProcedurePage.vue    # 存储过程翻译页
    ├── IdToolPage.vue       # 证件工具页
    ├── ZiweiPage.vue        # 紫微斗数页
    └── RulesPage.vue        # 规则管理页
```

### 17.2 状态管理

工作台状态统一由 `src/stores/workbench.ts` (Pinia) 管理：

```typescript
// 当前页面
activePage: WorkbenchPage

// DDL 状态
sourceDb, targetDb, inputDdl, outputDdl

// 函数/过程状态
funcSourceDb, funcTargetDb, funcInput, funcOutput
procSourceDb, procTargetDb, procInput, procOutput

// ID 工具状态
idProvinceCode, idCityCode, idCountyCode, idGeneratedNumber

// 紫微斗数状态
ziweiChart, ziweiAiResult, ziweiAiQuestionInput

// Rules 状态
ddlRules, bodyRules
```

### 17.3 页面组件约定

- 页面组件放 `pages/` 目录
- 每个页面使用 `useWorkbenchStore()` 访问状态
- 复杂交互逻辑抽取为 `composables/`
- 可复用 UI 抽取为 `components/`

---

## 18. Vite 与 TypeScript 规范

- 环境变量必须通过 `import.meta.env.VITE_*` 访问。
- `src/env.d.ts` 负责扩展 `ImportMetaEnv`（新增变量时同步更新）。
- 客户端类型引用使用 Vite 推荐方式。
- 禁止在客户端使用 Node.js 专属全局对象。
- 静态资源优先使用 Vite 资源导入或 `new URL('./asset', import.meta.url).href`。
- 优先使用 `unknown` 表达未知输入，再通过类型守卫收窄。
- 函数参数和导出的返回值必须显式标注类型。
- 类型断言 `as` 仅在有充分理由时使用，优先写类型守卫。

---

## 19. 命名约定

| 类型 | 规则 | 示例 |
|------|------|------|
| Vue 组件文件 | PascalCase | `AppHeader.vue` |
| composable 文件 | camelCase + `use` 前缀 | `useAuth.ts` |
| feature 文件 | kebab-case | `column-parsers.ts` |
| 测试文件 | kebab-case | `ddl-column-parsers.mjs` |
| 组件名 | PascalCase | `FeedbackWidget` |
| composable 函数 | camelCase + `use` 前缀 | `useAsyncState()` |
| Pinia store | `use` + 名称 + `Store` | `useAuthStore()` |
| CSS class | kebab-case | `workbench-container` |
| Error code | snake_case | `rate_limited` |
| 环境变量 | SCREAMING_SNAKE | `VITE_SUPABASE_URL` |

---

## 20. 禁止项清单（高优先级）

### 代码层

- 禁止输出 Vue 2 语法。
- 禁止引入 Vuex。
- 禁止使用裸 `any`。
- 禁止无类型 API 返回。
- 禁止把业务 SQL 直接散落在组件内。
- 禁止跳过错误处理与空状态处理。
- 禁止空 `catch {}`。
- 禁止未经评审引入新的第三方依赖。

### 安全层

- 禁止在前端暴露 `service_role`。
- 禁止建议关闭 RLS 作为长期方案。
- 禁止在错误响应中泄露内部实现细节。
- 禁止只做前端权限隐藏而缺少服务端鉴权。

### 样式层

- 禁止在新 Vue UI 中直接写硬编码颜色，应使用 Tailwind token 或 `var(--token)`。
- 禁止随意新增间距值，优先使用 spacing token。
- 禁止在组件中硬编码面向用户的错误文案字符串。

### 配置层

- **禁止在代码中硬编码可配置的值**。凡是可以变化的参数，必须优先选择以下方式之一：
  - **环境变量**（`import.meta.env.VITE_*` / `Deno.env.get()`）：适用于部署时确定的值（URL、密钥、开关）。
  - **后端配置表**（如 `ai_providers`、`ai_configs`）：适用于需要运行时管理、跨用户共享或用户自定义的值（供应商列表、模型参数、Prompt 模板）。
  - **Supabase Secrets**：适用于服务端私密配置（API Key、CORS 来源、限流参数）。
- 以下场景**必须**走配置而非硬编码：
  - AI 供应商列表、模型列表、默认 Base URL → 后端配置表
  - System Prompt / AI 模板 → Supabase Secrets 或后端配置表
  - CORS 来源、限流参数、邮箱白名单 → Supabase Secrets
  - 超时时间、重试次数、大小限制 → 环境变量或后端配置表
  - 错误文案、UI 提示语 → `error-map.ts` 集中管理（非硬编码在组件中）
- 判断标准：**如果一个值在未来可能需要修改，那它就不应该写死在代码里。**
- **配置优先级**：`app_configs` 表 > Supabase Secrets > 环境变量 > 代码默认值。当同一配置项存在于多处时，以 `app_configs` 表为准。运行时配置统一走 `app_configs` 表读取。

---

## 21. UI/UX 视觉与交互规范

> 目标：对齐 2026 年主流 SaaS / AI 产品：简洁、通透、层次清晰、动效克制、信息密度合理。

### 21.1 设计关键词

- 简洁（Simple）
- 通透（Clean / Airy）
- 高级灰（Neutral-first）
- 强层次（Clear hierarchy）
- 弱分割（少边框，靠留白和对比建立结构）
- 微动效（Subtle motion）
- 强可读性（Readable first）

### 21.2 视觉语言基线

- 使用「中性色 + 单一品牌色 + 功能色」体系。
- 避免大面积高饱和颜色。
- 支持浅色/深色双主题，跟随系统模式必须监听 `prefers-color-scheme` 变化。
- 圆角统一：卡片 `14px`，按钮/控件 `10px`（对应 `--radius-card: 14px`, `--radius-control: 10px`）。
- 采用 8pt 栅格系统（4/8/12/16/24/32/48）。
- 正文优先 `14px/16px`，行高 `1.5~1.7`。

### 21.3 组件风格要求

> 以下为非穷举列表，其他通用 UI 模式（Toast/Notification、Tooltip、Tabs、Table 等）同样适用本节的统一规范。

- **Button**：必须提供 `hover / active / disabled / loading / focus-visible` 状态。统一尺寸等级（S/M/L）、类型（primary/secondary/danger/ghost）。禁止在业务页面随意新增"特例按钮样式"。
- **Card**：固定为 `标题区 + 内容区 + 操作区（可选）`。统一边框、背景、圆角、阴影、悬停反馈。卡片交互（可点/不可点）必须有明确视觉区分。
- **Form**：必须有 label、错误提示、提交反馈。
- **Table/List**：必须有 loading / empty / error 状态。
- **Modal/Drawer**：必须支持 ESC 关闭、焦点回收（危险操作除外）。统一复用基础弹窗（如 `BaseModal`），包含遮罩、ESC 关闭、焦点管理、可访问语义。禁止每个业务弹窗重复实现遮罩和关闭逻辑。危险操作需二次确认。
- **Dropdown/Select**：统一下拉容器、选中态、悬停态、禁用态。必须支持点击外部关闭、键盘可达性（至少 Enter/Escape/上下键）。下拉项文案过长统一省略策略（ellipsis + title）。
- **Scrollbar**：使用统一 scrollbar token（轨道、滑块、悬停态）。样式需覆盖滚动容器，不允许每页单独定义一套配色。横向滚动仅在确有必要时启用，并给出可见提示。

### 21.4 交互体验

- 动效时长建议 `150ms ~ 280ms`，缓动使用 `ease-out`。
- 所有用户操作必须有反馈。
- 危险操作必须二次确认。
- 点击热区不小于 `44x44px`（详见 §15.4.4）。
- 键盘可达，焦点样式可见。

### 21.5 可访问性

- 文本与背景对比度满足 WCAG AA（普通文本 ≥ 4.5:1，大文本 ≥ 3:1）。
- 所有 icon button 必须有 `aria-label`。
- 表单元素必须绑定 `<label>`，关联 `for` / `id`。
- 不仅靠颜色传达状态，必须辅以图标、文字或 `aria-live` 提示。
- 动态内容变化使用 `aria-live="polite"` 区域通知屏幕阅读器。
- Modal 打开时焦点必须移入，关闭时焦点必须回收到触发元素。
- 尊重 `prefers-reduced-motion`：当用户开启减弱动态效果时，禁用或简化过渡动画。
- Tab 顺序必须符合视觉流，禁止正 `tabindex` 值。

### 21.6 视觉硬规格（新增）

#### 21.6.1 字体层级（Typography Scale）

| Token | 建议值 | 用途 |
|------|--------|------|
| `--text-xs` | 12px / 1.4 | 辅助说明、元信息 |
| `--text-sm` | 13px / 1.45 | 次要正文、表格次级文本 |
| `--text-base` | 14px / 1.5 | 主体正文、表单内容 |
| `--text-md` | 16px / 1.5 | 强调正文、卡片标题 |
| `--text-lg` | 18px / 1.4 | 区块标题 |
| `--text-xl` | 20-24px / 1.3 | 页面主标题 |

#### 21.6.2 间距层级（Spacing Scale）

- 统一 8pt 体系：`4 / 8 / 12 / 16 / 24 / 32 / 48`。
- 小组件内部间距优先 `8/12`；区块级优先 `16/24`；页面级留白优先 `24/32/48`。
- 禁止新增“孤立像素值”（如 13px、22px）破坏节奏，除非有明确对齐理由并写注释说明。

#### 21.6.3 层级规范（z-index Ladder）

| 场景 | 推荐层级 |
|------|---------|
| 常规内容层 | `0-10` |
| 吸顶/固定头部 | `100` |
| 右侧悬浮入口（FAB） | `130` |
| 下拉菜单/Popover | `1000+` |
| 全屏遮罩（Overlay） | `10030` |
| 模态框主体（Modal/Dialog） | `10040+` |
| 全局通知（Toast） | `11000+` |

> 建议在 `tokens.css` 中定义 `--z-*` 语义变量，组件禁止散写魔法数字层级。

#### 21.6.4 动效规范（Motion Tokens）

| Token | 建议值 | 用途 |
|------|--------|------|
| `--duration-fast` | 120-160ms | 按钮 hover、轻量状态反馈 |
| `--duration-normal` | 180-240ms | 下拉、抽屉、小型过渡 |
| `--duration-slow` | 280-360ms | 模态、页面切换、结构性动画 |
| `--ease-standard` | `ease-out` | 默认过渡 |
| `--ease-emphasis` | `cubic-bezier(0.22, 1, 0.36, 1)` | 强调型入场 |

- 动效优先“短、稳、克制”，避免连续弹跳和眩晕感动画。
- 必须兼容 `prefers-reduced-motion`，提供降级路径。

---

## 22. Design Token 执行规则

1. 新增样式优先使用 `src/styles/tokens.css` 中的 token。
2. Vue 模板（`<template>`）优先使用 Tailwind 语义类（`bg-panel`, `text-brand-500`, `rounded-control`）；组件样式（`<style>`）优先使用 CSS 变量（`var(--color-border)`）。
3. 禁止随意新增颜色、圆角、阴影、间距值。
4. 新组件必须兼容 light/dark。
5. 所有可交互元素必须有 focus-visible 态。
6. 页面必须覆盖 loading / empty / error / success 四态。
7. 高端感优先通过留白、层次、字重、弱边框、克制动效实现。

### 22.1 Canvas / 海报生成例外

- Canvas 无法直接可靠使用 CSS 变量时，必须把颜色提取为文件顶部命名常量。
- 深浅主题必须有对应常量集。
- 禁止在绘制函数内部散写 hex 颜色值。

---

## 23. 安全检查清单

涉及接口、认证、AI、上传、数据库变更时必须检查：

- CORS 是否只放行必要 origin。
- JWT / token 是否在服务端校验。
- RLS 是否开启并有策略。
- 请求体是否有大小、深度、结构校验。
- 是否有速率限制或配额。
- 错误是否脱敏。
- 日志是否避免泄露 token / SQL / 上游原始报文。
- 前端权限隐藏是否有服务端校验兜底。
- 是否需要更新 `FUNCTION-AUTH-STRATEGY.md` 或安全文档。

---

## 24. 任务验收标准

### 24.1 每次任务完成后必须输出以下三项

1. **文件清单与概要说明**：新增/修改/删除的文件及其用途。
2. **前后端部署步骤和 SQL 执行步骤**（如有）。
3. **更新 `docs/CONTEXT_FULL.md`**：记录本次变更摘要。

### 24.2 提交前自检清单

1. 是否出现重复开发（组件/逻辑/样式）？
2. 是否全部使用了 token 和统一组件规范？
3. 是否补齐关键注释（复杂逻辑的 WHY）？
4. SQL 变更是否遵守分层策略：未上线迁移优先更新原文件；已上线迁移只做增量，并准备回滚方案？
5. 是否保持前后端配置一致、错误提示一致、权限校验一致？
6. 是否补充了对应的单元测试/集成测试并通过 `pnpm verify`？
7. 新页面/组件是否支持浅色/深色主题和主流分辨率？
8. 项目新增或删除文件时，是否同步更新了 `docs/AI_DEV.md` 的目录结构说明？

### 24.3 验收确认

- 是否影响现有页面布局和视觉效果。
- 是否需要部署 Edge Function。
- 是否需要执行数据库 migration。
- 是否需要更新 Supabase Secrets。
- 是否新增/更新测试，并纳入 `pnpm test` / `pnpm verify`。
- 是否存在回滚风险或缓存发布注意事项。
- 本地至少运行相关测试；重要改动运行 `pnpm verify` 和 `pnpm build`。

---

## 25. CSP 与安全运维

- SQL 编辑器使用 CodeMirror 6，无需 `unsafe-eval`。
- 新增 Vue 页面禁止引入需要 `unsafe-eval` 的依赖。
- CSP 策略变更必须经过安全评审。
- Supabase 函数部署后必须用真实登录态验证 2xx / 4xx / CORS 行为。

---

## 26. 工具链强制执行清单

| 规范条目 | 当前执行方式 | 配置位置 | 优先级 |
|---------|-------------|---------|--------|
| 禁止裸 `any` | ESLint TypeScript 规则 | `eslint.config.mjs` | ✅ 已启用 |
| TypeScript 严格模式 | `vue-tsc --noEmit` | `tsconfig*.json` | ✅ 已启用 |
| 代码格式 | Prettier / ESLint | `prettier.config.cjs` / `eslint.config.mjs` | ✅ 已启用 |
| UTF-8 编码 | `pnpm check:utf8` | `scripts/check-utf8.mjs` | ✅ 已启用 |
| 完整验证 | `pnpm verify` | `package.json` | ✅ 已启用 |
| 函数 ≤80 行 | 文档约束，待配置 ESLint `max-lines-per-function` | `eslint.config.mjs` | P1 - 下个迭代 |
| Commit message 格式 | 文档约束，待引入 commitlint + husky | `commitlint.config.js` | P2 - 择机引入 |
| CSS 禁止硬编码颜色 | 文档约束，待引入 Stylelint | `.stylelintrc.json` | P2 - 择机引入 |

> P1 = 下个迭代必须落地；P2 = 工程治理阶段择机引入。当前不得误写为已自动执行。

## 27. CI/CD 流程规范

### 27.1 本地开发验证

每次提交前必须运行完整验证：

```bash
pnpm typecheck    # TypeScript 类型检查
pnpm lint         # ESLint 代码风格检查
pnpm check:utf8   # UTF-8 编码校验
pnpm test         # 单元测试
pnpm build        # 构建验证
```

或使用一键验证：

```bash
pnpm verify
```

### 27.2 Git Hooks（待引入）

- **pre-commit**：格式化代码、检查 lint（需引入 husky + lint-staged）
- **commit-msg**：验证 commit message 格式（需引入 commitlint）
- **pre-push**：运行测试套件（需引入 husky）

### 27.3 CI 门禁（GitHub Actions / GitLab CI）

CI 流水线应包含以下阶段：

1. **Install & Cache**：安装依赖，利用缓存加速
2. **Lint**：ESLint + Prettier 检查
3. **Type Check**：TypeScript 类型检查
4. **Test**：单元测试与集成测试
5. **Build**：生产构建验证
6. **Smoke Test**（可选）：关键路径冒烟测试

```yaml
# .github/workflows/ci.yml 示例结构
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify
```

### 27.4 CD 部署（Edge Functions）

Supabase Edge Functions 部署：

```bash
# 部署单个函数
supabase functions deploy <function-name>

# 部署所有函数
supabase functions deploy

# 部署并设置 secrets
supabase secrets set KEY=value --project-ref <project-ref>
```

> **注意**：前端部署使用 Vercel / Netlify / GitHub Pages；Edge Functions 通过 Supabase CLI 管理。

---

## 28. 版本演进原则

- 优先兼容当前项目已安装依赖版本。
- 不随意引入新库，先复用现有栈。
- 涉及升级（Vue / Supabase SDK / Vite / Tailwind）时，先给迁移清单，再改代码。
- 引入新依赖必须说明体积、维护状态、安全风险和替代方案。
