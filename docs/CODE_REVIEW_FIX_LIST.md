# 代码评审修复清单

> 2026-05-11 生成，共 76 条 + 7 条补充建议。每条包含文件、行号、严重程度、问题和具体修改建议。
>
> **76 条** = 安全/Bug/空catch/架构/UX 问题，需直接修改代码。
> **A1~A7** = 硬编码默认值/配置项/tokens 类问题，统一通过 app_configs 或 tokens.css 解决。

---

## 一、HIGH（16 条）— 安全 / 空catch / 严重Bug

### 安全

**1. ai-chat/index.ts:144 — AI 上游错误信息泄露给前端**
> 当前：`Error(\`ai_upstream_error: ${res.status} ${errText.slice(0, 200)}\`)` 将 AI 供应商原始响应截取 200 字符直接返回给用户。
> 建议：改为 `throw new Error('ai_upstream_error')`，仅记录状态码但不透传正文；错误正文通过 `logEdgeError` 记录到服务端日志。

**2. ai-config/index.ts 全线 — CRUD 接口无频率限制**
> 当前：`handleCreate`、`handleUpdate`、`handleDelete`、`handleActivate`、`handleDeactivate`、`handleReorderProviders` 等无任何限流。
> 建议：在 `Deno.serve` 入口处创建模块级限流器，参数从 app_configs 读取（参见 A1 全局限流方案），避免硬编码 `windowMs`/`maxRequests`。

**3. feedback/index.ts:105-111 — 频率限制器每次请求重新创建**
> 当前：`createRateLimiter` 写在请求 handler 内部，KV 不可用时每次创建空 Map，完全无限流。
> 建议：将 `createRateLimiter` 移到模块顶层，参数统一从 app_configs 读取（参见 A1 全局限流方案）。

**4. ai-config/index.ts:758-766 — provider 更新失败导致 configs 永久丢失**
> 当前：先 `delete()` 孤儿 configs，再 `update()` provider；若更新失败，configs 已删无法回滚。
> 建议：调换顺序 — 先 update provider，失败直接返回；成功后再删除孤儿 configs。

**5. migrations/202605030006:9 — ai_configs.api_key 明文存储**
> 当前：`api_key TEXT`，注释写明"明文存储"。
> 建议：增加 `is_encrypted BOOLEAN DEFAULT true`，写入时用 `_shared/crypto.ts` 的 `encryptValue()` 加密，读取时解密。

**6. ai-chat/index.ts:11-12 — CORS 初始化顺序 bug**
> 当前：`createCorsHelpers({})` 在 `await initCorsConfig()` 之前执行，DB 配置永远不生效。
> 建议：将 `await initCorsConfig()` 移到 `createCorsHelpers({})` 之前。

### 空 catch 块

**7. useChat.ts:52 — loadSessions 空 catch**
> 建议：`catch (err) { console.error('[useChat] Failed to load sessions:', err) }`。

**8. AiConfigPage.vue:217,224 — readSelectedFromStorage / writeSelectedToStorage 空 catch**
> 建议：`readSelectedFromStorage` 的 catch 中 `console.warn('[AiConfig] Failed to read model selection:', e)`；`writeSelectedToStorage` 同理。

**9. AiConfigPage.vue:445-447 — handleToggleActive 空 catch**
> 建议：`catch (e) { console.error('[AiConfig] Toggle active failed:', e) }`。

**10. stores/ai.ts:71,130,146 — preload / activateConfig / deactivateConfig 空 catch**
> 建议：每处至少 `console.error('[AiStore] Operation failed:', err)`。

**11. ai-chat/index.ts:87-89 — checkQuota 空 catch（DB 故障时绕过配额）**
> 建议：`catch (err) { console.error('[ai-chat] Quota check failed:', err); return { allowed: false, used: 0, remaining: 0 } }`，DB 故障时拒绝放行。

### Bug

**12. useConfirm.ts:17 — 连续调用 confirm() 第一次 Promise 永远挂起**
> 建议：改为队列模式 — `const queue: Array<{ resolve, reject }> = []`，每次 `confirm()` push 进队列，对话框关闭时 shift 队首 resolve。或改为：第二次调用时自动 reject 第一次的 Promise 并 `console.warn`。

**13. useChat.ts:44 — loadingSessions/loadingQuota 异常时永久死锁**
> 建议：改为 `ref(false)` 或确保 `finally` 块一定执行；将模块级变量改为在闭包中通过 `try/finally` 保护的局部变量。

**14. AddKeyModal.vue:112-123 — submitting 永久锁定**
> 建议：`handleSubmit` 中 `emit('save', ...)` 用 `try/finally` 包裹，`finally { submitting.value = false }`。

**15. AiConfigPage.vue:693 — 死代码 @mousemove 在 pointer-events:none 元素上**
> 建议：删除 tooltip 元素上的 `@mousemove="onTooltipMouseMove"`；仅保留卡片上的 `@mousemove`。

**16. FloatingChat.vue:187 — @keydown.esc 在不可聚焦 div 上不生效**
> 建议：改为 `onMounted(() => document.addEventListener('keydown', onEsc))` + `onUnmounted(() => document.removeEventListener(...))`（与 ConfirmDialog 一致）。

---

## 二、MEDIUM（35 条）— 应尽快修复

### 可维护性

**22. AiConfigPage.vue:2-577 — script 575 行（限制 150 行）**
> 建议：拆分为：
> - `composables/useDragReorder.ts` — 拖拽排序逻辑（~120 行）
> - `composables/useTestCooldown.ts` — 测试冷却逻辑（~50 行）
> - `composables/useModelSelection.ts` — 模型选择 + localStorage（~50 行）
> - `composables/useProviderTooltip.ts` — 悬停提示（~30 行）
> - `AiConfigPage.vue` 主组件仅保留模板 + 组合调用（~100 行）

### 前端 UX & Bug

**23. FloatingChat.vue:118-120 — 删除会话无确认**
> 建议：`handleDeleteSession` 内调用 `await confirm('确定删除该对话？', { title: '删除会话', confirmText: '删除', confirmClass: 'danger' })`，确认后再执行。

**24. FloatingChat.vue:122-128 — formatTime 对无效日期崩溃**
> 建议：函数开头加 `if (!iso) return '--'`；`const d = new Date(iso); if (isNaN(d.getTime())) return '--'`。

**25. useChat.ts:114-118 — 发送失败输入丢失**
> 建议：发送前将消息文本暂存到局部变量 `const text = content`；失败时恢复 `inputText.value = text`（需将 inputText 传入 composable 或通过回调处理）。

**26. FeedbackWidget.vue:19 — status 跨开关周期残留**
> 建议：在 `openModal` / `toggleOpen` 打开弹窗时调用 `status.value = ''` 重置。

**27. FeedbackWidget.vue:33 — VITE_SUPABASE_URL 未设时得到 "undefined"**
> 建议：改为 `const supabaseUrl = import.meta.env.VITE_SUPABASE_URL; if (!supabaseUrl || supabaseUrl === 'undefined') return;`。

**28. AiConfigPage.vue:563-566 — maskApiKey 是空操作**
> 建议：删除 `maskApiKey` 函数，模板中 `maskApiKey(group.apiKeyMasked)` 改为直接 `group.apiKeyMasked`。

**29. AiConfigPage.vue:800 — getSelectedConfig 每行重复调用 15+ 次**
> 建议：新增 computed `const tableRows = computed(() => groupedConfigs.value.map(g => ({ group: g, selected: getSelectedConfig(g) })))`，模板中遍历 `tableRows`。

**30. AiConfigPage.vue:624-632 — 删除按钮仅 hover 可见**
> 建议：`.provider-card:focus-within .card-delete-btn { opacity: 1 }` 并给卡片加 `tabindex="0"`。

**31. AppHeader.vue:579-583 — 移动端导航直接隐藏**
> 建议：≤768px 时显示汉堡按钮，点击展开垂直菜单。或复用 WorkbenchHeaderActions 的三点菜单模式。

**32. WorkbenchSidebar.vue:268 — 亮色模式 hover 不可见**
> 建议：`background: var(--color-page-elevated)` 替代 `rgba(255,255,255,0.06)`。

**33. WorkbenchSidebar.vue:115-126 — 折叠状态按标题字符串匹配**
> 建议：给 menuGroups 添加 `key: string` 字段（如 `'testTools'`、`'settings'`），用 key 做映射。

**34. WorkbenchApp.vue:11-21 — 异步组件无 fallback**
> 建议：`defineAsyncComponent({ loader: () => import(...), loadingComponent: Spinner, errorComponent: ErrorCard, delay: 200 })`。

**35. WorkbenchSidebar.vue:273-283 — collapse 动效跳变**
> 建议：全局 `main.css` 已有正确的 collapse 动效（含 max-height），侧边栏改用全局版本或补充 max-height 过渡。

**36. AppHeader / WorkbenchHeaderActions — 主题切换 UI 重复**
> 建议：抽取 `ThemeSwitch.vue` 组件，两处复用。WorkbenchHeaderActions 中仅保留用户菜单，主题切换统一到 AppHeader。

**37. app.ts:15-17 — hydrateTheme 与 setTheme 完全相同**
> 建议：删除 `hydrateTheme`，统一用 `setTheme`。

**38. ProviderConfigModal / AddKeyModal / ConfigEditModal — ESC 处理三处重复**
> 建议：抽取 `composables/useEscapeKey.ts`：`export function useEscapeKey(callback: () => void) { onMounted(() => document.addEventListener('keydown', handler)); onUnmounted(() => document.removeEventListener(...)) }`。

### 前端死代码 & 性能

**39. FloatingChat.vue:54,59,65 — chat-open class 无对应 CSS**
> 建议：删除 `document.body.classList.add('chat-open')` 及相关代码。

**40. FloatingChat.vue:311 — 消息容器无 aria-live**
> 建议：`<div ref="messagesEl" class="chat-messages" role="log" aria-live="polite">`。

**41. FloatingChat.vue:68-78 — deep watcher 过于昂贵**
> 建议：改为 `watch(() => messages.value.length, () => { nextTick(() => scrollToBottom()) })`。

**42. ConfirmDialog.vue — 打开时不管理焦点**
> 建议：`watch(show, (val) => { if (val) nextTick(() => confirmPanel.value?.focus()) })`，面板加 `tabindex="-1" ref="confirmPanel"`。

**43. ConfigEditModal.vue — 疑似死代码**
> 建议：确认是否被其他页面使用（grep 全仓引用），若仅 AiConfigPage 相关且未引用则删除。

**45. provider-constants.ts:59 — githubmodels 键名不匹配**
> 建议：改为 `'github-models': 'GH'` 。

**46. AppHeader.vue:357-360 — 暗色覆盖与原有值重复**
> 建议：删除此段，color 已通过 `var(--color-accent)` 在 tokens 中按主题切换。

### 后端

**47. ai-chat/index.ts:123-124,128 — temperature / max_tokens 硬编码 + 自动重试导致限流风险**
> 当前：`temperature: 0.7`、`max_tokens: 4096` 写死在代码中；`for (let attempt = 0; attempt < 2; attempt++)` 失败自动重试，若 AI 供应商返回 429 限流，重试会加剧限流。
> 建议：
> 1. `loadChatConfig()` 中增加两个配置读取（**不加 defaultValue，强制从 app_configs 读取**）：
>    ```ts
>    getAppConfig<number>('ai_chat', 'temperature', { envVar: 'AI_CHAT_TEMPERATURE', parse: Number }),
>    getAppConfig<number>('ai_chat', 'max_tokens', { envVar: 'AI_CHAT_MAX_TOKENS', parse: Number })
>    ```
> 2. 迁移中写入初始值：`('ai_chat', 'temperature', '0.7', 'number', ...)`、`('ai_chat', 'max_tokens', '4096', 'number', ...)`
> 3. 删除 `callAi` 中的 `for (let attempt = 0; attempt < 2; attempt++)` 重试循环，改为单次调用，失败直接抛错不重试

**48. ai-config/index.ts:550 — handleActivate 全量停用+单点激活无事务保护**
> 建议：先 `select('id').eq('id', id).single()` 确认目标存在，不存在返回 404；存在再执行 update all → activate one。

**49. ai-config/index.ts:511 — DELETE 不存在的资源返回 ok**
> 建议：`const { data, error } = await adminClient.from(...).delete().eq('id', id).select('id').single()`；若 `!data` 返回 404。

**50. ai-config/index.ts:93-95 — getClientIp 重复实现**
> 建议：删除本地实现，改为 `import { getClientIp } from '../_shared/request.ts'`。

**51. ai-config/index.ts:1357-1358 — sanitizeError 泄露内部结构**
> 建议：改为返回固定泛化消息，如 `'An internal error occurred'`；原始 error 仅通过 `logEdgeError`/`logOperation` 记录。

**52. ai-chat/index.ts:352-366,513 — 配额检查与递增分离存在竞态**
> 建议：改造现有 `increment_ai_chat_quota` RPC（或新增带 limit 入参的变体）为“原子判断 + 递增”一体，避免先查后增的竞态。

**53. migrations/202605080001 — 缺少 user_id 索引**
> 建议：新增迁移 `CREATE INDEX idx_ai_chat_sessions_user ON ai_chat_sessions(user_id, updated_at DESC)`。

### 后端函数过长

**54. ai-chat/index.ts:162-562 — handleAiChatRequest ~400 行**
> 建议：拆分为：`handleListSessions`、`handleGetMessages`、`handleGetQuota`、`handleDeleteSession`、`handleSendMessage`、`loadChatConfig`（此函数已有）。

**55. ai-config/index.ts:997-1211 — handleTest ~214 行**
> 建议：拆出 `validateCooldown`、`buildTestRequest`、`executeTest`、`formatTestResult`。

**56. ai-config/index.ts:266-399 — handleCreate ~133 行**
> 建议：拆出 `validateCreateInput`、`lookupExistingKey`。

**57. ai-config/index.ts:1213-1360 — 主 handler ~147 行**
> 建议：主 handler 仅做路由分发，每种 HTTP method+path 组合委托给独立 handler 函数。

---

## 三、LOW（25 条）— 技术债务

### 通用（前后端）

**58. ai-chat/index.ts:235（后端）— GET messages 无分页**
> 建议：增加 `.limit(100)` 防止超长对话撑爆响应。

**59. ai-config/index.ts:675-682 — reorder N 次 UPDATE**
> 建议：改用 Supabase RPC 函数，传入 `{ provider_id, sort_order }[]`，SQL 中用 `UNNEST` + `UPDATE ... FROM` 一次完成。

**60. http.ts:67-69 — 去重 key 依赖 JSON 属性顺序**
> 建议：改为稳定序列化（递归 key 排序）后再生成去重 key，避免仅排序第一层导致嵌套对象不稳定。

**61. ai-chat.ts:61-62 — getMessages 缺少 skipRetry**
> 建议：`edgeFn.get<MessagesResponse>(\`/ai-chat/messages?...\`, { skipRetry: true })`。

**62. useChat.ts:18-27 — 模块级 ref 而非 Pinia**
> 建议：保持现状并加注释说明为什么选择 composable 单例而非 Pinia（AI 对话框有 DOM 耦合，不适合 store）。或迁移到 `stores/chat.ts`。

**63. useChat.ts:33-41 — getErrorMessage 每次创建闭包**
> 建议：移到模块顶层 `function getChatErrorMessage(err: unknown): string { ... }`。

**64. useChat.ts:64,68,70 — console.log 遗留**
> 建议：删除或改为 `if (import.meta.env.DEV) console.log(...)`。

**65. feedback.ts:6 — scene 字段未使用**
> 建议：删除 `FeedbackRequest.scene` 字段，或在 FeedbackWidget 中使用。

**66. useThemeRuntime.ts:53 — 无防重复调用保护**
> 建议：模块顶层 `let initialized = false`；函数开头 `if (initialized) return; initialized = true;`。

### 前端无障碍

**67. WorkbenchSidebar.vue:163,188,191 — 缺少 ARIA 属性**
> 建议：`<aside aria-label="主导航">`，`<nav aria-label="功能菜单">`，折叠按钮加 `:aria-expanded="!collapsed"` + `:aria-controls="group-${key}"`。

**68. AppHeader/WorkbenchHeaderActions:51,108 — 三点按钮缺少 aria**
> 建议：加 `aria-haspopup="true"` + `:aria-expanded="showMenu"`。

**69. ConfirmDialog.vue:22 — 关闭按钮无 aria-label**
> 建议：`aria-label="关闭对话框"`。

**70. FeedbackWidget.vue:184-190 — 状态消息无 role**
> 建议：`<p role="alert" aria-live="assertive">`。

### 前端小问题

**71. FeedbackWidget.vue:77 — 错误映射用于成功消息**
> 建议：成功消息从独立常量 `const SUCCESS_MESSAGES = { feedback_success: '提交成功' }` 读取。

**72. WorkbenchSidebar.vue:101-153 — 重复 setPage 调用**
> 建议：`handleItemClick` 内仅 `router.push(path)`，删除 `store.setPage(item.page)`；watch 中调用 `store.setPage` 由路由变化驱动。

**73. AiConfigPage.vue:1785 — rgba(239,68,73,0.3) B 值 typo**
> 建议：`rgba(239, 68, 68, 0.3)`（B 值应为 68 而非 73）。

**74. AiConfigPage.vue:574 — onMounted async 未 catch**
> 建议：`.catch(err => { error.value = getErrorMessage(err) })`。

**75. AppHeader.vue:285,292 — 玻璃效果重复**
> 建议：移除自定义 backdrop-filter，改为 `background: var(--glass-bg); backdrop-filter: var(--glass-blur)`，由 tokens.css 统一定义。

### 后端小问题

**76. ai-resolver.ts / ai-config/index.ts — 接口重复定义**
> 建议：新建 `_shared/ai-types.ts`，导出 `AiConfigRow`、`AiProviderRow`，两处导入。

**77. ai-chat / ai-config — getAdminClient 行为不一致**
> 建议：统一为抛出异常（`throw new Error('Supabase not configured')`），由调用方 try/catch。

**78. cors.ts:86 — allowLocalhost 默认 true**
> 建议：改为 `Deno.env.get(allowLocalhostEnvKey) === 'true'`（opt-in 而非 opt-out），或生产部署文档中明确要求设置此环境变量为 `false`。

**79. FeedbackWidget.vue:39 — OPTIONS warmup 的空 catch**
> 建议：`fetch(...).catch(() => { /* warmup failure is non-critical */ })` 加注释说明意图，或在 catch 中 `console.debug`。

**80. ai-config/index.ts:1009 — handleTest 错误用 HTTP 200**
> 建议：cooldown → 429，not found → 404，provider not found → 400。

**81. WorkbenchSidebar collapse-* 与 main.css 同名**
> 建议：侧边栏动效改名为 `sidebar-collapse-*` 避免与全局 `collapse-*` 同名混淆。

**82. WorkbenchApp.vue:60 — placeholder 无 aria-live**
> 建议：`<div v-else class="placeholder" role="status" aria-live="polite">选择一个功能开始</div>`。

---

## 四、补充建议（可配置化 / Tokens 化，不计入以上 76 条）

**A1. ai-chat / ai-config / feedback — 三套频率限制各自硬编码，应统一为一套全局限流**
> 当前：ai-chat `(10, 60s)`、ai-config 测试 `(6, 60s)`、feedback `(10, 60s)` 三处各自写死 `maxRequests` 和 `windowMs`。
> 建议：新增 `rate_limit.max_requests`（默认 10）、`rate_limit.window_ms`（默认 60000），三个 Edge Function 统一读取；ai-config 测试接口本身已有冷却（见 A4），不再单独限流。

**A2. ai-chat/index.ts:334 + 203 — 长度/列表上限硬编码**
> 当前：消息长度上限 `4000`、会话列表 `.limit(50)` 固定写死。
> 建议：新增 `ai_chat.max_message_length`、`ai_chat.max_sessions` 两个配置项，后端校验与查询统一读取，前端输入框校验复用同一来源。

**A3. ai-config/index.ts:317-321 — 全局配置数量上限硬编码**
> 当前：`if ((count || 0) >= 20)` 写死，且是全局限制（非每用户）。
> 建议：改为读取 `ai_config.max_configs_global`，并在返回错误体里附带当前 limit，便于前端提示。

**A4. ai-config/index.ts:1028-1042 — 测试冷却时间硬编码**
> 当前：`cooldownSeconds = 10` 写死，改冷却时长需改代码。
> 建议：新增 `ai_config.test_cooldown_seconds`，启动时加载并缓存；限流本身由 A1 全局限流统一覆盖，此处仅保留冷却逻辑。

**A5. feedback/index.ts:17-21,79-80,97 — 反馈内容长度未接入配置**
> 当前：`MAX_CONTENT_LENGTH`、`MAX_CONTACT_LENGTH` 仍为常量；虽有 `feedback.max_content_length` 等配置种子，但函数未读取。
> 建议：统一改为 `getAppConfig` 读取 `feedback.max_content_length`、`feedback.max_contact_length`、`feedback.min_content_length`；限流由 A1 全局限流覆盖。

**A6. 全站硬编码 CSS 值统一走 tokens.css（11 处来源，归入一条）**
> 以下全部替换为语义 CSS 变量或 tokens.css 已有令牌：
> - AiConfigPage.vue 28+ 处 `rgba(99,102,241,0.3)` 等 → `var(--color-accent-border)`、`var(--color-success-bg)`、`var(--color-danger-bg)` 等
> - FloatingChat.vue 10+ 处 `#4f7df9`、`#8b5cf6`、`#c084fc`、`#34c759`、`#fff` → `var(--color-accent)`、`var(--color-success)`、`var(--color-btn-primary-text)`；渐变定义 `--gradient-chat-avatar`
> - WorkbenchHeaderActions.vue CSS 变量 fallback 值 → 从暗色调改亮色调 `rgba(0,0,0,0.06)`；danger hover → `var(--color-danger-bg)`；下拉阴影 → `var(--shadow-xl)`
> - WorkbenchSidebar.vue 宽度 `240px` → `var(--sidebar-width)`（同步 tokens.css 为 240px）；分组标题 → `var(--color-page-text-muted)`；Dev 图标 → `var(--color-btn-primary-text)`
> - WorkbenchApp.vue divider `top: 68px` → `calc(var(--header-height, 56px) + 12px)`
> - AppHeader.vue `max-width: 1400px` → tokens.css 新增 `--content-max-width` token
> - provider-constants.ts `PROVIDER_COLORS` → 品牌标识色可保留 hex（加注释），`getCardBgStart` 改用 `var(--color-accent-bg)`
> - 大量 `0.15s/0.2s/0.3s` 动画 → `var(--duration-fast/normal/slow)`；`10~13px` 字号 → `var(--text-xs~base)`；`6~16px` 圆角 → `var(--radius-sm~xl)`

**A7. cors.ts:60-61,72 — CORS allowHeaders / allowMethods 硬编码**
> 当前：`allowHeaders` 和 `allowMethods` 在 `runtimeConfig`（L60-61）和 `createCorsHelpers` 参数默认值（L72）两处写死，改一处漏一处。
> 建议：`initCorsConfig()` 中从 app_configs 读取 `cors.allow_headers`、`cors.allow_methods`（不改代码无法增删方法/头）；迁移写入现有值作为初始种子。

---

## 五、重复代码提取建议（不计入以上 76 条）

### 前端 — 可提取为公共组件/composable

**B1. 四个弹窗的 overlay + ESC + 关闭按钮模式重复**
> 涉及：`ProviderConfigModal`、`AddKeyModal`、`ConfigEditModal`、`FeedbackWidget`
> 重复内容：`.modal-overlay` 结构、`@click.self="close"`、ESC 监听、关闭 X 按钮、`pointer-events` 处理。
> 建议：抽取 `BaseModal.vue`（slot: header/body/footer），内置 overlay、ESC、点击外部关闭；四个弹窗改为 `<BaseModal>` 包裹。消除 ~300 行重复 CSS/JS。

**B2. AppHeader / WorkbenchHeaderActions — 主题切换按钮 + SVG 图标完全重复**
> 对应主列表 #36。建议：抽取 `ThemeToggle.vue`（含浅色/深色/系统三态），两处改为 `<ThemeToggle />`。

**B3. localStorage 读写的 try/catch 包裹模式重复 5+ 处**
> 涉及：`AiConfigPage.vue`（`readSelectedFromStorage`/`writeSelectedToStorage`）、`useThemeRuntime.ts`（`readStoredTheme`/`writeStoredTheme`）、`stores/ai.ts`（`restoreFromCache`）
> 重复模式：`try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : default } catch { return default }`
> 建议：抽取 `src/utils/storage.ts`：`getJson<T>(key, defaultVal): T` / `setJson(key, value): void`，统一 try/catch + JSON 序列化。

**B4. ESC 键监听在 4 个弹窗中各自实现**
> 对应主列表 #38。建议：抽取 `composables/useEscapeKey.ts`。

### 后端 — 可提取到 _shared/

**B5. CORS OPTIONS 预检 + origin 校验样板代码在 5 个 EF 中逐字重复**
> 涉及：`ai-chat`、`ai-config`、`feedback`、`convert`、`app-config`
> 重复 6 行：`buildCorsHeaders(req)` → OPTIONS 返回 → `!corsHeaders` 返回 403。
> 建议：`_shared/cors.ts` 新增 `handleCors(req): Response | null`，返回 null 表示放行；所有 EF 一行调用。

**B6. 错误响应格式不统一：`{ ok: false, error }` vs `{ error }`**
> `ai-chat`、`feedback` 用 `{ ok: false, error }`；`ai-config`、`app-config`、`convert` 用 `{ error }`（缺 `ok: false`）。
> 建议：`_shared/response.ts` 强制 `errorResponse()` 为唯一出口，所有 EF 统一使用。

**B7. `req.json().catch()` 在 5 个 EF 中各自手写**
> `ai-chat` 1 处、`ai-config` 6 处、`feedback` 1 处、`convert` 1 处、`app-config` 1 处。
> 建议：`_shared/request.ts` 新增 `parseJsonBody<T>(req): Promise<T | null>`。

**B8. `logOperation(...).catch(() => {})` 样板 ~60 处，userId/email/ip 每次重复传入**
> 几乎所有 EF 的每个分支都手写 `logOperation({ userId, userEmail, clientIp, ... }).catch(() => {})`。
> 建议：`_shared/operation-logger.ts` 新增 `createLogger(ctx: {userId, userEmail, clientIp})` 返回 `(operation, overrides?) => void`，消除前三个字段重复。

**B9. API Key 掩码 4 种不同实现**
> `ai-config/index.ts`（8+8 或 4+4）、`_shared/crypto.ts`（4+4）、`ai-chat/index.ts`（仅末 4 位）、`_shared/operation-logger.ts`（整字段移除）。
> 建议：`_shared/crypto.ts` 导出唯一的 `maskApiKey(key): string`，统一为前 4 + 后 4 格式；其余调用处替换。

**B10. 手动 TTL 缓存模式在 3 个文件中逐字重复**
> `ai-chat`（`loadChatConfig`）、`ai-config`（`getDefaultTimeout`）、`convert`（`getConvertConfig`），结构完全一致：`cachedXxx + time + if (now - time < TTL) return`。
> 建议：`_shared/app-config.ts` 导出 `createTtlCache<T>(fetcher: () => Promise<T>, ttlMs: number): () => Promise<T>`。

**B11. `sanitizeError` 在两个文件中各自定义**
> `ai-config/index.ts`（完整版）、`app-config/index.ts`（简化版）。
> 建议：以 ai-config 完整版为准，移入 `_shared/response.ts` 统一导出。

**B12. 管理员检查逻辑不一致**
> `ai-config` 查 `admin_users` 表，`app-config` 查 `app_metadata.is_admin`。
> 建议：`_shared/auth.ts` 新增 `checkIsAdmin(client, userId): Promise<boolean>`，统一实现。

**B13. `Deno.env.get` 三个 Supabase 变量在 8 个文件中重复读取**
> `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 每个 EF 自己读一遍。
> 建议：`_shared/app-config.ts` 导出 `getSupabaseEnv()` 返回 `{ url, anonKey, serviceRoleKey }`。

**B14. AI HTTP 调用逻辑在 ai-chat 和 ai-config 测试中各自实现**
> URL 拼接、`Authorization: Bearer` 头、错误码分类两套不同逻辑。
> 建议：新建 `_shared/ai-client.ts`，导出 `callAiProvider(config, messages, signal): Promise<string>`，统一 URL 构建和错误处理。

---

## 按文件/模块的提取收益估算

| 编号 | 提取目标 | 消除重复行数 | 提取难度 |
|------|---------|-------------|---------|
| B1 | `BaseModal.vue` | ~300 行 | 中 |
| B2 | `ThemeToggle.vue` | ~100 行 | 低 |
| B3 | `storage.ts` | ~60 行 | 低 |
| B4 | `useEscapeKey.ts` | ~30 行 | 低 |
| B5 | `handleCors()` | ~30 行 | 低 |
| B6 | 统一 errorResponse | ~10 行 | 低 |
| B7 | `parseJsonBody()` | ~10 行 | 低 |
| B8 | `createLogger()` | ~200 行 | 低 |
| B9 | 统一 maskApiKey | ~20 行 | 低 |
| B10 | `createTtlCache()` | ~40 行 | 中 |
| B11 | 统一 sanitizeError | ~10 行 | 低 |
| B12 | 统一 checkIsAdmin | ~10 行 | 中 |
| B13 | `getSupabaseEnv()` | ~20 行 | 低 |
| B14 | `callAiProvider()` | ~60 行 | 中 |
| **合计** | | **~900 行** | |

---

## 按文件的修复工作量估计

| 文件 | 问题数 | 估计工时 |
|------|--------|---------|
| `AiConfigPage.vue` | 15 | 8h（含拆分 composables） |
| `ai-config/index.ts` | 14 | 6h（含函数拆分） |
| `ai-chat/index.ts` | 10 | 4h |
| `FloatingChat.vue` | 8 | 2h |
| `WorkbenchSidebar.vue` | 8 | 2h |
| `WorkbenchHeaderActions.vue` | 6 | 1h |
| `AddKeyModal.vue` | 2 | 0.5h |
| `AppHeader.vue` | 5 | 2h |
| `useChat.ts` | 5 | 1h |
| `stores/ai.ts` | 3 | 0.5h |
| `FeedbackWidget.vue` | 4 | 1h |
| 其余 14 个文件 | 17 | 4h |
| **合计（76 条）** | **76** | **~28h** |
| 补充建议 A1~A7 | 7 | ~6h |
| **总计** | **83** | **~34h** |
