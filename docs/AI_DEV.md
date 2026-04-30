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
- TailwindCSS + Design Token。新 Vue SFC UI 优先使用 Tailwind/token；全局样式、token 文件、legacy 迁移样式除外
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

1. 默认使用 `<script setup lang="ts">`。
2. 禁止使用 Vue 2 Options API（`data` / `methods` / `created`）。
3. 禁止引入 Vuex（状态管理统一 Pinia）。
4. 新代码禁止使用裸 `any`。如确需使用，必须添加 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 并注释原因。
5. 涉及 Supabase 的功能，必须区分：
   - 前端可做：用户态查询（受 RLS 限制）
   - 服务端做：管理员权限、敏感写操作、第三方密钥、AI 请求（Edge Function）
6. 实际执行型任务优先直接改代码并验证；总结时说明变更文件、验证结果、是否需要部署。
7. 方案型/说明型任务需要包含：实现方案、变更文件、关键代码或完整代码、Supabase 变更、验证步骤、风险。
8. 前端响应式状态优先使用 `ref`，复杂对象再使用 `reactive`，禁止随意解构导致响应式丢失。

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
│   │   └── ziwei-analysis/        # 紫微 AI 分析服务
│   ├── FUNCTION-AUTH-STRATEGY.md  # 函数鉴权策略说明
│   ├── SECURITY-CHECKLIST.md      # 安全检查辅助文档
│   ├── feedback-schema.sql        # 反馈表辅助 SQL
│   ├── rls-audit.sql              # RLS 审计辅助 SQL
│   └── config.toml                # Supabase 本地 CLI 配置
├── src/
│   ├── api/                       # Edge Function 请求封装
│   ├── components/
│   │   ├── common/                # 基础 UI
│   │   ├── business/              # 业务组件
│   │   └── layout/                # 布局组件
│   ├── composables/               # Vue 组合式函数
│   ├── features/                  # 功能模块（优先纯逻辑）
│   │   ├── ddl/                   # DDL 解析与转换
│   │   ├── routines/              # 函数/过程解析与转换
│   │   ├── rules/                 # 规则引擎与持久化
│   │   ├── sql/                   # SQL 文本处理
│   │   ├── convert/               # 转换错误映射
│   │   ├── browser/               # 文件下载与剪贴板（当前含少量 DOM，待迁移）
│   │   ├── id-tools/              # 证件号码工具
│   │   ├── navigation/            # 路由解析与重定向保护
│   │   ├── preferences/           # 偏好存储
│   │   └── ziwei/                 # 紫微 AI / 历史 / 分享
│   ├── layouts/                   # 全局布局
│   ├── legacy/                    # 遗留 UI 运行文件（iframe 模式）
│   ├── lib/                       # 第三方库实例化
│   ├── pages/                     # 路由页面
│   ├── router/                    # 路由配置与守卫
│   ├── stores/                    # Pinia 状态管理
│   ├── styles/                    # CSS Token + Tailwind 组件层
│   ├── types/                     # TypeScript 类型定义
│   └── utils/                     # 通用工具函数
├── tests/                         # Node .mjs 测试
├── scripts/
│   ├── check-utf8.mjs             # UTF-8 编码校验
│   └── smoke.mjs                  # Smoke 入口代理
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

---

## 8. 前端数据访问规范

1. 所有 Supabase / Edge Function 请求统一封装到 `src/api/*.ts` 或 `src/composables/*.ts`。
2. 页面组件只调用封装函数，不直接拼复杂查询。
3. 异步请求必须处理 `loading / success / error` 三态。
4. 列表页必须考虑空状态（empty state）。
5. fetch 请求必须使用 `src/api/http.ts` 的统一封装，包含超时与 token 刷新。

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
export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E; code?: string }
```

### 11.2 用户侧错误文案

- 面向用户的错误文案集中管理在 `src/utils/error-map.ts` 或各 feature 的 `error-map.ts` 中。
- 禁止在组件或 composable 中散写错误文案。
- 错误文案必须告诉用户如何处理，而非只说"出错了"。

### 11.3 日志策略

- 开发环境：`console.error` 输出完整错误。
- 生产环境：至少不能静默吞错；后续可接入监控。
- 禁止空 `catch {}`，至少记录错误或返回结构化失败。

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

- 关键入口、路由、legacy bridge 的存在性。
- `src/features/*/index.ts` 的 barrel 导出完整性。
- `src/features/*/legacy-bridge.ts` 的 `window.*` 挂载断言。
- 安全与架构关键约束（如 CORS env、redirect sanitizer、iframe sandbox）。

---

## 13. 代码风格与质量门槛

- 单个函数建议不超过 80 行；超过必须优先拆分。
- Vue 组件 `<script>` 部分不超过 150 行；超过必须抽取 composable 或无状态子组件。
- 复杂正则表达式必须提取为命名常量并添加注释说明意图。
- 可复用逻辑放 `composables` 或 `features`，可复用类型放 `types`。
- **修改已有代码时必须添加变更注释**：
  - 在修改处上方添加 `// [YYYY-MM-DD] 变更原因：具体说明` 格式的注释。
  - 大段重构可在文件头部用块注释说明变更摘要。
  - 示例：

```ts
// [2026-04-29] 新增：支持 Gemini 协议的 AI 请求转发
async function callGeminiAPI(config, messages) { ... }

// [2026-04-29] 修改：超时时间从 15s 调整为 30s，匹配大模型响应特性
const TIMEOUT_MS = 30_000
```

  - 迁移/重构场景下，legacy bridge 中调用新 typed 函数的位置也应标注迁移批次或日期。
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

- 非 legacy 包装的路由页面应优先懒加载：`() => import(...)`。
- legacy 包装页面（仅含 `<LegacyFrameView />`）可保持静态导入。
- 第三方库按需引入，禁止全量导入大型库。

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

### 15.4 构建产物与缓存

- 使用 Vite hash 文件名作为缓存破坏机制。
- 禁止手工维护 `app.20260422a.js`、`style.20260422a.css` 等版本文件。
- 禁止手写资源 `?v=` 版本参数。
- 发布时以 `pnpm build` 生成的 `dist/` 为准。

---

## 16. 绞杀者模式迁移规范

### 16.1 Bridge 编写规则

- 每个迁移中的 `src/features/<module>/` 可包含 `legacy-bridge.ts`。
- Bridge 只做 `window.*` 全局挂载和薄适配，不包含业务逻辑。
- 命名约定：`window.SQLDEV_<MODULE>_UTILS` 或已有命名保持兼容。
- Bridge 必须在 `legacy.html` 中按依赖顺序引用。
- 新增 bridge 必须补 smoke 断言。

### 16.2 Legacy 代码治理

- `src/legacy/` 中禁止新增大功能，仅允许 bugfix、桥接调用、迁移必要适配。
- 新功能必须优先在 `src/features/`、`src/composables/`、`src/pages/` 中实现。
- 迁移完成的函数应由 legacy 调用 typed 版本，后续再删除旧实现。
- 不允许为了快速实现继续扩大 legacy 文件复杂度。

### 16.3 iframe 路由共存

- Vue Router 负责主应用 URL。
- `LegacyFrameView` 负责把 Vue route 映射到 `legacy.html#<hashPath>`。
- legacy 内部 hash 路由只能作为过渡层，最终目标是被 Vue pages 替代。

### 16.4 Legacy 废弃策略

- 迁移完成的 legacy 函数标记 `@deprecated` 或从调用链移除。
- 废弃代码不得新增功能或重构，仅修复阻塞 bug。
- 删除 legacy 代码前必须有 feature 测试和 smoke 断言确认 typed bridge 接管。

---

## 17. Vite 与 TypeScript 规范

- 环境变量必须通过 `import.meta.env.VITE_*` 访问。
- `src/env.d.ts` 负责扩展 `ImportMetaEnv`（新增变量时同步更新）。
- 客户端类型引用使用 Vite 推荐方式。
- 禁止在客户端使用 Node.js 专属全局对象。
- 静态资源优先使用 Vite 资源导入或 `new URL('./asset', import.meta.url).href`。
- 优先使用 `unknown` 表达未知输入，再通过类型守卫收窄。
- 函数参数和导出的返回值必须显式标注类型。
- 类型断言 `as` 仅在有充分理由时使用，优先写类型守卫。

---

## 18. 命名约定

| 类型 | 规则 | 示例 |
|------|------|------|
| Vue 组件文件 | PascalCase | `AppHeader.vue` |
| composable 文件 | camelCase + `use` 前缀 | `useAuth.ts` |
| feature 文件 | kebab-case | `column-parsers.ts` |
| 测试文件 | kebab-case | `ddl-column-parsers.mjs` |
| 组件名 | PascalCase | `FeedbackWidget` |
| composable 函数 | camelCase + `use` 前缀 | `useAsyncState()` |
| Pinia store | `use` + 名称 + `Store` | `useAuthStore()` |
| CSS class | kebab-case | `legacy-frame-page` |
| Error code | snake_case | `rate_limited` |
| 环境变量 | SCREAMING_SNAKE | `VITE_SUPABASE_URL` |

---

## 19. 禁止项清单（高优先级）

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

---

## 20. UI/UX 视觉与交互规范

> 目标：对齐 2026 年主流 SaaS / AI 产品：简洁、通透、层次清晰、动效克制、信息密度合理。

### 20.1 设计关键词

- 简洁（Simple）
- 通透（Clean / Airy）
- 高级灰（Neutral-first）
- 强层次（Clear hierarchy）
- 弱分割（少边框，靠留白和对比建立结构）
- 微动效（Subtle motion）
- 强可读性（Readable first）

### 20.2 视觉语言基线

- 使用「中性色 + 单一品牌色 + 功能色」体系。
- 避免大面积高饱和颜色。
- 支持浅色/深色双主题，跟随系统模式必须监听 `prefers-color-scheme` 变化。
- 圆角统一：卡片 `12-16px`，按钮 `10-12px`，输入框 `10px`。
- 采用 8pt 栅格系统（4/8/12/16/24/32/48）。
- 正文优先 `14px/16px`，行高 `1.5~1.7`。

### 20.3 组件风格要求

- Button 必须提供 `hover / active / disabled / loading / focus-visible` 状态。
- Card 固定为 `标题区 + 内容区 + 操作区（可选）`。
- Form 必须有 label、错误提示、提交反馈。
- Table/List 必须有 loading / empty / error 状态。
- Modal/Drawer 必须支持 ESC 关闭、焦点回收（危险操作除外）。

### 20.4 交互体验

- 动效时长建议 `150ms ~ 280ms`，缓动使用 `ease-out`。
- 所有用户操作必须有反馈。
- 危险操作必须二次确认。
- 点击热区不小于 `40x40px`。
- 键盘可达，焦点样式可见。

### 20.5 可访问性

- 文本与背景对比度满足 WCAG AA。
- 所有 icon button 必须有 `aria-label`。
- 表单元素必须绑定 label。
- 不仅靠颜色传达状态。

---

## 21. Design Token 执行规则

1. 新增样式优先使用 `src/styles/tokens.css` 中的 token。
2. 组件模板优先 Tailwind 语义类；CSS 文件优先 `var(--token)`。
3. 禁止随意新增颜色、圆角、阴影、间距值。
4. 新组件必须兼容 light/dark。
5. 所有可交互元素必须有 focus-visible 态。
6. 页面必须覆盖 loading / empty / error / success 四态。
7. 高端感优先通过留白、层次、字重、弱边框、克制动效实现。

### 21.1 Canvas / 海报生成例外

- Canvas 无法直接可靠使用 CSS 变量时，必须把颜色提取为文件顶部命名常量。
- 深浅主题必须有对应常量集。
- 禁止在绘制函数内部散写 hex 颜色值。

---

## 22. 安全检查清单

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

## 23. 任务验收标准

每次任务完成前必须确认：

- 是否影响现有页面布局和视觉效果。
- 是否需要部署 Edge Function。
- 是否需要执行数据库 migration。
- 是否需要更新 Supabase Secrets。
- 是否新增/更新测试，并纳入 `pnpm test` / `pnpm verify`。
- 是否更新 `docs/CONTEXT_FULL.md`（按当前约定记录关键变更）。
- 是否存在回滚风险或缓存发布注意事项。
- 本地至少运行相关测试；重要改动运行 `pnpm verify` 和 `pnpm build`。

---

## 24. CSP 与安全运维

- `legacy.html` 当前可能因遗留依赖需要较宽 CSP，新增 Vue 页面禁止引入需要 `unsafe-eval` 的依赖。
- CSP 策略变更必须经过安全评审。
- 迁移目标：SFC 预编译 + 更现代编辑器方案，逐步收窄 legacy CSP。
- Supabase 函数部署后必须用真实登录态验证 2xx / 4xx / CORS 行为。

---

## 25. 工具链强制执行清单

| 规范条目 | 当前执行方式 | 配置位置 |
|---------|-------------|---------|
| 禁止裸 `any` | ESLint TypeScript 规则 | `eslint.config.mjs` |
| TypeScript 严格模式 | `vue-tsc --noEmit` | `tsconfig*.json` |
| 代码格式 | Prettier / ESLint | `prettier.config.cjs` / `eslint.config.mjs` |
| UTF-8 编码 | `pnpm check:utf8` | `scripts/check-utf8.mjs` |
| 完整验证 | `pnpm verify` | `package.json` |
| 函数 ≤80 行 | 文档约束，待配置 ESLint | 待配置 |
| Commit message 格式 | 文档约束，建议引入 commitlint | 待配置 |
| CSS 禁止硬编码颜色 | 文档约束，建议引入 Stylelint | 待配置 |

> 待配置项是后续工程治理目标，当前不得误写为已自动执行。

---

## 26. 版本演进原则

- 优先兼容当前项目已安装依赖版本。
- 不随意引入新库，先复用现有栈。
- 涉及升级（Vue / Supabase SDK / Vite / Tailwind）时，先给迁移清单，再改代码。
- 引入新依赖必须说明体积、维护状态、安全风险和替代方案。
