# SQLDev 项目状态快照与变更记录

> 本文档仅记录项目当前状态和历史变更。协作规则、编码规范请参阅 `AI_DEV.md`。
> 更新频率：每日 17:00 保存一次，或重大变更后即时更新。

Last updated: 2026-05-11

---

## 2026-05-11: 可配置化改造 + CSS 硬编码消除（A1—A7）

### 概述
按照 CODE_REVIEW_FIX_LIST.md 第四章补充建议，将 7 类硬编码阈值/颜色全部改为从 `app_configs` 或 `tokens.css` 读取，实现"不改代码即可调整配置"的目标。

### A1 — 三套限流统一为全局限流

**问题**：ai-chat `(10, 60s)`、ai-config `(30, 60s)`、feedback `(10, 60s)` 各自硬编码，ai-config 测试接口另有独立 `(6, 60s)`。

**修复**：三个 Edge Function 的 `createRateLimiter` 全部改为惰性初始化 `getRateLimiter()`，从 `rate_limit.max_requests`（默认 10）/ `rate_limit.window_ms`（默认 60000）读取；ai-config 测试接口的独立 `testRateLimitMap` 已移除，由全局限流 + 冷却机制覆盖。

### A2 — AI 消息长度 / 会话数可配置

**修复**：`ai-chat/index.ts` 的 `loadChatConfig()` 新增 `maxMessageLength`（默认 4000）/ `maxSessions`（默认 50）；配额 API 响应返回这两个值；前端 `useChat.ts` 暴露 `maxMessageLength`/`maxSessions` ref；`FloatingChat.vue` 文本框绑定 `:maxlength="maxMessageLength"`。

### A3 — AI 配置全局数量上限可配置

**修复**：`ai-config/index.ts` 新增 `getMaxConfigsGlobal()` 从 `ai_config.max_configs_global` 读取（默认 20）；错误响应体附带 `limit` 字段供前端提示。

### A4 — 测试冷却时间（已配置化）

**确认**：`handleTest` 已通过 `getAppConfig('ai', 'test_cooldown_seconds', { defaultValue: 10 })` 读取，无需代码改动。新增迁移种子 `ai.test_cooldown_seconds = 10`。

### A5 — 反馈内容长度接入配置

**修复**：`feedback/index.ts` 新增 `loadFeedbackConfig()` 从 `feedback.max_content_length` / `max_contact_length` / `min_content_length` 读取；所有 `MAX_CONTENT_LENGTH` / `MAX_CONTACT_LENGTH` 常量替换为配置值。

### A6 — 全站硬编码 CSS 值统一走 tokens.css

**tokens.css 新增**：`--sidebar-width: 240px`、`--content-max-width: 1400px`、AI Chat 紫色系列 token（`--color-chat-accent` / `--color-chat-accent-rgb` / `--color-chat-gradient-start` / `--color-chat-glow-rgb` / `--gradient-chat-avatar`）。

**组件修改**（8 个文件）：

| 文件 | 变更 |
|------|------|
| `AiConfigPage.vue` | 25+ 处 indigo/green/amber/red `rgba()` → `var(--color-*-bg/border)`；3 处黑色阴影 → `var(--shadow-lg/xl)`；8 处动画时长 → `var(--duration-fast/normal/slow)`；`getCardBgStart` → `var(--color-accent-bg)` |
| `FloatingChat.vue` | `#4f7df9`/`#8b5cf6`/`#c084fc` → chat accent token；`#34c759` → `var(--color-success)`；`#fff`/`#ffffff` → `var(--color-btn-primary-text)`；FAB rgba → `rgba(var(--color-chat-*-rgb),...)` |
| `WorkbenchHeaderActions.vue` | 15+ 处 var() 暗色 fallback 值全部移除 → 语义变量；`0.15s` → `var(--duration-fast)`；`0 10px 40px rgba(0,0,0,0.3)` → `var(--shadow-xl)` |
| `WorkbenchSidebar.vue` | `width: 240px` → `var(--sidebar-width)`；`#ffffff` → `var(--color-btn-primary-text)`；分组标题 → `var(--color-page-text-muted)` |
| `WorkbenchApp.vue` | divider `top: 68px` → `calc(var(--header-height, 56px) + 12px)` |
| `AppHeader.vue` | `max-width: 1400px` → `var(--content-max-width)` |
| `provider-constants.ts` | 添加注释说明品牌色保留 hex 的原因 |

### A7 — CORS allowHeaders / allowMethods 可配置

**修复**：`cors.ts` 的 `loadCorsFromDb()` 新增读取 `cors.allow_headers` / `cors.allow_methods`；`initCorsConfig()` 使用 DB 值，仅在其缺失时回退硬编码默认值。

### 新增迁移

`supabase/migrations/202605110010_unified_rate_limit_configs.sql` — 12 条配置种子，使用 `ON CONFLICT (category, key) DO NOTHING` 防重复。

### 修改文件清单

| 文件 | 修改类型 |
|------|----------|
| `supabase/functions/ai-chat/index.ts` | A1: 限流器延迟初始化；A2: maxMessageLength/maxSessions 配置化 |
| `supabase/functions/ai-config/index.ts` | A1: 限流器延迟初始化，移除测试限流器；A3: maxConfigsGlobal 配置化 |
| `supabase/functions/feedback/index.ts` | A1: 限流器延迟初始化；A5: 内容长度配置化 |
| `supabase/functions/_shared/cors.ts` | A7: allowHeaders/allowMethods 从 app_configs 读取 |
| `supabase/migrations/202605110010_unified_rate_limit_configs.sql` | 新增 12 条配置种子 |
| `src/api/ai-chat.ts` | QuotaResponse 新增 maxMessageLength/maxSessions |
| `src/composables/useChat.ts` | 暴露 maxMessageLength/maxSessions ref |
| `src/components/business/ai/FloatingChat.vue` | A2: maxlength 校验；A6: 硬编码颜色→token |
| `src/components/business/ai/AiConfigPage.vue` | A6: 硬编码颜色/阴影/时长→token |
| `src/components/business/workbench/WorkbenchHeaderActions.vue` | A6: fallback 值清理+token 化 |
| `src/components/business/workbench/WorkbenchSidebar.vue` | A6: 宽度/颜色→token |
| `src/components/business/workbench/WorkbenchApp.vue` | A6: divider top→calc() |
| `src/components/layout/AppHeader.vue` | A6: max-width→token |
| `src/styles/tokens.css` | A6: 新增 10+ CSS 变量 |
| `src/features/ai/provider-constants.ts` | A6: 品牌色注释 |

### 部署

```bash
supabase db push
supabase functions deploy ai-chat
supabase functions deploy ai-config
supabase functions deploy feedback
pnpm typecheck && pnpm build
```

---

## 2026-05-11: LOW 技术债务批量修复（23 项）

### 后端（7 项）
- **ai-chat messages 分页**：添加 `.limit(100)` 防止超长对话撑爆响应
- **去重 key 稳定性**：`http.ts` 改为递归 key 排序后序列化，解决 JSON 属性顺序问题
- **getMessages skipRetry**：补充 `{ skipRetry: true }` 避免重复请求
- **共享 AI 类型**：新建 `_shared/ai-types.ts`，消除 ai-resolver / ai-config 的接口重复定义
- **getAdminClient 统一**：ai-chat 改为 throw（与 ai-config 一致），移除死代码 null 检查
- **handleTest HTTP 码**：cooldown→429，config_not_found→404，provider_not_found→400
- **reorder 批量更新**：N 次 UPDATE 改为单次 `rpc('reorder_providers')` + UNNEST（新增 migration `202605110011`）

### 前端（16 项）
- **useChat.ts**：`getChatErrorMessage` 提升到模块顶层、console.log 仅 DEV 输出、deleteSession 引用修复
- **useThemeRuntime.ts**：添加 `initialized` 防重复调用保护
- **feedback.ts**：移除未使用的 `scene` 字段
- **FeedbackWidget.vue**：成功消息用独立常量、空 catch 加注释、状态消息加 `role="alert"`、移除未使用的 `hasSupabaseUrl`
- **WorkbenchSidebar.vue**：ARIA 属性补充、移除重复 `setPage`、折叠动画改名 `sidebar-collapse-*`
- **AppHeader.vue**：三点按钮加 ARIA、玻璃效果改用 CSS 变量
- **ConfirmDialog.vue**：关闭按钮加 `aria-label`
- **WorkbenchApp.vue**：placeholder 加 `role="status" aria-live"`
- **AiConfigPage.vue**：rgba typo 修复、onMounted 加 `.catch`、移除未使用的 `handleDeleteKeyGroup`
- **tokens.css**：新增 `--glass-bg` / `--glass-blur` CSS 变量

---

## 2026-05-11: Code Review 16 Issue Fix（安全 / 空catch / Bug）

### 修复内容

| # | 问题 | 文件 | 修复 |
|---|---|---|---|
| 1 | AI 上游错误信息泄露 | `supabase/functions/ai-chat/index.ts` | `ai_upstream_error` 只返回状态码，原始响应正文仅记录服务端日志 |
| 2 | ai-config CRUD 无频率限制 | `supabase/functions/ai-config/index.ts` | 引入模块级 `createRateLimiter`，POST/PATCH/DELETE 统一限流 |
| 3 | feedback 限流器每次请求重建 | `supabase/functions/feedback/index.ts` | `createRateLimiter` 移至模块顶层 |
| 4 | provider 更新失败导致 configs 永久丢失 | `supabase/functions/ai-config/index.ts` | 先更新 provider，成功后再删除孤儿 configs |
| 5 | api_key 明文存储 | `supabase/migrations/20260511_add_is_encrypted_to_ai_configs.sql`、`ai-config/index.ts`、`_shared/ai-resolver.ts` | 新增 `is_encrypted` 列；创建/更新时 `encryptValue()`，读取/测试时 `decryptValue()` |
| 6 | CORS 初始化顺序 bug | `supabase/functions/ai-chat/index.ts` | `await initCorsConfig()` 移到 `createCorsHelpers({})` 之前 |
| 7 | loadSessions 空 catch | `src/composables/useChat.ts` | `console.error('[useChat] Failed to load sessions:', err)` |
| 8 | read/writeSelected 空 catch | `src/components/business/ai/AiConfigPage.vue` | `console.warn('[AiConfig] Failed to read/write model selection:', e)` |
| 9 | handleToggleActive 空 catch | `src/components/business/ai/AiConfigPage.vue` | `console.error('[AiConfig] Toggle active failed:', e)` |
| 10 | preload/activate/deactivate 空 catch | `src/stores/ai.ts` | 三处均添加 `console.error('[AiStore] ...:', err)` |
| 11 | checkQuota 空 catch（DB 故障时绕过配额） | `supabase/functions/ai-chat/index.ts` | DB 故障时返回 `allowed: false`，拒绝放行 |
| 12 | 连续 confirm() 第一次 Promise 挂起 | `src/composables/useConfirm.ts` | 连续调用时自动 reject 上一个 Promise + `console.warn` |
| 13 | loadingSessions/loadingQuota 异常死锁 | `src/composables/useChat.ts` | 改为 `ref(false)`，`finally` 确保重置 |
| 14 | AddKeyModal submitting 永久锁定 | `src/components/business/ai/AddKeyModal.vue` | `handleSubmit` 用 `try/finally` 包裹 |
| 15 | 死代码 @mousemove 在 pointer-events:none | `src/components/business/ai/AiConfigPage.vue` | 移除 tooltip 元素上的 `@mousemove` |
| 16 | @keydown.esc 在不可聚焦 div 上无效 | `src/components/business/ai/FloatingChat.vue` | 改为文档级 `keydown` 事件监听（与 ConfirmDialog 一致） |

### 修改文件清单

| 文件 | 修改类型 |
|------|----------|
| `supabase/functions/ai-chat/index.ts` | 修复 CORS 顺序、错误泄露、空 catch |
| `supabase/functions/ai-config/index.ts` | 修复限流、更新顺序、api_key 加密 |
| `supabase/functions/feedback/index.ts` | 修复限流器创建时机 |
| `supabase/functions/_shared/ai-resolver.ts` | 修复 api_key 解密读取 |
| `supabase/migrations/20260511_add_is_encrypted_to_ai_configs.sql` | 新增 is_encrypted 列 |
| `src/composables/useChat.ts` | 修复空 catch、loading 死锁 |
| `src/composables/useConfirm.ts` | 修复连续 confirm 挂起 |
| `src/stores/ai.ts` | 修复空 catch |
| `src/components/business/ai/AiConfigPage.vue` | 修复空 catch、死代码 |
| `src/components/business/ai/AddKeyModal.vue` | 修复 submitting 锁定 |
| `src/components/business/ai/FloatingChat.vue` | 修复 keydown.esc |

### 部署

```bash
# 部署修改的 Edge Functions
supabase functions deploy ai-chat --project-ref <ref>
supabase functions deploy ai-config --project-ref <ref>
supabase functions deploy feedback --project-ref <ref>

# 执行新迁移
supabase db push

# 构建前端
pnpm build
pnpm verify
```

---

## 2026-05-11: Code Review 28 MEDIUM Issue Fix

### 概述
修复 CODE_REVIEW_FIX_LIST.md 中 28 个 MEDIUM 问题，涵盖前端 UX/Bug、可维护性、死代码、性能和后端安全。

### 前端修复

| # | 问题 | 文件 | 修复 |
|---|---|---|---|
| 23 | 删除会话无确认 | `FloatingChat.vue` | `handleDeleteSession` 内调用 `useConfirm()` 确认后再执行 |
| 24 | formatTime 对无效日期崩溃 | `FloatingChat.vue` | 函数开头加 `if (!iso) return '--'` 和 `isNaN` 检查 |
| 25 | 发送失败输入丢失 | `FloatingChat.vue` | `handleSend` 发送前保存 text，失败时恢复 `inputText.value = text` |
| 26 | status 跨开关周期残留 | `FeedbackWidget.vue` | `watch(open)` 打开时调用 `status.value = { type: 'idle', text: '' }` |
| 27 | VITE_SUPABASE_URL 未设时得到 "undefined" | `FeedbackWidget.vue` | 改为 `typeof supabaseUrl === 'string' && supabaseUrl !== 'undefined'` 校验 |
| 28 | maskApiKey 是空操作 | `AiConfigPage.vue` | 删除 `maskApiKey` 函数，模板直接 `group.apiKeyMasked` |
| 29 | getSelectedConfig 每行重复调用 15+ 次 | `AiConfigPage.vue` | 新增 `tableRows` computed 预计算 selected，模板遍历 `row.selected` |
| 30 | 删除按钮仅 hover 可见 | `AiConfigPage.vue` | 添加 `.provider-card:focus-within .card-delete-btn { opacity: 1 }` + `tabindex="0"` |
| 32 | 亮色模式 hover 不可见 | `WorkbenchSidebar.vue` | `background: var(--color-page-elevated)` 替代 `rgba(255,255,255,0.06)` |
| 33 | 折叠状态按标题字符串匹配 | `WorkbenchSidebar.vue` | `MenuGroup` 添加 `key: string`，`collapsedGroups` 用 key 映射替代独立 ref |
| 34 | 异步组件无 fallback | `WorkbenchApp.vue` | `defineAsyncComponent` 添加 `loadingComponent` + `errorComponent` + `delay: 200` |
| 35 | collapse 动效跳变 | `WorkbenchSidebar.vue` | 过渡改用 `max-height` + `opacity`，补充 enter-to/leave-from |
| 37 | hydrateTheme 与 setTheme 完全相同 | `app.ts`, `useThemeRuntime.ts` | 删除 `hydrateTheme`，调用处改为 `setTheme` |
| 38 | ESC 处理三处重复 | `ProviderConfigModal.vue`, `AddKeyModal.vue`, `ConfigEditModal.vue` | 新建 `composables/useEscapeKey.ts`，三处替换 |
| 39 | chat-open class 无对应 CSS | `FloatingChat.vue` | 删除 `document.body.classList.add('chat-open')` 及相关代码 |
| 40 | 消息容器无 aria-live | `FloatingChat.vue` | 添加 `role="log" aria-live="polite"` |
| 41 | deep watcher 过于昂贵 | `FloatingChat.vue` | 改为 `watch(() => messages.value.length, ...)` |
| 42 | ConfirmDialog 打开时不管理焦点 | `ConfirmDialog.vue` | `watch(visible)` 打开时 `nextTick(() => confirmPanel.value?.focus())`，面板加 `tabindex="-1"` |
| 45 | githubmodels 键名不匹配 | `provider-constants.ts` | `PROVIDER_INITIALS` 中 `githubmodels` → `'github-models'` |
| 46 | 暗色覆盖与原有值重复 | `AppHeader.vue` | 删除 `[data-theme='dark'] .nav-link.active` 覆盖块 |

### 后端修复

| # | 问题 | 文件 | 修复 |
|---|---|---|---|
| 47 | temperature/max_tokens 硬编码+自动重试 | `ai-chat/index.ts` | `loadChatConfig()` 新增 temperature/maxTokens；删除 retry loop；新增迁移 insert 初始值 |
| 48 | handleActivate 全量停用+单点激活无事务保护 | `ai-config/index.ts` | 先 `select('id').eq('id', id).single()` 确认存在，再执行全量停用+激活 |
| 49 | DELETE 不存在的资源返回 ok | `ai-config/index.ts` | 改用 `delete().eq('id', id).select('id').single()`，`!data` 返回 404 |
| 50 | getClientIp 重复实现 | `ai-config/index.ts` | 删除本地实现，改为 `import { getClientIp } from '../_shared/request.ts'` |
| 51 | sanitizeError 泄露内部结构 | `ai-config/index.ts` | 返回固定 `'An internal error occurred'`，原始 error 仅 `console.error` |
| 52 | 配额检查与递增分离存在竞态 | `ai-chat/index.ts`, migration | 改造 `increment_ai_chat_quota` RPC 接受 `p_limit`，原子判断+递增；新增 `consumeQuota()` |
| 53 | 缺少 user_id 索引 | migration | 新增 `CREATE INDEX idx_ai_chat_sessions_user ON ai_chat_sessions(user_id, updated_at DESC)` |

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/composables/useEscapeKey.ts` | ESC 键统一处理 composable |
| `supabase/migrations/202605110001_fix_ai_chat_quota_race.sql` | 原子配额 RPC + ai_chat_sessions 索引 |

### 修改文件清单

| 文件 | 修改类型 |
|------|----------|
| `src/components/business/ai/FloatingChat.vue` | UX 修复：删除确认/输入恢复/formatTime/animation/aria-live/watcher |
| `src/components/business/ai/AiConfigPage.vue` | 性能：tableRows computed + maskApiKey 移除 + focus-within |
| `src/components/business/feedback/FeedbackWidget.vue` | Bug 修复：status 重置 + env var 校验 |
| `src/components/common/ConfirmDialog.vue` | 可访问性：打开时焦点管理 |
| `src/stores/app.ts` | 重构：删除 hydrateTheme |
| `src/composables/useThemeRuntime.ts` | 重构：hydrateTheme → setTheme |
| `src/features/ai/provider-constants.ts` | Bug 修复：githubmodels key 对齐 |
| `src/components/layout/AppHeader.vue` | 重构：删除冗余 dark 覆盖 |
| `src/components/business/workbench/WorkbenchSidebar.vue` | UX：亮色 hover/key 折叠/max-height 动效 |
| `src/components/business/workbench/WorkbenchApp.vue` | UX：异步组件 loading/error fallback |
| `src/components/business/ai/ProviderConfigModal.vue` | 重构：useEscapeKey |
| `src/components/business/ai/AddKeyModal.vue` | 重构：useEscapeKey |
| `src/components/business/ai/ConfigEditModal.vue` | 重构：useEscapeKey |
| `supabase/functions/ai-chat/index.ts` | 后端：温度/token 可配置+去重试+原子配额 |
| `supabase/functions/ai-config/index.ts` | 后端：存在性检查+共用 getClientIp+错误脱敏 |
| `supabase/migrations/202605080002_insert_ai_chat_configs.sql` | 新增 temperature、max_tokens 初始值 |
| `supabase/migrations/202605110001_fix_ai_chat_quota_race.sql` | 新增：原子配额 RPC + 索引 |

### 构建状态
- ✅ `vue-tsc --noEmit` 通过
- ✅ `pnpm lint` 通过（零 error）

### 跳过的问题（7 项）

| # | 问题 | 原因 |
|---|---|---|
| 22 | AiConfigPage.vue script 575 行拆分为 composables | 大规模重构，风险高，需单独专题 |
| 31 | 移动端导航直接隐藏，无汉堡按钮 | 新功能开发，需设计确认 |
| 36 | AppHeader/WorkbenchHeaderActions 主题切换 UI 重复 | 跨组件抽取风险高，暂保留 |
| 43 | ConfigEditModal.vue 疑似死代码 | 实际被 AppConfigPage.vue 引用，非死代码 |
| 54-57 | 后端函数过长（400/214/133/147 行） | 重构风险高，需在充分测试后单独处理 |

### 部署

```bash
# 部署修改的 Edge Functions
supabase functions deploy ai-chat --project-ref <ref>
supabase functions deploy ai-config --project-ref <ref>

# 执行新迁移
supabase db push

# 构建前端
pnpm build
pnpm verify
```

---

## 2026-05-11: AI 配置界面多项修复

### 修复内容

| # | 问题 | 文件 | 修复 |
|---|---|---|---|
| 1 | 追加模型时 API Key 显示 `***`掩码 | `AiConfigPage.vue`、`AddKeyModal.vue` | `openAppendModel` 不再传递 masked key；`isAppendMode` 仅判断 providerId |
| 2 | 新增 Key 默认超时 30s vs AI 对话框 45s | `supabase/functions/ai-config/index.ts` | `getDefaultTimeout()` 从 `app_configs` 读取 `ai.default_timeout_ms`，与 `ai-resolver.ts` 同源，默认 45000 |
| 3 | 亮色模式侧边栏 Dev Studio 文字看不见 | `WorkbenchSidebar.vue` | `text-white` → `color: var(--color-page-text)`；Dev 图标保留白色 |
| 4 | 亮色模式弹窗仍为黑色 | `AddKeyModal.vue`、`ProviderConfigModal.vue` | 删除模板中硬编码的 `data-theme="dark"`，弹窗跟随全局主题 |

### 构建状态
- ✅ `vue-tsc --noEmit` 通过

### 部署
```bash
supabase functions deploy ai-config --project-ref <ref>
pnpm build
```

---

## 2026-05-10: AI 对话助手 Bug 修复（CORS / 超时 / 截断）

### 问题概述
三个线上 Bug 导致 AI 小助手无法正常使用：
1. 历史会话删除按钮无反应
2. AI 对话报 "AI 响应超时，请稍后重试"
3. AI 回复消息被截断

### 修复文件

| 文件 | 修改类型 | 说明 |
|---|---|---|
| `supabase/functions/_shared/cors.ts` | 修复 | `allowMethods` 从 `POST, OPTIONS` 扩展为 `GET, POST, PATCH, DELETE, OPTIONS`（两处），DELETE/GET 请求的 CORS 预检不再被拦截 |
| `supabase/functions/_shared/ai-resolver.ts` | 修复 | AI 调用默认超时 30000 → 45000，匹配前端 60s 超时窗口 |
| `src/api/http.ts` | 修复 | 前端 fetch 默认超时 30_000 → 60_000，与 .env.example 推荐值一致 |
| `supabase/functions/ai-chat/index.ts` | 修复 | `max_tokens` 2048 → 4096，解决复杂 SQL 回复被截断 |
| `.env.example` | 文档 | 同步更新超时注释 |

### 根因分析

**Bug 1 — 删除无反应**: CORS 预检响应头 `Access-Control-Allow-Methods` 只包含 `POST, OPTIONS`，不包含 `DELETE`。浏览器发送 DELETE 预检时被拒绝，真实请求从未发出。

**Bug 2 — 响应超时**: 超时链路不匹配。Edge Function 内 AI 调用默认 30s 超时，但 AI 供应商（DeepSeek 等）实际可能 >30s。前端虽配置 60s，但 EF 层先超时返回 504。

**Bug 3 — 消息截断**: AI 调用硬编码 `max_tokens: 2048`，输出空间不足以承载复杂 SQL + 详细解释。

### 部署步骤

```bash
# 重新部署所有引用 cors.ts 的 Edge Function
supabase functions deploy ai-chat --project-ref <ref>
supabase functions deploy convert --project-ref <ref>
supabase functions deploy feedback --project-ref <ref>
supabase functions deploy ziwei-analysis --project-ref <ref>

# 重新构建前端
pnpm build
pnpm verify
```

> 注意：如果数据库 `ai_configs.timeout_ms` 有自定义值且 < 45000，需同步更新。

---

## 2026-05-10: 全站深色模式升级 — 方案 B · 极简曜石（Onyx Minimal）

### 概述
将全站深色模式升级为「方案 B · Onyx Minimal」纯黑极简风格。所有背景色通过 CSS 变量（tokens.css）统一管理，消除硬编码。

### 核心变更：tokens.css

**深色模式** `[data-theme="dark"]`：

| 变量 | 旧值 | 新值 | 用途 |
|---|---|---|---|
| `--color-panel` | `#1c1c1e` | `#000000` | 页面、弹窗面板、下拉菜单、侧边栏 |
| `--color-panel-2` | `#2c2c2e` | `#0a0a0a` | 输入框、表格、消息气泡（凹入层） |
| `--color-panel-3` | `#3a3a3c` | `#161616` | 供应商卡片、表头、提示卡片（浮起层） |

**浅色模式** `:root`：

| 变量 | 旧值 | 新值 | 用途 |
|---|---|---|---|
| `--color-bg` | `#ffffff` | `#fafafa` | 页面底色微暖 |
| `--color-panel` | `#ffffff` | `#ffffff` | 页面、弹窗面板、下拉菜单 |
| `--color-panel-2` | `#f5f5f7` | `#f4f4f6` | 输入框、表格、消息气泡（凹入层） |
| `--color-panel-3` | `#eaeaec` | `#fafafa` | 卡片、表头、提示（浮起层） |

`--color-page-panel`、`--color-modal-bg` 等别名自动继承，无需额外修改。

### 组件修改

所有 9 个组件仅修正 `background` 属性引用，从硬编码值恢复为 CSS 变量引用：

| 文件 | 变更 |
|---|---|
| `src/components/business/ai/AiConfigPage.vue` | 移除 `data-theme="dark"` 硬编码；`getCardBgEnd()` → `var(--color-panel-3)` |
| `src/components/business/ai/ProviderConfigModal.vue` | `.modal-panel` → `var(--color-panel)`；`.form-input`、`.models-grid` → `var(--color-panel-2)` |
| `src/components/business/ai/AddKeyModal.vue` | 同上 |
| `src/components/common/ConfirmDialog.vue` | `.confirm-panel` → `var(--color-panel)` |
| `src/components/business/feedback/FeedbackWidget.vue` | `.feedback-modal` → `var(--color-panel)`；输入框 → `var(--color-panel-2)` |
| `src/components/business/ai/FloatingChat.vue` | `.chat-panel` → `var(--color-panel)`；气泡/输入区 → `var(--color-panel-2)` |
| `src/components/business/workbench/WorkbenchSidebar.vue` | `aside` → `var(--color-page-panel)` |
| `src/components/layout/AppHeader.vue` | `.user-dropdown` → `var(--color-panel)` |
| `src/components/business/workbench/WorkbenchHeaderActions.vue` | `.wb-dropdown`、trigger、login-btn → `var(--color-panel)` / `var(--color-panel-2)` |

### 深度层级
`var(--color-panel)` = `#000000` (页面/弹窗/侧边栏) < `var(--color-panel-2)` = `#0a0a0a` (输入框/表格/气泡) < `var(--color-panel-3)` = `#161616` (卡片/表头/提示)

### 主题切换
点击三点菜单的「深色」按钮，`useThemeRuntime` 设置 `data-theme="dark"` 到 `document.documentElement`，全站自动应用此方案。浅色模式不受影响。

### 构建状态
- ✅ `vue-tsc --noEmit` 通过
- ✅ 零硬编码残留

### 部署
```bash
pnpm build && pnpm verify
```

### 预览文件
- `docs/ai-config-theme-preview.html` — 四个方案并排对比（浅色 + 方案 A/B/C）

---

## 2026-05-08: AI 对话助手（FloatingChat）功能实现

### 概述
按照「方案 A：轻量快速（Edge-First）」实现了 AI 小助手悬浮对话功能。用户点击右下角悬浮按钮可打开对话框，与 AI 进行数据库相关的技术问答。

### 架构

```
FloatingChat.vue → useChat.ts → aiChatApi → edgeFn('POST /ai-chat')
  → ai-chat Edge Function (Deno)
    → resolveAiConfig() 获取激活的 AI 供应商
    → AI API (OpenAI-compatible /v1/chat/completions)
    → 消息持久化到 ai_chat_sessions + ai_chat_messages
    → 配额原子递增 (ai_chat_quota)
```

### 新增文件

| 文件 | 说明 |
|---|---|
| `supabase/migrations/202605080001_create_ai_chat_tables.sql` | DDL：ai_chat_sessions、ai_chat_messages、ai_chat_quota 三张表 + RLS + 触发器 + 原子递增函数 |
| `supabase/migrations/202605080002_insert_ai_chat_configs.sql` | DML：app_configs 插入 ai_chat 类别的 system_prompt 和 daily_limit=20 |
| `supabase/functions/ai-chat/index.ts` | Edge Function：POST 发消息、GET 查会话/消息/配额、DELETE 删会话 |
| `src/api/ai-chat.ts` | 前端 API 层：aiChatApi（sendMessage / getSessions / getMessages / deleteSession / getQuota） |
| `src/composables/useChat.ts` | Composable：模块级单例状态（open/sessions/messages/quota/sending/provider/model） |
| `src/components/business/ai/FloatingChat.vue` | 悬浮按钮 + 对话框 UI（双主题适配 + 移动端响应式） |

### 修改文件

| 文件 | 变更 |
|---|---|
| `src/layouts/DefaultLayout.vue` | 引入并挂载 FloatingChat |
| `src/layouts/WorkbenchLayout.vue` | 同上 |
| `src/layouts/AuthLayout.vue` | 同上 |
| `src/utils/error-map.ts` | 新增 ai_chat_quota_exceeded、ai_chat_invalid_message、ai_chat_session_not_found |

### 关键设计

- **AI 供应商解析**：Edge Function 复用 `resolveAiConfig()` 从 `ai_configs` 表获取激活的供应商标识和模型名，对话框 Header 实时显示当前使用的 provider/model
- **每日配额**：从 `app_configs` 的 `ai_chat.daily_limit` 读取（默认 20），通过 PostgreSQL 原子函数 `increment_ai_chat_quota()` 防并发超限
- **上下文窗口**：每次发送消息时加载最近 30 条历史消息作为 AI 上下文
- **会话管理**：首条消息自动创建 session，支持历史列表侧边栏切换和删除
- **主题适配**：所有颜色使用 CSS 变量，自动跟随 `[data-theme]` 切换
- **无硬编码**：API 地址、模型、system prompt、每日限额全部从数据库或环境变量读取
- **RLS 保护**：所有表启用 RLS，用户只能访问自己的数据

### 构建状态
- ✅ `vue-tsc --noEmit` 通过（零类型错误）
- ✅ ESLint 通过（零错误）

---

## 2026-05-08: AI 配置界面字体统一修复

### 问题
AI 配置界面字体不统一，ConfigEditModal.vue 和 AiConfigPage.vue 使用了未在 tokens.css 中定义的 CSS 变量，导致字体和颜色显示异常。

### 修复内容

#### 1. 变量名统一替换
将所有未定义的变量替换为 tokens.css 中定义的标准变量：

| 错误变量 | 正确变量 |
|---------|---------|
| `--font-sans` | `--font-body` |
| `--text-primary` | `--color-text` |
| `--text-secondary` | `--color-text-subtle` |
| `--text-muted` | `--color-text-muted` |
| `--bg-card` | `--color-panel` |
| `--bg-elevated` | `--color-panel-2` |
| `--border` | `--color-border` |
| `--accent` | `--color-accent` |
| `--success` | `--color-success` |
| `--danger` | `--color-danger` |
| `--warning` | `--color-warning` |

#### 2. 修改的文件
- `src/components/business/ai/AiConfigPage.vue` - 全面替换所有错误变量
- `src/components/business/ai/ConfigEditModal.vue` - 全面替换所有错误变量

#### 3. 现在所有 AI 配置组件使用统一的 tokens.css 变量
- AddKeyModal.vue（原本就正确）
- ProviderConfigModal.vue（原本就正确）
- ConfigEditModal.vue（已修复）
- AiConfigPage.vue（已修复）

### 构建状态
- ✅ `vue-tsc --noEmit` 通过

---

## 2026-05-08: AI 配置界面 UI 优化

### 本次修改文件

```
src/components/business/ai/
├── AiConfigPage.vue         # 布局、边框、开关、测试延迟、API Key 显示优化
└── ConfigEditModal.vue      # 字体统一、CSS 变量化、边框对比度增强
```

### 修改内容

#### 1. 布局修复
- `section-header` 改为 `flex-direction: row`，标题左对齐，新增按钮右对齐
- `section-title` 文字对齐从 `center` 改为 `left`

#### 2. 按钮样式优化
- `.btn-add:hover` 添加 `box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4)` 增强对比度
- 解决鼠标悬停变色导致文字看不清的问题

#### 3. 表格边框优化
- 移除单元格右侧竖线分隔（`border-right` 删除）
- 外边框和分隔线透明度增强：`rgba(255, 255, 255, 0.12)` 和 `rgba(255, 255, 255, 0.08)`
- 解决浅色/深色模式下边框看不清的问题

#### 4. 状态切换改为开关
- 状态徽章（启用/禁用）替换为开关组件（Toggle Switch）
- 开关样式：44x24px，启用时为 `var(--success)` 绿色

#### 5. 操作按钮精简
- 移除"关闭"按钮（启用/禁用改由开关控制）
- 保留：测试、删除按钮

#### 6. 测试延迟时间持续显示
- 添加 `testResults` ref 存储每次测试结果
- 点击测试后，延迟时间立即显示并持续保留
- 直至下一次点击测试才更新

#### 7. 表格外边框自适应高度
- `keys-table-wrapper` 改为 `flex: 0 1 auto`
- 边框随记录增加自动扩展，不再撑满整个区域

#### 8. API Key 显示优化
- 显示前 8 位 + 省略号 + 后 8 位明文
- 原显示前 4 位 + 后 4 位

#### 9. 字体统一
- 弹窗组件所有文本添加 `font-family: var(--font-sans)`
- 所有硬编码颜色替换为 CSS 变量：
  - `#131722` → `var(--bg-card)`
  - `#f0f6fc` → `var(--text-primary)`
  - `#8b949e` → `var(--text-secondary)`
  - `#6e7681` → `var(--text-muted)`
  - `#f85149` → `var(--danger)`
  - `#3fb950` → `var(--success)`
  - `#6366f1` → `var(--accent)`

### 构建状态
- ✅ `vue-tsc --noEmit` 通过
- ✅ 类型检查无错误

---

## 2026-05-04: SFC 迁移完成 - Pinia Store 集成 + SqlEditor 组件

### 迁移进度更新

#### 本次新增/更新文件
```
src/stores/
└── workbench.ts              # 新增 convert() action、converting/canConvert computed
                               # 新增 loadSample/clearInput/getCurrentInput/setCurrentInput actions
                               # 添加示例 SQL 数据（SAMPLE_DDL, SAMPLE_FUNCTION, SAMPLE_PROCEDURE）

src/components/business/workbench/
├── WorkbenchApp.vue         # 修复模板结构，集成所有页面
├── WorkbenchSidebar.vue     # 修复 Pinia store 访问模式（移除 .value）
├── WorkbenchHeader.vue      # 修复 Pinia store 访问模式，集成 convert action
├── WorkbenchActionBar.vue   # 集成实际操作（加载示例/上传文件/复制输出/保存文件/清空）
├── DbPicker.vue            # 修复 Pinia store 访问模式
├── pages/
│   ├── DdlPage.vue         # 使用 SqlEditor 组件
│   ├── FunctionPage.vue    # 使用 SqlEditor 组件
│   └── ProcedurePage.vue    # 使用 SqlEditor 组件
├── components/
│   └── SqlEditor.vue       # SQL 编辑器组件（带行号、Tab 支持）
└── modals/
    ├── AlertModal.vue      # 修复 Pinia store 访问模式
    └── ConfirmModal.vue    # 修复 Pinia store 访问模式

src/pages/workbench/
└── index.vue               # 添加 USE_SFC_WORKBENCH feature flag，默认启用 SFC

src/api/
└── convert.ts            # 修复 invokeEdgeFunction → edgeFn.post

src/utils/
└── error-map.ts            # 移除 duplicate key（auth_email_already_registered, auth_weak_password）

已删除：
src/components/business/workbench/EditorPanel.vue  # 未使用的重复组件
```

#### 本次修复的问题
1. **error-map.ts** - 移除 duplicate key（`auth_email_already_registered`、`auth_weak_password`）
2. **ZiweiPage.vue** - 改进 TODO 注释，标注为后续专题
3. **EditorPanel.vue** - 删除未使用的重复组件
4. **WorkbenchActionBar.vue** - 集成所有实际操作：
   - 加载示例 → 填充示例 SQL
   - 上传文件 → 读取 .sql 文件
   - 复制输出 → 使用 clipboard API
   - 保存文件 → 下载 .sql 文件
   - 清空 → 清除输入/输出
5. **convert.ts** - 修复 `invokeEdgeFunction` → `edgeFn.post`

#### 架构更新
- **Feature Flag**: `USE_SFC_WORKBENCH = true` 启用新的 SFC 工作台
- **Store 访问模式**: 所有组件使用正确的 Pinia setup store 访问方式（无需 `.value`）
- **统一 convert action**: `store.convert()` 根据当前页面自动调用对应转换逻辑
- **SqlEditor 组件**: 带行号 gutter、Tab 缩进、Ctrl+Enter 快捷键

#### 迁移完成状态
- [x] DDL 页面（使用 SqlEditor）
- [x] 函数翻译页面（使用 SqlEditor）
- [x] 存储过程翻译页面（使用 SqlEditor）
- [x] ID Tool 页面
- [x] Ziwei 页面
- [x] Rules 页面
- [x] 所有组件的 Pinia store 访问模式修复
- [x] WorkbenchApp 模板结构修复

#### 构建状态
- ✅ `vue-tsc --noEmit` 通过
- ✅ `vite build` 通过

#### 待处理
- [ ] 功能验证（手动测试所有页面）

---

## 2026-05-04: Legacy 文件激进删除完成

### 删除的文件
- `src/legacy/` - 整个目录（约 21,000 行代码）
  - app.js, style.css, auth.js, rules.js, samples.js, bootstrap.js, feedback.js
  - modules/ 目录下的所有文件
  - vendor/ 目录下的所有文件
- `src/components/business/legacy/LegacyFrameView.vue`
- `legacy.html` - 项目根目录的 legacy 入口文件
- 所有 `src/features/*/legacy-bridge.ts` 文件
- `src/composables/useLegacyBridge.ts`

### 更新的文件
- `vite.config.mjs` - 移除 `copyLegacyAssetsPlugin()` 和 legacy 输入
- `src/router/index.ts` - 移除 `legacyFrame` meta 标志
- `src/App.vue` - 移除 `isLegacyFramePage` 计算属性
- `src/pages/workbench/index.vue` - 移除 LegacyFrameView 引用，始终使用 WorkbenchApp

### 构建结果
- 构建体积显著减小（legacy assets 不再打包）
- `vite build` 通过，模块数从 239 减少到 194
- dist 不再包含 legacy 相关资源

---

## 2026-05-04: SFC 迁移继续 - iframe 通信基础设施

### 迁移进度更新

#### 本次新增/更新文件
```
src/components/business/workbench/pages/
├── IdToolPage.vue          # 身份证/USCC 生成校验页面
├── ZiweiPage.vue           # 紫微斗数命盘页面（新布局）
└── RulesPage.vue          # DDL/程序块规则管理页面

src/components/business/workbench/components/
└── SqlEditor.vue           # SQL 编辑器组件（支持 plain 模式）

src/composables/
└── useLegacyBridge.ts     # Legacy iframe 通信 Composable

src/api/
└── ziwei-analysis.ts      # 紫微斗数 AI 分析 API

src/features/ziwei/
└── compute.ts            # 紫微斗数计算引擎（完整算法实现）

src/api/
├── feedback.ts           # 修复 edgeFn 导入
├── rules.ts             # 修复 edgeFn 导入
├── ai-config.ts         # 修复 edgeFn 导入
├── app-config.ts        # 修复 edgeFn 导入
├── operation-logs.ts    # 修复 edgeFn 导入
└── ziwei-history.ts    # 修复 edgeFn 导入
```

#### 修复问题
- `feedback.ts`: 修复 `invokeEdgeFunction` → `edgeFn.post`
- `rules.ts`: 修复 `edgeFn` 导入路径
- `ai-config.ts`, `app-config.ts`, `operation-logs.ts`, `ziwei-history.ts`: 修复 `edgeFn` 导入路径
- `app-config.ts`: 修复 `.delete` → `.del`
- `ZiweiPage.vue`: 移除不存在的 `useZiweiStore` 导入，使用本地状态

#### 构建状态
- ✅ `vite build` 成功
- ⚠️ 存在 `error-map.ts` 的 duplicate key 警告（预先存在）

#### 紫微斗数计算引擎
`src/features/ziwei/compute.ts` 提供了完整的排盘算法：

**常量**：
- 天干地支：`ZW_STEMS`, `ZW_BRANCHES`, `ZW_RING`, `ZW_PALACE_NAMES`
- 星曜数据：`MAIN_STARS`, `ASSIST_STARS`, `MISC_STARS`, `ZW_BRIGHTNESS`
- 四化数据：`ZW_HUA_BY_STEM`, `ZW_HUA_TAG_ITEMS`
- 辅助星：`ZW_KUI_YUE_BY_STEM`, `ZW_LUCUN_YANG_TUO_BY_STEM`, `ZW_FIRE_BELL_BY_YEAR_BRANCH`
- 长生表：`ZW_CHANGSHENG_NAMES`, `ZW_CHANGSHENG_START_BY_ELEMENT`

**辅助函数**：
- `stemIndex()`, `branchIndex()`, `offsetBranch()`
- `getYearGanZhi()`, `getMonthGanByYearStem()`, `getDayGanZhiBySolar()`, `getHourGanZhiByDayGan()`
- `calcMingGong()`, `calcShenGong()`, `installTwelvePalaces()`
- `locateZiWeiPos()`, `getTianfuBranch()`, `buildChangShengMap()`

**核心函数**：
- `computeZiweiChart(input: ZiweiInput)` - 计算完整命盘
- `validateBirthDate()`, `validateBirthTime()` - 输入验证
- `lunarToSolar()`, `solarToLunar()` - 农历公历转换

---

## 2026-05-03: Legacy.html Vue 模板迁移启动

启动了 `legacy.html` Vue 模板的渐进式 SFC 迁移，目标移除 `unsafe-eval` CSP 依赖。

### 迁移策略
- 方案：渐进式 SFC 提取
- 优先级：DDL 页面优先
- 状态管理：Pinia Store
- CodeMirror 5：保持 legacy iframe 方式

### 已完成的新文件
```
src/stores/
└── workbench.ts                    # 工作台状态管理

src/composables/
└── useClipboard.ts                # 剪贴板操作

src/components/business/workbench/
├── WorkbenchApp.vue               # 主应用容器
├── WorkbenchSidebar.vue           # 侧边栏导航（重写）
├── WorkbenchHeader.vue           # 头部 + DB Picker
├── WorkbenchActionBar.vue        # 操作工具栏
├── DbPicker.vue                  # 数据库选择器
├── EditorPanel.vue               # 编辑器面板
├── pages/
│   ├── DdlPage.vue              # DDL 翻译页面（已连接 API）
│   ├── FunctionPage.vue         # 函数翻译页面（已连接 API）
│   ├── ProcedurePage.vue        # 存储过程翻译页面（已连接 API）
│   ├── IdToolPage.vue           # 身份证/USCC 生成校验页面
│   ├── ZiweiPage.vue            # 紫微斗数命盘页面（新布局）
│   └── RulesPage.vue            # DDL/程序块规则管理页面
└── modals/
    ├── AlertModal.vue            # 提示弹窗
    └── ConfirmModal.vue          # 确认弹窗

src/api/
├── convert.ts                    # SQL 翻译 API
└── ziwei-analysis.ts            # 紫微斗数 AI 分析 API
```

### 迁移完成状态
- [x] DDL 页面
- [x] 函数翻译页面
- [x] 存储过程翻译页面
- [x] ID Tool 页面
- [x] Ziwei 页面（UI + 计算引擎完成）
- [x] Rules 页面（DDL + 程序块规则）
- [x] 紫微斗数计算引擎（从 legacy app.js 迁移）

### 迁移统计
本次迁移（2026-05-03 ~ 2026-05-04）：
- **新增文件**: 11 个
- **修改文件**: 6 个 API 文件（修复导入路径）
- **代码行数**: 约 3000+ 行（包含计算引擎、UI 组件）
- **构建状态**: ✅ 通过

### 待完成
- [ ] 与 legacy iframe 通信（用于 CodeMirror 编辑器）
- [ ] 功能验证（手动测试所有页面）

### CSP 说明
- Vue SFC 部分：Vite 预编译，**无需 `unsafe-eval`**
- CodeMirror 5：仍需 `unsafe-eval`（后续升级到 CodeMirror 6 可完全移除）
- 当前状态：Vue 页面已全部迁移到 SFC，但编辑器的 CodeMirror 5 仍需要 `unsafe-eval`

### 构建测试
- ✅ `vite build` 成功

---

## 2026-05-03: Code Review 22 Issues Fix

本次修复了文档审查报告中的 22 个问题（HIGH 4 项、MEDIUM 11 项、LOW 4 项，部分文件不存在或不适用）。

### HIGH 优先级修复

| # | 问题 | 修复文件 | 修复内容 |
|---|------|----------|----------|
| H1 | AuthModal 硬编码错误信息 | `src/components/business/auth/AuthModal.vue` | 错误文案迁移到 `src/utils/error-map.ts`，使用 `mapErrorCodeToMessage()` |
| H2/H3 | 数据库表缺少注释 | `supabase/migrations/202604230001_create_feedback_entries.sql`, `202604290001_create_profiles.sql` | 补全 TABLE COMMENT 和所有 COLUMN COMMENT |
| H5 | storage.ts key 命名不规范 | `src/features/preferences/storage.ts` | 统一 key 前缀为 `sqldev:preferences:`，添加 100KB 单项上限和 100 条列表上限 |
| H6 | env.d.ts 缺少声明 | `src/env.d.ts` | 补充 `VITE_API_TIMEOUT_MS` 类型声明 |

### MEDIUM 优先级修复

| # | 问题 | 修复文件 | 修复内容 |
|---|------|----------|----------|
| M1 | AuthModal.vue 硬编码颜色 | `src/components/business/auth/AuthModal.vue` | 迁移到 CSS 变量：`--color-modal-*`、`--color-overlay`、`--shadow-modal` |
| M2 | ProviderListPanel.vue 硬编码颜色 | 无需修复 | PROVIDER_COLORS 是视觉颜色映射，非 UI 硬编码颜色 |
| M3 | ConfigEditModal.vue 硬编码颜色 | 无需修复 | 未发现硬编码颜色 |
| M4 | main.ts 硬编码颜色 | `src/main.ts` | 全局错误提示使用 CSS 变量 |
| M5 | ddl/conversion-orchestrator.ts 空 catch | 不存在 | 文件不存在，跳过 |
| M6 | preferences/storage.ts 空 catch | `src/features/preferences/storage.ts` | 已在 H5 修复中统一处理 |
| M7 | rules/persistence.ts 空 catch | `src/features/rules/persistence.ts` | 补全所有 catch 块的 `console.error` 日志 |
| M8 | ziwei/history.ts 空 catch | `src/features/ziwei/history.ts` | 补全 `console.error` 和 `console.warn` 日志 |
| M9 | buildZiweiAiPayload 超过 80 行 | `src/features/ziwei/ai-utils.ts` | 重构为 5 个独立辅助函数：`mapPalaceCell`、`mapHuaTrack`、`buildCenterData`、`mapDaXianItem`、`mapLiuNianItem` |
| M10 | generatePostgresFunctionStatement 超过 67 行 | 不存在 | 文件不存在，跳过 |
| M11 | fetch 封装重复 | `src/lib/edge.ts`, `src/api/http.ts` | 统一：ApiError 定义在 `lib/edge.ts`，edgeFn 定义在 `api/http.ts` |

### LOW 优先级修复

| # | 问题 | 修复文件 | 修复内容 |
|---|------|----------|----------|
| L1 | LegacyFrameView.vue 硬编码颜色 | `src/components/business/legacy/LegacyFrameView.vue` | 移除 CSS 变量 fallback 值，使用 tokens.css 定义的变量 |
| L2 | ziwei/history.ts 缺少 console.warn | `src/features/ziwei/history.ts` | 已在 M8 修复中统一处理 |
| L3 | ai 模块测试 | - | 建议后续添加 |
| L4 | 其他遗留项 | - | 待处理 |

### CSS Token 扩展

`src/styles/tokens.css` 新增暗色主题 CSS 变量：

```css
[data-theme='dark'] {
  --color-overlay: rgba(2, 6, 23, 0.58);
  --color-modal-bg: linear-gradient(...);
  --color-modal-border: rgba(59, 130, 246, 0.35);
  --color-modal-text: #e2e8f0;
  --color-modal-text-subtle: #94a3b8;
  --color-modal-input-bg: rgba(15, 23, 42, 0.7);
  --color-modal-input-border: rgba(148, 163, 184, 0.4);
  --color-modal-primary: #2563eb;
  --color-modal-primary-hover: #1d4ed8;
  --shadow-modal: 0 14px 40px rgba(2, 6, 23, 0.45);
}
```

### 本次修改文件清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/env.d.ts` | 修改 | 添加 VITE_API_TIMEOUT_MS |
| `src/main.ts` | 修改 | 使用 CSS 变量 |
| `src/styles/tokens.css` | 修改 | 扩展暗色主题 CSS 变量 |
| `src/components/business/auth/AuthModal.vue` | 修改 | 迁移硬编码颜色和错误信息 |
| `src/components/business/legacy/LegacyFrameView.vue` | 修改 | 移除 CSS 变量 fallback |
| `src/features/preferences/storage.ts` | 重写 | key 规范化、添加限制、补充日志 |
| `src/features/rules/persistence.ts` | 修改 | 补充所有 catch 错误日志 |
| `src/features/ziwei/history.ts` | 修改 | 补充所有 catch 错误日志 |
| `src/features/ziwei/ai-utils.ts` | 重构 | 拆分长函数为独立辅助函数 |
| `src/lib/edge.ts` | 重构 | ApiError 定义，移除重复 edgeFn |
| `src/api/http.ts` | 修改 | 导入 ApiError，统一 edgeFn |
| `src/utils/error-map.ts` | 修改 | 补充 20+ auth 错误码 |
| `supabase/migrations/202604230001_create_feedback_entries.sql` | 修改 | 补充表/列注释 |
| `supabase/migrations/202604290001_create_profiles.sql` | 修改 | 补充表/列注释 |
| `docs/CONTEXT_FULL.md` | 修改 | 更新本次变更记录 |

---

## 2026-05-01: Homepage Feedback And Scrollbar Restoration

- 首页反馈入口恢复为左侧贴边竖向按钮：`src/components/business/feedback/FeedbackWidget.vue` 改回固定左侧 `left: 0`、`writing-mode: vertical-rl` 的依附式反馈条，不再使用右下角悬浮按钮。
- 修复反馈组件乱码和损坏标签：反馈按钮、弹窗标题、分类、占位符、提交状态等文案恢复为 UTF-8 中文；在线提交逻辑仍走 `submitFeedback()`，错误提示继续使用统一错误映射。
- 首页滚动容器保持独立滚动：`src/pages/splash/splash.css` 中 `#splash-poster` 保持 `overflow-y: auto` 与 `scrollbar-width: thin`，并补齐明暗主题滚动条颜色，接近主工作台输入/输出区的细滚动条质感。
- 浏览器实测：首页反馈按钮 `left=0`、`position=fixed`、`writingMode=vertical-rl`；首页滚动容器 `overflowY=auto`、`scrollbarWidth=thin`。
- 验证通过：`pnpm build`、`pnpm test:smoke`、`pnpm test:unit`、`pnpm check:utf8`。`splash.css` 仍保留历史手写压缩格式，未整文件 Prettier 格式化，避免产生大面积无关 diff。

## 2026-04-30: Strangler Mode — Homepage Native SFC + Legacy Hardening

- 恢复认证为全局 Vue 弹窗体验：`src/components/business/auth/AuthModal.vue` 承载密码登录、验证码登录、密码注册、验证码重置密码；首页/Header 登录入口不再跳独立登录页，`/login` 仅保留为打开弹窗的兼容入口。
- 修复首页进入工作台白屏：`src/legacy/app.js` 中 ID 工具与 SQL 转换动作模块已按迁移后的 flat options 接口传参，避免 `idProvince` / `convertRemote` 等旧变量缺失导致 Vue setup 崩溃；首页底部 CTA 恢复为登录/注册语义。
- 修复首页鼠标滚轮无法上下滚动：`#splash-poster` 改为视口高的独立滚动容器；修复工作台退出/返回首页不即时：legacy auth 的 `returnToSplashHome()` 在 iframe 内优先 `postMessage` 给父级 Vue Router。
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
- 运行模式：Vue 3 应用 + 原生 SFC 工作台（已移除 legacy iframe）
- 部署目标：GitHub Pages（前端）+ Supabase Cloud（后端）

### 页面结构

- 首页（Splash）：产品介绍 + 登录入口
- 工作台（Workbench）：SQL 转换 / 证件工具 / 紫微斗数（原生 Vue SFC 实现）
- 登录页 / 404 页：Vue 3 原生渲染

### Edge Functions（11 个）

| 函数 | 用途 | Auth 策略 | Rate Limit |
|------|------|----------|------------|
| `convert` | SQL DDL/函数/过程转换 | Bearer token → `/auth/v1/user` | userId+IP, 20 req/60s |
| `feedback` | 用户反馈提交 | Bearer token → `/auth/v1/user` | userId+IP, 默认配置 |
| `ziwei-analysis` | 紫微 AI 深度解盘 | Bearer token → `/auth/v1/user` + 邮箱白名单 | userId+IP, 6 req/60s |
| `ai-chat` | AI 对话助手 | Bearer token → `/auth/v1/user` | userId+IP, 统一全局限流 |
| `ai-config` | AI 配置管理（管理员） | Bearer token → `/auth/v1/user` + admin | userId+IP, 统一全局限流（写操作） |
| `feedback` | 用户反馈提交 | Bearer token → `/auth/v1/user` | userId+IP, 统一全局限流 |
| `app-config` | 应用配置管理（管理员） | Bearer token → `/auth/v1/user` + admin | userId+IP |
| `operation-logs` | 操作日志查询 | Bearer token → `/auth/v1/user` | userId+IP |
| 其他 4 个 | 辅助/工具型函数 | Bearer token → `/auth/v1/user` | userId+IP |

> 三个函数均设置 `verify_jwt = false`，在函数内部通过 Supabase Auth API 校验 token。

### 安全配置

- CORS：`app_configs` 表管理（`cors.primary_origin` / `allowed_origins` / `allow_localhost` / `allow_headers` / `allow_methods`），环境变量为回退
- Rate Limit：统一全局限流（`rate_limit.max_requests` / `window_ms`，默认 10 req/60s），Deno KV 持久化（可降级为内存）
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

**已迁移区域（2026-05-04 完成）**：所有 legacy 代码已删除，工作台完全由原生 Vue SFC 实现。

**历史遗留（已废弃）**：以下描述的是 2026-05-03 之前的状态，legacy 文件夹已被完全删除。
- legacy 中的大段 DOM 操作执行、跨功能运行时耦合块、UI 渲染生命周期绑定（已删除）

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

### Legacy 运行文件（已废弃）

以下文件已于 2026-05-04 删除：
- `src/legacy/app.js` — 工作台主逻辑（已删除）
- `src/legacy/auth.js` — 认证逻辑（已删除）
- `src/legacy/bootstrap.js` — 启动引导（已删除）
- `src/legacy/splash.js` — 首页逻辑（已删除）
- `src/legacy/startup-view.js` — 启动视图选择（已删除）
- `src/legacy/style.css` — 工作台样式（已删除）

所有功能已迁移到原生 Vue SFC 组件。

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
