# AI_DEV 规范整改方案

> 本文记录 2026-05-22 按 `docs/AI_DEV.md` 审查项目后的整改计划。  
> 目标是恢复完整质量门禁，收敛规范偏差，并补齐后续可维护性治理。

## 1. 整改目标

1. 恢复 `pnpm verify` 为完整可用的门禁入口。
2. 修复当前实现与测试、脚本、文档之间的不一致。
3. 收敛前端 API 边界、错误处理、状态持久化和 Design Token 使用。
4. 对确需保留的例外建立明确说明或脚本豁免，避免长期误报。

## 2. 当前审查结论

当前项目可以完成生产构建，但不满足完整门禁要求。

已验证结果：

- `pnpm build`：通过。
- `pnpm check:utf8`：通过。
- `pnpm verify`：失败。
- `pnpm lint --quiet`：失败，存在 2 个真实错误。
- `pnpm check:css-colors`：失败，硬编码颜色基线漂移。
- `pnpm test`：失败，smoke 断言与当前实现不匹配。
- `pnpm test:unit`：失败，单测与当前 API/主题实现脱节。

## 3. P0：恢复门禁阻塞项

### 3.1 修复 ESLint 真实错误

涉及文件：

- `src/pages/operation-logs/index.vue`
- `src/stores/ai.ts`

整改项：

1. `operation-logs/index.vue:188` 中 `modalDrag` 是 `ref`，应通过 `.value` 读写。
   - 当前问题：`modalDrag.isDragging = false`
   - 建议修复：`modalDrag.value.isDragging = false`

2. `stores/ai.ts:91` 中 `persistSelection()` 未使用。
   - 如果 AI 配置选择持久化仍是业务需求，应把它接回实际选择变更链路。
   - 如果该状态已废弃，应删除函数及相关无用存储逻辑。

验收：

- `pnpm lint --quiet` 不再出现 error。

### 3.2 修复单元测试与实现脱节

涉及文件：

- `tests/unit/api-http.test.ts`
- `tests/unit/composables.test.ts`
- `src/api/http.ts`
- `src/lib/edge.ts`
- `src/composables/useThemeRuntime.ts`

当前 6 个失败用例分布：

- `tests/unit/api-http.test.ts`：3 个失败（导入路径与实际模块不匹配）
- `tests/unit/composables.test.ts`：3 个失败（主题行为断言与实现脱节）

整改项：

1. `tests/unit/api-http.test.ts` 当前从 `@/api/http` 导入 `invokeEdgeFunction`，但该函数实际位于 `src/lib/edge.ts`。
   - 方案 A：测试改为从 `@/lib/edge` 导入。
   - 方案 B：在 `src/api/http.ts` 保留兼容导出。
   - 推荐方案：优先方案 A，避免继续扩大 `api/http.ts` 的历史兼容面。

2. `tests/unit/composables.test.ts` 中主题行为仍按旧 `system` 模式断言。
   - 当前实现中 `useThemeRuntime` 已将旧 `system` 存储值归一为 `light`。
   - 测试应同步当前规则，或者如果业务需要恢复 system 模式，则应先修改实现，再改测试。

验收：

- `pnpm test:unit` 通过（12 个用例全部通过）。

### 3.3 修复 smoke 断言过脆问题

涉及文件：

- `tests/smoke.mjs`
- `src/pages/workbench/index.vue`

整改项：

1. 当前 smoke 精确匹配字符串：
   - `router.replace(buildWorkbenchPath(normalized))`

2. 实际实现已演进为带 `void` 前缀和权限参数：
   - `void router.replace(buildWorkbenchPath(normalized, { canAccessZiweiTool }))`

3. smoke 应改为语义断言：
   - 确认页面存在 `normalizeWorkbenchSection`
   - 确认页面存在 `router.replace`
   - 确认页面存在 `buildWorkbenchPath`
   - 不依赖完整调用字符串。

验收：

- `pnpm test` 通过。

## 4. P1：收敛工程规范偏差

### 4.1 收敛前端直接 fetch

涉及文件：

- `src/components/business/feedback/FeedbackWidget.vue`
- `src/components/business/workbench/pages/IdToolPage.vue`

整改项：

1. `FeedbackWidget.vue` 中 Edge Function warmup 直接调用 `fetch`。
   - 建议迁移到 `src/api/feedback.ts`，由 API 层提供 `warmupFeedback()`。
   - 组件只调用 API 封装，不直接拼接 Edge Function 地址。

2. `IdToolPage.vue` 中读取 `region_codes_2024.json` 属于静态资源读取。
   - 可作为例外保留。
   - 建议封装为 `src/api/static-assets.ts` 或增加注释，说明它不是业务 API 请求。

验收：

- 页面组件不再直接拼接 Edge Function URL。
- 静态资源读取例外有明确说明。

### 4.2 收敛空 catch / 静默失败

涉及范围：

- `src/utils/storage.ts`
- `src/components/business/workbench/pages/IdToolPage.vue`
- `supabase/functions/**`（执行前先运行 `grep -rn 'catch\s*{' supabase/functions/` 确认具体文件清单）

整改项：

1. 将空 `catch {}` 或 `.catch(() => {})` 改为显式非阻塞处理。
2. 对日志失败、warmup 失败、缓存失败建立统一 helper。
3. helper 命名要表达意图，例如：
   - `ignoreNonCriticalError(error, context)`
   - `logBackgroundFailure(context, error)`
   - `safeLogOperation(entry)`

注意：

- Edge Function 中日志写入失败不能影响主请求，但也不应无声吞掉所有异常。
- 日志内容必须继续脱敏，不能输出 token、密钥、完整 SQL 或上游原始报文。

验收：

- 不再出现无说明的空 `catch`。
- 非阻塞失败有统一上下文。

### 4.3 检查 AI 状态持久化链路

涉及文件：

- `src/stores/ai.ts`
- `src/components/business/ai/**`

整改项：

1. 明确 `selectedConfigId` 是否仍是有效业务状态。
2. 如果仍需要保留：
   - 在选择配置时调用持久化逻辑。
   - 按用户维度隔离缓存。
   - 保留 TTL 或版本策略。
3. 如果不再需要：
   - 删除 `selectedConfigId`
   - 删除 `persistSelection`
   - 删除对应 localStorage 读写函数。

验收：

- 无 dead code。
- 用户相关缓存按用户隔离。

## 5. P2：Design Token 与样式治理

### 5.1 修复 CSS hardcoded color 基线漂移

涉及文件包括但不限于：

- `src/components/business/ai/FloatingChat.vue`
- `src/components/business/feedback/FeedbackWidget.vue`
- `src/components/business/workbench/modals/SharePosterModal.vue`
- `src/components/business/workbench/pages/SqlConvertPage.vue`
- `src/components/business/workbench/pages/ZiweiPage.vue`
- `src/components/business/workbench/WorkbenchApp.vue`
- `src/components/common/SkinPicker.vue`
- `src/styles/skins.css`

整改项：

1. 组件内新增硬编码颜色优先替换为 `tokens.css` 或 `skins.css` 中已有 token。
2. 对确实属于皮肤定义的颜色，保留在 `src/styles/skins.css`。
3. 调整 `scripts/check-css-colors.mjs`：
   - `tokens.css`、`skins.css` 应作为 token 源文件豁免或单独规则处理。
   - 组件、页面、业务样式文件继续严格检查。

验收：

- `pnpm check:css-colors` 通过。
- 未通过简单更新 baseline 掩盖组件硬编码问题。

### 5.2 补充视觉验收

重点页面/组件：

- AI 浮窗
- 反馈面板
- 分享海报弹窗
- 紫微页面
- 皮肤切换器
- SQL 转换页面

验收项：

1. 深色/浅色模式可用。
2. 5 套 skin 下主要文本、按钮、边框、浮层对比度正常。
3. 移动端无明显遮挡、溢出、不可点击区域。
4. 关键按钮具备 hover、active、disabled、focus-visible 状态。

## 6. P3：文档与长期治理

### 6.1 更新项目上下文

涉及文件：

- `docs/CONTEXT_FULL.md`

整改项：

1. 记录本轮整改完成状态。
2. 同步当前主题系统实际行为。
3. 同步 API 边界例外。
4. 同步 CSS hardcoded color 检查策略。
5. 同步测试入口和门禁状态。

验收：

- 文档与当前实现一致。
- 不把临时状态写成长期规范。

### 6.2 优化门禁可读性

整改项：

1. 保留 `pnpm verify` 为完整入口。
2. 必要时增加分组脚本，便于快速定位失败类型，例如：
   - `pnpm verify:static`
   - `pnpm verify:test`
   - `pnpm verify:style`
3. 避免 lint/prettier 噪音淹没真实错误。
4. 考虑将 `verify` 中的 `pnpm lint` 改为 `pnpm lint --quiet`，或另设 `verify:ci`（严格）与 `verify`（日常）区分，确保 warning 噪音不影响门禁判断。

验收：

- 失败时能快速定位是类型、lint、CSS、smoke 还是 unit test 问题。

## 7. 推荐执行顺序

1. 修复 P0 ESLint 错误。
2. 修复 P0 测试与 smoke 断言。
3. 跑通 `pnpm lint`、`pnpm test`、`pnpm test:unit`。
4. 收敛 P1 项：前端直接 fetch（§4.1）、空 catch（§4.2）、AI 状态持久化链路（§4.3）。
5. 修复 P2 CSS hardcoded color 问题。
6. 跑通 `pnpm check:css-colors`。
7. 执行完整 `pnpm verify`。
8. 执行 `pnpm build`。
9. 更新 `docs/CONTEXT_FULL.md`。

## 8. 最终验收标准

必须满足：

- `pnpm verify` 通过。
- `pnpm build` 通过。
- `pnpm check:utf8` 通过。
- `pnpm check:css-colors` 通过或规则已明确豁免 token 源文件。
- 关键 UI 在深色、浅色、不同 skin 下无明显视觉回归。
- `docs/CONTEXT_FULL.md` 已同步阶段性事实。

## 9. 部署与迁移评估

本整改方案主要涉及前端、测试、脚本和文档。

- 不涉及数据库 schema 变更。
- 不需要执行 Supabase migration。
- 不需要重新生成 `src/types/database.types.ts`。
- 如果改动 Edge Function 的日志处理 helper，需要重新部署对应 Edge Function。
- 如果只改前端、测试、CSS 和文档，仅需常规前端构建部署。

如本轮整改实际修改 Edge Function，应在完成后补充具体部署步骤。
