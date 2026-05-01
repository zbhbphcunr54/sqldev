# SQDev 项目状态快照与变更记录

> 本文档仅记录项目当前状态和历史变更。协作规则、编码规范请参阅 `AI_DEV.md`。
> 更新频率：每日 17:00 保存一次，或重大变更后即时更新。

Last updated: 2026-04-30

---

## 2026-04-30: Strangler Mode — Homepage Native SFC + Legacy Hardening

- 恢复认证为全局 Vue 弹窗体验：`src/components/business/auth/AuthModal.vue` 承载密码登录、验证码登录、密码注册、验证码重置密码；首页/Header 登录入口不再跳独立登录页，`/login` 仅保留为打开弹窗的兼容入口。
- 修复首页进入工作台白屏：`src/legacy/app.js` 中 ID 工具与 SQL 转换动作模块已按迁移后的 flat options 接口传参，避免 `idProvince` / `convertRemote` 等旧变量缺失导致 Vue setup 崩溃；首页底部 CTA 恢复为登录/注册语义。
- 首页已迁移为原生 Vue SFC：`src/pages/splash/index.vue`，视觉布局保持原首页不变，样式抽离为 `src/pages/splash/splash.css`。
- 工作台继续使用 legacy iframe 过渡方案，但路由同步改为父级 Vue Router 接管：legacy 内部切页通过 `sqldev:navigate-workbench-section` 通知父页面，返回首页通过 `sqldev:navigate-home`。
- `src/legacy/supabase-config.js` 已退役，公开运行时配置统一进入 `src/legacy/runtime-config.js`，并拒绝浏览器暴露 `service_role` / `sb_secret_`。
- `src/legacy/modules/sql-editor-component.js` 已从 template 字符串改为 render function，减少运行时模板编译点；`legacy.html` 的 `unsafe-eval` 仍需等工作台主体 SFC 化后再移除。
- 清理 legacy 关键链路空 `catch`：认证、反馈、本地偏好、启动视图、转换重试、紫微历史读写均补充上下文日志。
- 验证通过：`pnpm test:smoke`、`pnpm test:unit`、`pnpm build`、`pnpm check:utf8`。
- 当前已知工程噪音：`pnpm lint` 为 0 error，但大量历史 CRLF 换行触发 Prettier warning；暂未全仓格式化以避免巨大无关 diff。

## 2026-04-29: AI Config Plan Permission Model Revision

- 修正 `docs/AI_CONFIG_MERGED_PLAN.md` 的 AI 配置权限模型：AI 配置由管理员统一维护，普通登录用户只能进入配置界面查看脱敏后的供应商、模型、激活状态和测试状态。
- `ai_configs` 设计调整为全局配置表：移除用户自维护/每用户上限思路，原始表仅管理员可访问；普通用户通过 `GET /ai-config` 获取不含 `api_key_enc` 的安全摘要。
- `ai-config` Edge Function 设计调整为读写分离：GET 面向登录用户只读，POST/PATCH/DELETE/activate/test 仅管理员可用；`ai-proxy/chat` 使用全局激活配置。
- `ziwei-analysis` 集成策略改为优先使用管理员设置的全局激活配置，未配置时回退项目级环境变量。
- 同步更新 `docs/ai-config-preview-merged.html` 文案：标明“管理员维护 / 普通用户只读”和“全站最多 20 个配置”。

## 2026-04-29: Medium Code Quality Refactor

- DDL 对外入口收敛为 facade：新增 `src/features/ddl/facade.ts`，`src/features/ddl/index.ts` 仅保留 `ddlFacade`、`convertDdlOrchestrated`、`convertDdlOrchestratedResult`，legacy bridge 改为直接引用内部实现，降低公开 API 面积。
- 新增统一类型基础：`src/features/shared/database.ts` 提供 `SupportedDatabase`、`normalizeSupportedDatabase()`、`isSupportedDatabase()`；`src/types/result.ts` 提供 `Result<T, E>`，DDL 编排新增 `convertDdlOrchestratedResult()`，旧字符串 API 保持兼容。
- 删除重复类型入口 `src/types/supabase.ts`，统一从 `src/types/index.ts` 导出数据库类型和通用 Result 类型。
- DDL/Routines 重复逻辑第一轮抽取：约束解析公共返回结构、routine 参数解析、body 拆分、Postgres dollar body 解包、MySQL declare 收集/排序、Postgres metadata 收集等逻辑已下沉到共享 helper。
- 拆分 `parseExtraDdlStatements()` 与 routine generator 内部长逻辑，降低单函数复杂度，同时保留现有转换输出和页面行为。
- Smoke 增加 facade 边界、Result API、重复类型删除、legacy bridge import 边界等防回归断言。
- `pnpm verify` 已通过：typecheck、lint、UTF-8 检查、28 组测试全部通过。

## 2026-04-29: CODEBASE_REVIEW.md 核验修复

- 已核验并修复仍真实存在的低风险项：Vue Router 页面组件改为懒加载、`LegacyFrameView` 增加 iframe loading/error 状态并移除直接硬编码背景、`index.html` / `legacy.html` 补 favicon 与 SPA 入口 SEO/OG 元数据。
- `features/browser/file-actions.ts` 不再直接操作 DOM，新增 `src/utils/browser-dom.ts` 承接 clipboard fallback 与文件下载 DOM 细节，feature 层保留文件名/扩展名纯逻辑。
- 登录页、反馈组件、`useAsyncState` 改用 `mapErrorCodeToMessage()` 集中错误/状态文案；`ziwei/share.ts` 分享海报颜色收敛为命名常量。
- Auth Store 保存 Supabase auth subscription，并暴露 `disposeAuthListener()` 供 HMR/测试场景清理。
- 补充 `supabase/migrations/202604290001_create_profiles.sql`，与 `database.types.ts` 中的 `profiles` 表保持一致，包含 RLS、基础自有数据策略与 `updated_at` 触发器。
- `.env.example` 增加前端环境变量说明与 Edge Function secrets 配置归属说明。
- 修正 `CONTEXT_FULL.md` 中 navigation Batch 17-22 与实际文件不一致的历史记录。
- 已确认部分审查项为旧状态或需专题迁移：fetch 超时、localStorage try-catch、types 重复、主题监听、Edge 认证共享已不存在；CSP `unsafe-eval` 与大体量 legacy/Edge 拆分仍依赖后续 legacy 迁移专题，未在本轮冒险改动。
- `pnpm verify` 与 `pnpm build` 已通过。

## 2026-04-29: P0 Security / Stability Follow-up

- 核验 `src/legacy/auth.js`、`feedback.js`、`bootstrap.js`、`splash.js`、`startup-view.js`：当前优先文件中已无空 `catch {}`，审查项属于旧状态残留。
- Edge Function 响应与日志统一增强：`supabase/functions/_shared/response.ts` 新增 `errorResponse()` 与 `logEdgeError()`，日志会对 Bearer token、apikey、secret 等敏感片段做脱敏截断。
- `convert`、`feedback`、`ziwei-analysis` 均改用共享脱敏日志；用户响应继续只返回安全错误码，不透出上游原始报文。
- `feedback` 增加顶层异常兜底和 rate limit 异常降级，避免非预期异常直接冒泡。
- `verify_jwt = false + 函数内鉴权` 策略保持不变；三个函数继续依赖 `_shared/auth.ts` 的 Bearer token 校验。
- `legacy.html` 的 `unsafe-eval` 未直接移除：当前仍依赖 Vue in-DOM 编译 / CodeMirror 5，需后续作为 legacy SFC / CodeMirror 迁移专题处理。
- `pnpm verify` 与 `pnpm build` 已通过。

## 2026-04-29: P3 Performance / UX Follow-up

- `copyLegacyAssetsPlugin` 改为白名单按需复制 legacy 运行时资源，不再整包复制 `src/legacy/`；构建产物已确认不再包含 `src/legacy/supabase-config.js`。
- Legacy Supabase 配置收敛：删除 `src/legacy/supabase-config.js`，由 `src/legacy/runtime-config.js` 统一注入 `SUPABASE_URL` / `SUPABASE_ANON_KEY` / ZiWei 白名单，并保留浏览器端 secret key 防护。
- `bootstrap.js` 的 authStack 移除 `supabase-config.js`，并补齐 deferred Promise catch 的 warn 日志，避免空吞错误。
- 404 页面重新设计：增加 SQLDev 品牌感、路径状态视觉、返回首页与进入工作台两个 CTA。
- `AuthLayout` / `DefaultLayout` 增加 `page-soft` 轻量页面过渡，动效控制在 180ms，并支持 `prefers-reduced-motion`。
- 新增 `scripts/perf-report.mjs` 与 `pnpm perf:report`，用于本地构建后输出 dist 总量、legacy vendor/runtime 体积和 top assets，后续性能优化可量化对比。
- 本轮构建指标：dist total 2244.0 kB；copied legacy vendor 556.5 kB（7 files）；copied legacy runtime 855.3 kB（11 files）。当前最大体积仍集中在 `src/legacy/app.js`、legacy CSS、Supabase/CodeMirror/Vue legacy vendor。
- `pnpm build` / `pnpm perf:report` / `pnpm verify` 已通过。

## 2026-04-29: P2 Engineering / Testing Follow-up

- 引入 Vitest 作为并行单测入口：新增 `vitest.config.mjs` 与 `pnpm test:unit` / `pnpm test:unit:watch`，现有 `tests/*.mjs` runner 保持不变，避免一次性迁移风险。
- 新增首批 Vitest 单测：`tests/unit/api-http.test.ts` 覆盖请求超时、401、429、500 安全错误映射；`tests/unit/api-convert-feedback.test.ts` 覆盖 `requestConvert()` / `submitFeedback()`；`tests/unit/composables.test.ts` 覆盖 `useAsyncState`、`useAuth`、`useThemeRuntime`。
- `src/api/http.ts` 将 timeout timer 从 `window.setTimeout` 改为 `globalThis.setTimeout`，浏览器行为不变，同时提升 Node/Vitest 可测试性。
- 引入 commitlint + husky：新增 `commitlint.config.cjs` 与 `.husky/commit-msg`，限制提交类型为 `feat/fix/chore/refactor/docs/test`。
- 新增 CSS 硬编码颜色基线检查：`scripts/check-css-colors.mjs`、`scripts/css-color-baseline.json`、`pnpm check:css-colors` / `pnpm check:css-colors:update`，并纳入 `pnpm verify`。
- `pnpm verify` 当前包含：typecheck、lint、UTF-8、CSS 颜色基线、旧 Node runner 28 组测试、Vitest 3 个文件 12 个单测。
- `pnpm verify` 与 `pnpm build` 已通过。

## 当前项目状态总览

### 架构概要

- 前端：Vue 3 + TypeScript + Vite + Pinia + Vue Router + TailwindCSS
- 后端：Supabase（Auth / PostgreSQL / Edge Functions）
- 运行模式：Vue 3 壳应用 + legacy iframe 工作台（绞杀者模式渐进迁移中）
- 部署目标：GitHub Pages（前端）+ Supabase Cloud（后端）

### 页面结构

- 首页（Splash）：产品介绍 + 登录入口
- 工作台（Workbench）：SQL 转换 / 证件工具 / 紫微斗数（通过 legacy iframe 运行）
- 登录页 / 404 页：Vue 3 原生渲染

### Edge Functions（3 个）

| 函数 | 用途 | Auth 策略 | Rate Limit |
|------|------|----------|------------|
| `convert` | SQL DDL/函数/过程转换 | Bearer token → `/auth/v1/user` | userId+IP, 20 req/60s |
| `feedback` | 用户反馈提交 | Bearer token → `/auth/v1/user` | userId+IP, 默认配置 |
| `ziwei-analysis` | 紫微 AI 深度解盘 | Bearer token → `/auth/v1/user` + 邮箱白名单 | userId+IP, 6 req/60s |

> 三个函数均设置 `verify_jwt = false`，在函数内部通过 Supabase Auth API 校验 token。

### 安全配置

- CORS：环境变量配置（`CORS_PRIMARY_ORIGIN` / `CORS_ALLOWED_ORIGINS` / `ALLOW_LOCALHOST_ORIGIN`）
- Rate Limit：Deno KV 持久化（可降级为内存）
- Convert 保护：Content-Length / JSON 深度 / 请求体大小 / rules 体积限制
- Ziwei AI 保护：邮箱白名单（`ZIWEI_ALLOWED_EMAILS`）+ payload 截断
- 错误脱敏：三个函数均不向客户端泄露内部错误详情

### 绞杀者模式迁移进度

已迁移到 `src/features/` 的模块（22 批次完成）：

| 模块 | 覆盖范围 | 状态 |
|------|---------|------|
| `sql/` | SQL 文本切分与格式化 | 完成 |
| `convert/` | 转换错误码映射 | 完成 |
| `browser/` | 剪贴板 / 文件下载 | 完成 |
| `id-tools/` | 身份证 / USCC 算法 | 完成 |
| `preferences/` | 主题 / 编码 / 侧边栏偏好存储 | 完成 |
| `rules/` | DDL/body 规则持久化 + body 规则引擎 | 完成 |
| `ddl/` | 解析 / 约束 / 后处理 / 类型映射 / 输出构造 / 视图 / extra DDL / 主编排 | 完成 |
| `routines/` | 参数解析 / 函数解析 / 过程解析 / 生成器 / 主编排 | 完成 |
| `navigation/` | 路由解析 / 页面状态 / 工作台 UI 状态 / 事件决策 / 路由同步 / 路由应用 | 完成 |
| `ziwei/` | AI payload / 错误处理 / 历史记录 / 展示格式化 / 分享配置 | 完成 |

**尚未迁移的区域**：legacy 中的大段 DOM 操作执行、跨功能运行时耦合块、UI 渲染生命周期绑定。

---

## UI/产品方向（锁定）

- 首页与工作台是两个独立界面
- 当前以 `index.html + style.css + app.js` 的视觉呈现为基线，不做破坏式改版
- 仅允许非破坏性美化（字体、间距、对齐、对比度、动效顺滑度），不得改变信息架构与主要交互路径
- 侧边栏交互：hover 展开 → 点击导航 → 离开收起，无汉堡按钮

### 工作台路由（hash-path）

```
#/workbench/ddl
#/workbench/function
#/workbench/procedure
#/workbench/id-tool
#/workbench/ziwei
#/workbench/rules
#/workbench/body-rules
```

---

## 关键文件索引

### 前端核心

- `src/main.ts` — Vue 应用入口
- `src/App.vue` — 根组件（布局切换）
- `src/router/index.ts` — 路由定义
- `src/router/guards.ts` — 路由守卫
- `src/stores/auth.ts` — 认证状态
- `src/stores/app.ts` — 主题状态
- `src/lib/supabase.ts` — Supabase 客户端
- `src/styles/tokens.css` — Design Token
- `src/styles/main.css` — Tailwind 组件层

### Legacy 运行文件

- `src/legacy/app.js` — 工作台主逻辑
- `src/legacy/auth.js` — 认证逻辑
- `src/legacy/bootstrap.js` — 启动引导
- `src/legacy/splash.js` — 首页逻辑
- `src/legacy/startup-view.js` — 启动视图选择
- `src/legacy/style.css` — 工作台样式

### Supabase

- `supabase/functions/convert/index.ts`
- `supabase/functions/feedback/index.ts`
- `supabase/functions/ziwei-analysis/index.ts`
- `supabase/functions/_shared/` — 共享工具（auth / cors / rate-limit / response）
- `supabase/migrations/202604230001_create_feedback_entries.sql`
- `supabase/config.toml`

---

## 运维备忘

- Supabase 函数环境变量：`supabase secrets set ... --project-ref <ref>`
- `service_role` 严禁出现在前端代码中
- 所有业务表必须启用 RLS
- Gateway `verify_jwt = false`，token 校验在函数内完成（当前生产稳定策略）

---

## 变更记录

### 2026-04-29: Low Engineering Standards Fixes

- ESLint 增强 TypeScript 规则：启用 `@typescript-eslint/no-explicit-any` 与 `@typescript-eslint/no-unused-vars`，并保留 `_` 前缀忽略约定。
- Vite 配置改为 `loadEnv` 驱动：`VITE_DEV_PORT`、`VITE_PREVIEW_PORT` 可配置，`staging` 或 `VITE_BUILD_SOURCEMAP` 开启 sourcemap。
- 新增 `tests/run-all.mjs` 统一 Node 测试运行器，`pnpm test` 收敛为单入口，`pnpm verify` 复用该入口。
- Legacy splash 的 `auth:login-success` 监听改为 `{ once: true }`，降低 HMR/重复初始化场景的重复触发风险。
- DDL column / extra-ddl 复杂正则提取为命名常量并补充意图注释；Smoke 增加对应防回退断言。
- `pnpm verify` / `pnpm build` 已通过。

### 2026-04-29: Medium Database / Backend Fixes

- Feedback migration 增加常用分析/限流索引：`category`、`source`、`client_ip`、`(user_id, created_at desc)`。
- Convert Edge Function 增加 `validateEngineModuleShape()`，动态导入 `app-engine.js` 后校验 converter 导出是否为函数，避免仅靠 `as` 类型断言。
- Smoke 增加 feedback 索引与 convert engine shape guard 断言；`typecheck` / `lint` / `test:smoke` / `check:utf8` / `build` 已通过。

### 2026-04-29: Medium Vue Frontend Best-Practice Fixes

- App Store 去除 DOM / localStorage / matchMedia 副作用，新增 `useThemeRuntime()` 负责主题持久化、系统主题监听和 `document.documentElement` 应用。
- FeedbackWidget 提交失败增加 `ApiError` 分类提示和 `console.error` 日志，避免吞错。
- WorkbenchSidebar 改用 `RouterLink exact-active-class`，替代脆弱的 `route.path === item.to` 字符串比较。
- `.btn-primary` / `.btn-secondary` 增加 `focus-visible` ring 与 offset，提升键盘可达性。
- 增加 smoke 断言覆盖主题边界、反馈错误处理、侧边栏 active 机制和按钮 focus 态；`typecheck` / `lint` / `test:smoke` / `build` / `check:utf8` 已通过。

### 2026-04-29: AI_DEV 规范文档综合修订

- 综合 `AI_DEV_REVIEW.md` 与补充评审意见，重写 `docs/AI_DEV.md` 为项目当前最高开发规范。
- 修正与仓库事实不一致的描述：AI 助手泛化、fetch 统一封装、Supabase 类型桶、`pnpm test` / `pnpm verify`、CORS 逗号分隔、工具链待配置状态。
- 新增/强化：环境变量分层、Edge Function 设计规范、AI 接入规范、绞杀者模式迁移规范、Vite/TypeScript 规范、命名约定、安全检查清单、任务验收标准、CSP 与缓存治理。
- `pnpm check:utf8` 已通过。

### 2026-04-29: Critical Security Fixes

- 修复 legacy JWT 过期判断：无效 `exp` 统一视为已过期，避免畸形 token 被当作可用 token。
- Feedback Edge Function CORS 改为读取 `CORS_PRIMARY_ORIGIN` / `CORS_ALLOWED_ORIGINS` / `ALLOW_LOCALHOST_ORIGIN`，与 convert / ziwei-analysis 保持一致。
- ZiWei AI Edge Function 增加命盘请求体结构校验，缺少核心 center / palaces 证据时直接返回安全错误，不再消耗上游 AI。
- 新增内部 redirect 白名单清洗工具，登录页和路由守卫统一拒绝外部 URL / 协议相对 URL / 编码反斜杠跳转。
- 增加 navigation redirect、ZiWei AI error、smoke 覆盖；`verify` / `build` 已通过。

### 2026-04-29: High Architecture Hardening

- Auth Store 初始化改为 `initPromise` 串行化，`loading` 仅由 `initAuth` 生命周期控制，auth state callback 只同步 session/user。
- HTTP Edge Function 客户端增加 `AbortController` 超时，支持 `VITE_API_TIMEOUT_MS`，并在 token 临近过期时调用 `refreshSession()`。
- Legacy iframe 增加 `sandbox="allow-same-origin allow-scripts allow-forms"`，减少 legacy 页面对顶层页面的能力暴露。
- Vue 入口注册全局 `app.config.errorHandler`，记录运行时错误并显示友好提示。
- 增加 smoke 断言覆盖以上架构约束；`lint` / `typecheck` / `test:smoke` / `build` 已通过。

### 2026-04-27: Strangler Mode Batch 17-22 — Navigation typed bridge 收敛

- 当前实际保留的 typed navigation 模块为 `legacy-route.ts`、`legacy-bridge.ts`、`redirect.ts`、`index.ts`。
- 已完成 legacy 路由解析与登录 redirect 白名单清洗，legacy 侧通过 `window.SQLDEV_ROUTE_UTILS` 委托 typed bridge。
- 原计划中的页面状态、工作台状态、路由同步等更细模块未落地为独立文件，后续如继续迁移再按实际代码补充记录。

### 2026-04-27: Strangler Mode Batch 16 — Routine Conversion Orchestration

- 新增 `src/features/routines/conversion-orchestrator.ts`
- `convertFunction()` / `convertProcedure()` 主编排已进入 typed 层
- Routine 链完整覆盖：解析原语 → 函数/过程解析器 → 生成器 → 主编排

### 2026-04-24: Strangler Mode Batch 5-15 — DDL / Routines / Rules / Preferences 全链路

- DDL 完整链：IR 工厂 → 列解析 → 约束解析 → 后处理 → 类型映射 → 输出构造 → 视图解析/生成 → Extra DDL → 主编排
- Routines 基础链：参数解析原语 → 函数/过程解析器 → header 工具
- Rules：body 规则分类 / 参数类型映射 / body 变换
- Preferences：主题 / 编码 / 侧边栏 / lastView 存储
- Ziwei：分享链接与海报配置
- 启动层偏好统一为 `preferences-runtime.js`

### 2026-04-24: Strangler Mode Batch 1-4 — 基础工具迁移

- SQL 文本处理（splitSqlStatements / formatSqlText）
- Convert 错误映射（mapConvertErrorMessage）
- 浏览器工具（clipboard / file download）
- Ziwei AI（payload 构建 / 错误解析 / 限流判断）
- Navigation 路由解析（normalizeRoutePath / parseRouteInfo）
- Ziwei 历史记录（load / save / label / push）
- Ziwei 展示（时间格式化 / 持续时间 / 乱码检测 / 建议归一化）
- Rules 持久化（DDL / body 规则 localStorage 读写）

### 2026-04-23: Vue 3 工程基线落地

- 按 AI_DEV.md 规范建立完整 Vue 3 + TS + Vite 工程结构
- Legacy UI 文件收敛到 `src/legacy/`，`index.html` 引用路径统一
- Vite 构建支持 `copyLegacyAssetsPlugin`
- Layouts / Guards / Pages / Components / Types / Stores 目录治理完成

### 2026-04-22: 安全与性能加固

- P0：Ziwei 邮箱白名单移至服务端、错误脱敏、convert payload 保护
- P1：Rate limit 升级 Deno KV、首屏速度优化（懒加载 auth 栈）、feedback 本地草稿隐私
- P2：缓存策略从 `?v=` 切换到构建产物 hash

### 2026-04-22: 架构重构启动

- 新增 Vue 3 + TS + Vite 工程基线
- 回滚主界面入口到原 UI（用户要求保持视觉一致）
- 确立"代码重构优先、视觉保持一致"原则

### 2026-04-20—21: ZiWei UI V3

- 三栏布局：左（输入/参数）+ 中（命盘/时间轴）+ 右（AI 分析）
- AI 请求 single-flight guard + 思考耗时显示
- 分享海报功能 + share mode 受限界面
- 429 cooldown guard

### 2026-04-16—17: ZiWei 专业化迭代

- 三方四正 + 飞化追踪 + 流派切换（传统/飞星）
- 白话 + 专业双层解读
- 真太阳时（经度修正 + 时差方程 EoT）
- AI 深度解盘（Supabase Edge Function → AI Provider）
- 工作台 per-page URL 路由
- 启动视图优先读 URL 路由

### 2026-04-15: ZiWei 基础 + ID 工具 + 反馈系统

- 紫微斗数命盘引擎（前端纯算法）
- 身份证 / USCC 生成与校验
- 反馈 FAB + Modal + Edge Function + localStorage 草稿
- 统一滚动条主题
- 区域数据 idle warmup + prefetch
- 转换速度优化（规则缓存 / 结果缓存 / token 短路）

### 更早期

- CORS 环境变量化
- Rate limiting 引入
- Auth token 函数内校验策略确立
- Feedback 表 + RLS + migration
