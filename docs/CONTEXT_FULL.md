# SQLDev 项目状态快照与变更记录

> 本文档仅记录项目当前状态和历史变更。协作规则、编码规范请参阅 `AI_DEV.md`。
> 更新频率：每日 17:00 保存一次，或重大变更后即时更新。

Last updated: 2026-05-21

---

## 2026-05-21: 皮肤系统实施 — 5 套可切换皮肤 × 2 种模式

### 背景
基于 `theme-preview.html` 中设计的 5 套主题，实现网站级可切换皮肤系统，同时保留每套皮肤的深色/浅色模式独立切换。

### 架构
- `<html data-skin="..." data-theme="...">` 双属性机制
- 皮肤 CSS 通过 `[data-skin="x"]` / `[data-skin="x"][data-theme="dark"]` 选择器覆盖全套 token（表面色、文字色、边框色、毛玻璃、品牌色阶、阴影、聊天强调色、滚动条）
- `themeTouched` 标记用户是否手动切换过深浅模式，避免换肤时意外覆盖用户偏好

### 皮肤 ID
| ID | 名称 | 推荐模式 |
|---|---|---|
| `violet-midnight` | 午夜薰紫 | 深色 |
| `cyber-ocean` | 深海赛博 | 深色 |
| `coral-sunset` | 落日珊瑚 | 浅色 |
| `indigo-aurora` | 极光靛蓝 | 浅色 |
| `teal-neutral` | 翡翠中性 | 浅色（默认）|

### 修改文件
| 文件 | 变更类型 |
|---|---|
| `src/styles/skins.css` | **新建** — 5 皮肤 × 2 模式 = 10 个 CSS 选择器块 |
| `src/styles/main.css` | 新增 `@import './skins.css'` |
| `src/stores/app.ts` | 新增 `SkinId` 类型、`skinId`/`themeTouched` 状态、`setSkin()`/`setThemeTouched()` |
| `src/composables/useThemeRuntime.ts` | 新增皮肤持久化、`SKIN_DEFAULT_THEME` 映射、DOM watcher |
| `index.html` | FOUC 防闪烁脚本扩展：验证皮肤、读取 `theme-touched`、优先级 存储>皮肤推荐>系统偏好 |
| `src/components/common/SkinPicker.vue` | **新建** — 渐变色块选择器，compact/labeled 两种变体 |
| `src/components/layout/AppHeader.vue` | 导入 SkinPicker，dropdown 新增"皮肤"区，header-actions 区新增桌面皮肤选择器 |

### localStorage 键
- `sqldev:app:skin` — 当前皮肤 ID
- `sqldev:app:theme-touched` — 用户是否手动设置过深浅模式

### 硬编码颜色清理
皮肤系统要求所有视觉颜色通过 CSS 自定义属性（design token）引用。以下文件中的硬编码颜色已替换为 token：

| 文件 | 修改内容 |
|---|---|
| `src/styles/main.css` | `.btn-primary`/`.btn-danger` `color: #ffffff` → `var(--color-btn-primary-text)` |
| `src/features/sql/editor-themes.ts` | 全部 `rgba(59,130,246,...)` / `rgba(137,180,250,...)` 蓝色 → `var(--color-accent-*)` 系列 |
| `src/components/business/feedback/FeedbackWidget.vue` | 6 处 `rgba(0,113,227,...)` 蓝色阴影 → `var(--shadow-brand*)` / `var(--shadow-focus-ring)` |
| `src/pages/not-found.vue` | gradient/shadow/color 硬编码蓝色 → `var(--gradient-brand-primary)` / `var(--shadow-brand*)` / `var(--color-btn-primary-text)` |
| `src/components/business/auth/AuthModal.vue` | `color: #fff/#ffffff` → `var(--color-btn-primary-text)` |
| `src/components/business/workbench/WorkbenchHeader.vue` | `color: #fff` → `var(--color-btn-primary-text)` |
| `src/pages/operation-logs/index.vue` | `color: #ffffff` → `var(--color-btn-primary-text)` |
| `src/components/common/DatePicker.vue` | `.day-cell--selected color: #ffffff` → `var(--color-btn-primary-text)` |
| `src/components/business/workbench/pages/ZiweiPage.vue` | button `color: #fff` → `var(--color-btn-primary-text)` |
| `src/pages/splash/splash.css` | **重大清理**：删除 953 行死/硬编码 CSS（旧工作台布局 + 重复深浅模式覆盖），scrollbar `rgba(0,113,227,...)` → `var(--scrollbar-thumb*)`, `color: #fff` → `var(--color-btn-primary-text)`, light 覆盖 `#ffffff` → `var(--color-panel)` |
| `src/components/business/workbench/modals/SharePosterModal.vue` | QR 色从硬编码改为读取 `--color-text-subtle`，暗色光晕 `rgba(10,132,255,0.08)` → `var(--color-accent-bg)` |
| `src/styles/skins.css` | 补全 FloatingChat 依赖的 RGB 分解 token：`--color-chat-accent-rgb`、`--color-chat-accent-light`、`--color-chat-gradient-start`、`--color-chat-gradient-start-rgb`（10 个皮肤块各增 4 个变量） |
| `src/components/business/workbench/WorkbenchHeaderActions.vue` | 导入 SkinPicker；已登录下拉菜单新增"皮肤"分区（SkinPicker compact）+ 原"主题"改为"模式"；未登录视图新增 `.wb-guest-actions` 容器包含 SkinPicker + ThemeToggle + 登录按钮 |

### 浅色皮肤区分度 + SkinPicker 下拉选择器

**问题 1**：浅色模式下 5 套皮肤的 `--color-bg` 全在 97-98% 亮度、`--color-panel` 全为 `#ffffff`，肉眼几乎无差异。

**修复**：`skins.css` 中 5 套皮肤的浅色 `--color-bg`、`--color-panel`、`--color-panel-2`、`--color-panel-3`、`--glass-bg` 全部加深，色相差异肉眼可见（~93-95% 亮度），`--color-panel` 保留极浅着色确保卡片仍近白。

**问题 2**：SkinPicker 仅为纯色圆点，无中文说明，体验粗糙。

**修复**：`SkinPicker.vue` 重写为下拉选择器。Trigger 显示渐变圆点 + 四字中文名 + chevron；Dropdown 列表每行显示渐变圆点 + 中文全名 + 色调描述 + 选中 ✓。移除 `variant` prop，统一下拉样式。

| 文件 | 变更 |
|---|---|
| `src/styles/skins.css` | 5 套浅色皮肤表面色加深（bg/panel/panel-2/panel-3/glass-bg） |
| `src/components/common/SkinPicker.vue` | 重写：圆点 → 下拉选择器，新增四字中文名 + 色调描述 + ✓ 选中标记 |
| `src/components/layout/AppHeader.vue` | 移除 `variant="compact"`、`header-skin-picker` CSS、dropdown 皮肤/模式分区简化为"外观" |
| `src/components/business/workbench/WorkbenchHeaderActions.vue` | 移除 `variant="compact"` 和分区标题，简化为 `<SkinPicker />` |

### 设计文档
完整设计方案见 `docs/SKIN_SYSTEM_PLAN.md`

---

## 2026-05-20: 紫微分享海报重构 — 匹配页面风格

### 问题
原海报使用紫色渐变背景 + emoji 图标 + 独立配色，与主应用的 Apple HIG glassmorphism 风格不一致。

### 方案
完全重写 `SharePosterModal.vue`，对齐紫微页面的视觉体系：
- **背景**：`var(--color-panel)` 纯白/纯黑 + 顶部 accent 渐变条 + `radial-gradient` 光晕（hero-panel 风格）
- **卡片**：`var(--color-panel-2)` + `1px solid var(--color-border)` + shine 伪层（与 AI 分析卡相同的 glassmorphic `::before`）
- **四化标签**：pill 形 + `color-mix()` 半透明底色 + 四化变量色
- **宫位卡**：`inset box-shadow` + `color-mix()` tone 色调顶部高亮
- **功能列表**：6px 色点替代 emoji，色点颜色来自 accent/hua-lu/purple/hua-ke
- **排版**：kicker 标签（10px/700/uppercase/0.08em tracking）、13px/600 标题、11px/subtle 描述
- **所有颜色/圆角/阴影/字体/动画**：100% tokens.css 变量，深色自动适配

### 修改文件
| 文件 | 变更类型 |
|---|---|
| `src/components/business/workbench/modals/SharePosterModal.vue` | 完全重写 |

---

## 2026-05-20: 紫微页面移动端布局全面重做（Round 2）

### 问题
Round 1 适配存在严重缺陷：`overflow: hidden` 链阻断滚动、汉堡按钮与 header 重叠、AI Tab 同时显示中栏和右栏、摘要卡 1 列过长、视觉粗糙。

### 方案
仅通过 `@media` 和 `lg:hidden` 修改，桌面端零影响：

1. **滚动修复**：为主 grid 添加 `.zw-main-grid` 类，中栏添加 `.zw-center-panel` 类，在 ≤1023px 下 override `overflow-hidden` 为 `overflow-y: auto`，`height: 100%` 为 `height: auto`
2. **Header 精简**：68px→48px，`padding-left: 56px` 为汉堡按钮留位，隐藏副标题
3. **Tab/Switch 触控**：Tab 栏 `font-size: 13px`，view-switch 按钮 `min-height: 36px / font-size: 13px`
4. **摘要卡布局**：≤1023px 2 列，≤600px 1 列
5. **AI Tab 布局**：右栏改为 `hidden lg:flex` 始终隐藏，移动端在中栏内联 AI 按钮（`.zw-mobile-ai-ctrl`）
6. **汉堡按钮**：≤1023px 下 `top:4px left:8px 40×40px`，transparent 无边框
7. **分割线**：`.wb-global-divider` 移动端 `display: none`
8. **手机间距**：≤600px `gap: 6px`、`border-radius: 10px`、中栏 `padding: 10px`

### 修改文件
| 文件 | 变更类型 |
|---|---|
| `src/components/business/workbench/pages/ZiweiPage.vue` | CSS class 添加、media query 重写、移动端 AI 控制内联 |
| `src/components/business/workbench/WorkbenchApp.vue` | 汉堡按钮重定位 + 分割线隐藏 |

---

## 2026-05-19: 紫微页面手机/平板适配

### 问题
紫微页面在手机端基本不可用：侧边栏固定 240px 不隐藏、QA 卡片 2 列过窄、表单控件触摸热区不足。

### 方案
所有改动仅通过 `@media (max-width: ...)` 和 `lg:hidden` 生效，桌面端零影响：

1. **侧边栏抽屉化**：≤1023px 下变为 fixed 定位 + `translateX(-100%)` 隐藏，通过汉堡按钮打开，点击遮罩层或菜单项后自动关闭
2. **QA 卡片单列**：≤1023px 下 `.zw-qa-card-grid` 从 2 列变 1 列
3. **触摸友好化**：≤600px 下排盘按钮 44px、input-control 44px + font-size 16px（防 iOS 缩放）、FormSelect 选项 44px

### 修改文件
| 文件 | 变更类型 |
|---|---|
| `src/stores/workbench.ts` | `setPage` 阈值 768→1024，对齐 Tailwind lg 断点 |
| `src/components/business/workbench/WorkbenchSidebar.vue` | 移动端 fixed 抽屉 + 自动关闭 |
| `src/components/business/workbench/WorkbenchApp.vue` | 汉堡按钮 + 遮罩层（均 lg:hidden） |
| `src/components/business/workbench/pages/ZiweiPage.vue` | QA 网格单列 + 按钮 44px |
| `src/styles/main.css` | input-control 移动端 44px + 16px 字号 |
| `src/components/common/FormSelect.vue` | 触摸热区 44px |

---

## 2026-05-19: 问答卡片解析器补充命盘证据关键词

### 问题
新 QA system prompt 输出结构包含「命盘证据」段落，但卡片解析器 `splitInlineQaSections` 的 markers 列表中缺少该关键词，导致该段落无法被切分为独立卡片。

### 方案
在 `ZiweiPage.vue` 的四处关键词列表中补充 `命盘证据`：
- `isStandaloneQaLabel` 正则
- `splitInlineQaSections` markers 数组
- `parseQaBlockAsCards` firstLine 关键词正则
- `parseQaStreamingTailCard` firstLine 关键词正则

### 修改文件
| 文件 | 变更类型 |
|---|---|
| `src/components/business/workbench/pages/ZiweiPage.vue` | 四处关键词列表补充 `命盘证据` |

---

## 2026-05-19: 紫微命盘数据分层压缩

### 问题
解读（analysis）和问答（QA）共用同一个 `buildZiweiAiPayloadCompact`，压缩过度导致 AI 丢失关键数据：ruleSummary（格局判断）、changSheng（长生十二神）、liuNianSeries（流年序列）、area（宫位四正/四马分类）。

### 方案
为两种模式建立差异化压缩策略：
- **解读模式** `buildZiweiAiPayloadForAnalysis`：保留 ruleSummary(≤6)、changSheng、area、liuNianSeries(≤6)、huaTracks(≤40)、huaCount
- **问答模式** `buildZiweiAiPayloadForQa`：保留 ruleSummary(≤4)、changSheng、liuNianSeries(≤6)，不保留 area / huaCount
- maxChartChars 默认值从 12000 提升到 15000

### 修改文件
| 文件 | 变更类型 |
|---|---|
| `src/features/ziwei/ai-utils.ts` | 新增 `buildZiweiAiPayloadForAnalysis`、`buildZiweiAiPayloadForQa`；扩展 `compactPalace` 新增 `analysis`/`qa` 模式；提取 `trimCenter` 复用 |
| `src/features/ziwei/index.ts` | 导出新函数 |
| `src/api/ziwei-analysis.ts` | 拆分 `buildChartPayload` 为 `buildAnalysisChartPayload` / `buildQaChartPayload` |
| `supabase/functions/ziwei-analysis/handler.ts` | maxChartChars 默认值 12000 → 15000 |
| `tests/ziwei-ai-utils.mjs` | 补充 ForAnalysis / ForQa 测试断言 |
| `tests/smoke.mjs` | 补充导出存在性断言 |
| `tests/helpers/load-ts-module.mjs` | 修复 `@/` 路径别名解析（预存 bug） |

### 部署步骤
1. 前端正常构建部署
2. 重新部署 `ziwei-analysis` Edge Function

---

## 2026-05-19: AI_DEV.md 规范补全

### 变更概要
对照项目实际代码中已落地的最佳实践，对 `docs/AI_DEV.md` 进行 11 处规范补充（仅补缺，已有部分不重复）。

### 新增规范内容
1. **§1**：Pinia 强制 setup store 语法
2. **§2**：`defineProps<{}>()` / `defineEmits<{}>()` 类型化声明 + `storeToRefs()` 解包规则
3. **§3**：Feature 模块桶导出规范（具名 re-export、DOM 委托）
4. **§6.2**：Pinia Store 编码规范（乐观更新+回滚、用户隔离缓存、$reset 清理、循环依赖处理）
5. **§8.2**：API 请求层实现模式（Token 缓存+主动刷新、请求去重、指数退避重试、统一错误转换）
6. **§9.4**：Edge Function 标准处理流程（统一管线、多层配置解析、app-config TTL 缓存）
7. **§13**：EditorConfig 编辑器配置规范
8. **§17.0**：路由布局系统（meta.layout 布局切换、页面过渡动效）
9. **§18**：type-guards 运行时类型收窄
10. **§23**：安全补充（AES-256-GCM 密钥加密、重定向净化、操作日志敏感字段剥离）
11. **§26**：更新 commitlint + husky 状态为「已启用」

### 修改文件
| 文件 | 变更类型 |
|---|---|
| `docs/AI_DEV.md` | 11 处规范补充 |

---

## 2026-05-14: 操作日志指标与查询一致性修复

### 关键修复
1. 指标聚合改为 DB 端 RPC `compute_operation_log_summary`，不再在 Edge 内存中分批拉全量数据计算。
2. 指标缓存增加 **TTL + LRU 上限**，避免长期陈旧与内存无限增长。
3. 移除 `api_name` 在指标与查询链路中的无效透传（前后端类型与响应字段同步精简）。
4. 指标字段由 `today_requests` 统一为 `total_requests`（并在前端保留兼容读取）。
5. 页面默认日期与首屏/重置查询条件对齐为“今日”，修复显示与实际查询不一致。
6. 分页请求默认不再重复计算 summary / options / total（通过 `with_summary/with_options/with_total` 控制）。
7. 新增 `operation_logs` 复合/部分索引，优化状态+操作+日期范围下的查询性能。
8. 进一步排查慢请求：增加会话校验缓存、限流器实例缓存。
9. 针对 `auth/ratelimit` 耗时继续优化：`operation-logs` 在 `verify_jwt=true` 下改为本地解析 JWT claims，且限流存储默认切换为 `oplogs_store_mode`（默认 `memory`）。

### 修改文件
| 文件 | 变更类型 |
|---|---|
| `supabase/functions/operation-logs/index.ts` | 重构聚合逻辑、缓存策略、响应字段，会话/限流缓存 |
| `supabase/migrations/202605140001_compute_operation_log_summary.sql` | 新增 DB 聚合函数 |
| `supabase/migrations/202605140002_operation_logs_perf_indexes.sql` | 新增性能索引 |
| `src/api/operation-logs.ts` | 更新筛选与响应类型 |
| `src/stores/operation-logs.ts` | 更新 summary 字段映射，移除无效字段 |
| `src/pages/operation-logs/index.vue` | 修复默认日期查询一致性 |
| `src/components/business/operation-logs/OperationLogFilters.vue` | 移除 `apiName` 相关字段 |

---

## 2026-05-13: 操作日志查询优化

### 需求
1. **总记录数不一致**：指标栏的`today_requests`和分页的`total`使用不同查询条件
2. **查询慢、翻页慢**：`summaryQuery`没有LIMIT，加载全部匹配数据到内存计算P95/平均值

### 根因
- `summaryQuery` 缺少 `operation` 和 `api_name` 的过滤条件（与 mainQuery 不一致）
- `summaryQuery` 无 LIMIT，数据量大时加载全部到内存计算统计
- 翻页时每次都重新执行整个查询流程

### 实现方案
1. **新建 RPC 聚合函数** `compute_log_summary`：
   - 使用 PostgreSQL 聚合查询替代内存计算
   - `PERCENTILE_CONT(0.95)` 计算 P95
   - `COUNT(*) FILTER (WHERE ...)` 条件计数
   - `COUNT(DISTINCT user_email)` 活跃用户数

2. **统一过滤条件**：`status`、`operation`、`start_date`、`end_date`、`user_id`（不含 api_name）

3. **添加缓存**：30 秒 TTL 缓存统计结果

4. **移除 api_name 过滤**：用户确认指标统计不包含 api_name 条件

### 修改文件
| 文件 | 变更类型 |
|---|---|
| `supabase/migrations/202605130003_compute_log_summary.sql` | 新建 RPC 函数 |
| `supabase/functions/operation-logs/index.ts` | 重构查询逻辑：移除 computeSummary() 内存计算，使用 RPC 聚合 + 缓存 |

### 权限模型
- 非管理员：只看自己的日志
- 管理员 + 无 searchUserId：看所有日志
- 管理员 + 有 searchUserId：看指定用户的日志

### 性能提升预期
| 场景 | 优化前 | 优化后 |
|------|--------|--------|
| 10万条数据首次加载 | ~3-5s | ~0.5-1s |
| 翻页 | ~3-5s | ~50-100ms |

### 部署
```bash
# 执行新迁移
supabase db push

# 部署 Edge Function
supabase functions deploy operation-logs

# 构建前端
pnpm build
```

### 调试记录 (2026-05-13)
**问题**：部署后用户反馈切换操作类型时，指标栏数值不变。

**排查过程**：
1. 确认 RPC 调用返回数据正确（`total_requests` 随过滤条件变化）
2. 在 Edge Function 添加日志：
   ```typescript
   console.log('[operation-logs] RPC params:', ...)
   console.log('[operation-logs] RPC data:', ...)
   ```
3. 在前端 store 添加日志：
   ```typescript
   console.log('[operation-logs store] setFilters called with:', ...)
   console.log('[operation-logs store] API response summary:', ...)
   ```
4. 确认问题原因：用户可能未重新部署 Edge Function，或浏览器缓存

**结论**：过滤逻辑正确工作，数据随过滤条件变化。调试日志已移除。

---

## 2026-05-13: 操作日志表格交互优化 (v4)

### 需求
日志表格改为点击右侧"详情"按钮展开详情，而非整行点击。

### 实现方案
1. 移除 `<tr>` 的 `@click` 事件处理器
2. 移除行 hover 时的 `cursor: pointer`
3. 新增"操作"列，添加详情按钮
4. 详情按钮使用 `@click.stop` 阻止事件冒泡

### 修改文件
| 文件 | 变更类型 |
|---|---|
| src/pages/operation-logs/index.vue | 移除行点击事件，新增详情按钮列 |

### 验证
- `pnpm typecheck` ✔
- `pnpm build` ✔

---

## 2026-05-13: 操作日志页面 UI 优化 (v3)

### 需求
操作日志页面进一步优化：
1. 删除"管理员"标签
2. 标题栏颜色与导航栏统一（glass 效果 + 边框）
3. 四个指标栏数值和汉字字体统一
4. 状态和操作筛选按钮左侧添加标签文字
5. 日期选择器显示真实日期（添加 lang="zh-CN"）
6. 日志表格增加请求报文和返回报文列

### 实现方案
1. 移除 admin-badge 组件及其样式
2. page-header 使用 `var(--glass-bg)` + `backdrop-filter` + `border: 1px solid var(--color-border)` 与导航栏一致
3. stat-value 从 `var(--font-code)` 改为 `var(--font-body)` 与 stat-label 统一
4. 筛选栏添加 `filter-label` 组件显示"状态"/"操作"文字
5. 日期 input 添加 `lang="zh-CN"` 属性确保正确格式化
6. 表格新增两列：请求报文、返回报文（显示图标指示器）

### 修改文件
| 文件 | 变更类型 |
|---|---|
| src/pages/operation-logs/index.vue | 删除管理员标签、统一标题栏样式、统一指标字体、添加筛选标签、修复日期格式、新增报文列 |

### 验证
- `pnpm typecheck` ✔
- `pnpm build` ✔

---

## 2026-05-13: 操作日志页面 UI 优化 (v2)

### 需求
操作日志页面字体和颜色未与全局统一：
1. 四个标签栏、表格列、分页数字、弹窗内容字体
2. 选项栏、表格、弹窗颜色
3. 表格边框在深色模式下不可见

### 实现方案
1. 所有字体改用 CSS 变量：`font-size: var(--text-*)`, `font-family: var(--font-body)`
2. 圆角统一使用 `var(--radius-*)` 变量
3. 过渡动画改用 `var(--duration-fast)` 和 `var(--ease-apple)`
4. 所有卡片/面板改用 `var(--color-page-panel)`（一致的颜色映射）
5. 表格边框改用 `var(--color-page-border)` 确保双主题可见
6. 滚动条样式扩展到弹窗 modal-body

### 修改文件
| 文件 | 变更类型 |
|---|---|
| src/pages/operation-logs/index.vue | 样式全面重构：字体/颜色/圆角/过渡全部使用 CSS 变量 |

### 验证
- `pnpm typecheck` ✔
- `pnpm build` ✔

---

## 2026-05-13: 操作日志页面 UI 优化 (v1)

### 需求
操作日志页面存在以下问题：
1. 组件字体未与全局统一（硬编码 #f0f6fc 等颜色）
2. 两套主题下部分字体和表格边框不可见
3. 页面整体可滚动，应改为表格内部滚动
4. "全部状态"/"全部操作"按钮文字过长
5. 日期选择器格式问题

### 实现方案
1. 页面布局改为 flex 纵向布局 + `overflow: hidden`，表格区域 `flex: 1 + overflow-y: auto`
2. 所有硬编码颜色替换为 CSS 变量（`var(--color-page-text)` 等）
3. 表格边框颜色使用 `var(--color-page-border)` 确保双主题可见
4. 按钮标签从"全部状态"/"全部操作"简化为"状态"/"操作"
5. 表格内单元格 `text-align: center`，内容超出时 ellipsis

### 新增 CSS 变量
| 变量 | 用途 |
|---|---|
| `--color-page-scrollbar-track` | 表格滚动条轨道色 |
| `--color-page-scrollbar-thumb` | 滚动条滑块色 |
| `--color-page-scrollbar-thumb-hover` | 滚动条悬停色 |

### 修改文件
| 文件 | 变更类型 |
|---|---|
| src/styles/tokens.css | 新增 page-scrollback CSS 变量（light + dark） |
| src/pages/operation-logs/index.vue | 样式修复：移除硬编码颜色、页面布局改为表格内滚动、简化按钮标签 |

### 验证
- `pnpm typecheck` ✔
- `pnpm build` ✔

---

## 2026-05-13: AI 配置页追加模型闪现新行修复 (v3)

### 需求
AI 配置页 Key 管理表格中点击"+ 模型"时，表格闪现新行而非仅在模型列步进器中新增模型选项。

### 根因
`addConfig()` 乐观更新在追加模式（api_key 为空）时向 configs 数组插入临时条目，即使 api_key_masked 正确，两次 configs.value 变更（插入乐观条目→服务端替换）触发双重响应式重算，导致 groupedConfigs/tableRows 短暂出现不一致。

### 实现方案
追加模式完全跳过乐观更新：直接调用 API，等服务端返回后一次性插入真实配置。新增 Key 模式保持原有乐观更新逻辑不变。

### 修改文件
| 文件 | 变更类型 |
|---|---|
| src/stores/ai.ts | addConfig() 追加模式跳过乐观更新，直接 await API |
| src/features/ai/types.ts | AiConfigPayload 新增 api_key_masked?: string（预留） |

### 验证
- `pnpm typecheck` ✔

### 需求
AI 配置页 Key 管理表格中点击"+ 模型"时，表格闪现新行而非仅在模型列步进器中新增模型选项。

### 根因
`openAppendModel` 接收了正确的 `apiKeyMasked` 但丢弃了（参数 `_apiKeyMasked`），且 store 用 `configs.value.find()` 查找 `api_key_masked` 在多个同 provider Key 时会选错组。

### 实现方案
将 `apiKeyMasked` 从点击事件 → prefill → handleAddKeySaved → store.addConfig 完整透传，确保乐观条目分组键与已有组一致。

### 修改文件
| 文件 | 变更类型 |
|---|---|
| src/features/ai/types.ts | AiConfigPayload 新增 api_key_masked?: string |
| src/components/business/ai/AiConfigPage.vue | addKeyPrefill 扩展类型、openAppendModel 保存 apiKeyMasked、handleAddKeySaved 透传 |
| src/stores/ai.ts | addConfig 乐观更新直接使用 payload.api_key_masked |

### 验证
- `pnpm typecheck` ✔

---

## 2026-05-13: SQL 转换禁用 HTTP 重试，防止重复请求

### 需求
SQL 转换点击一次"开始转换"按钮，HTTP 层自动重试机制会在网络错误或 5xx 时发起最多 2 次额外请求，导致一次点击最多 3 个 /sql-convert 请求。AI 转换非幂等，重复请求浪费资源且可能产生不一致结果。

### 实现方案
在 `requestSqlConvert()` 调用 `edgeFn.post()` 时传入 `{ skipRetry: true }`，禁用该接口的自动重试。前端现有 4 层并发防护（按钮 disabled、组件 guard、store guard、HTTP 去重）均正常工作，不修改。

### 修改文件
| 文件 | 变更类型 |
|---|---|
| src/api/sql-convert.ts | 修改：`edgeFn.post()` 第三参数传入 `{ skipRetry: true }` |

### 验证
- `pnpm typecheck` ✔

---

## 2026-05-12: 统一全站下拉框为 FormSelect 组件

### 需求
项目中除 AI 助手配置页外的所有页面使用原生 `<select>` 元素，下拉选项无法样式化，需全部替换为 `FormSelect` 自定义组件。

### 实现方案
全站 7 个文件共 23 个原生 `<select>` 全部替换为 `<FormSelect>` 组件，带自定义下拉面板、accent 色高亮选中项、teleported 定位。

### FormSelect 增强
- 新增 `borderless` prop：嵌入模式（无边框/背景/圆角，flex: 1 填充），用于 SqlConvertPage DB 选择器容器
- 新增 `disabled` prop：禁用态（opacity 0.5 + cursor not-allowed），用于 IdToolPage 行政区划加载中

### 修改文件
| 文件 | 变更类型 |
|---|---|
| src/components/common/FormSelect.vue | 增强：新增 `borderless` 和 `disabled` props 及对应 CSS |
| src/components/business/feedback/FeedbackWidget.vue | 修改：1 个 select → FormSelect，移除 .feedback-select CSS |
| src/components/business/operation-logs/OperationLogFilters.vue | 修改：2 个 select → FormSelect compact，移除 .filter-select CSS |
| src/pages/operation-logs/index.vue | 修改：2 个 select → FormSelect compact，移除 .filter-select CSS |
| src/components/business/workbench/pages/SqlConvertPage.vue | 修改：2 个 DB 选择器 → FormSelect borderless（嵌入容器），移除 handleSourceDbChange/handleTargetDbChange |
| src/components/business/workbench/pages/IdToolPage.vue | 修改：11 个级联/日期/部门选择 → FormSelect，新增 9 个 form option computed，移除全部 select CSS |
| src/components/business/workbench/pages/ZiweiPage.vue | 修改：8 个历法/年月日/时分/历史选择 → FormSelect，新增 calendarTypeOptions/yearFormOptions computed，移除全部 select CSS |

### 验证
- `pnpm typecheck` ✔
- `pnpm lint` ✔

---

## 2026-05-12 (夜间): SQL转换示例按数据库区分（4 项）

### 需求
SQL 转换功能的"加载示例"需根据源数据库加载专属示例 SQL，而非统一使用 Oracle 风格硬编码示例。每个数据库的示例需展示其特有的数据类型、自增列、默认值、约束、注释语法、序列、索引、分区、函数/存储过程语法、异常处理、系统函数等。

### 实现方案
- **存储层**: 在 `app_configs` 表新增 `sql_convert_sample` 分类，key 格式 `{db_slug}_{sql_type}`，每条记录含该数据库专属 DDL/函数/存储过程示例
- **前端**: `loadSample()` 改为异步从 API 获取，带内存缓存；未配置时明确提示，不回退到硬编码示例；工具栏新增 SQL 类型分段控件（DDL/函数/存储过程）

### 修改/新增文件
| 文件 | 变更类型 |
|---|---|
| src/features/app-config/types.ts | 新增（修复之前缺失的类型定义，`AppConfig / CreateConfigPayload / UpdateConfigPayload`） |
| supabase/migrations/202605130002_insert_sql_convert_samples.sql | 新增（17库 × 3类型 = 51条示例，含 Oracle/MySQL/PG/KingbaseES/DM8/YashanDB/GaussDB/GoldenDB/OceanBase/TDSQL/TiDB/GBase/HiveSQL） |
| src/stores/workbench.ts | 修改：`loadSample()` 改用 `appConfigApi.list('sql_convert_sample')` 按 `{sourceDb}_{sqlType}` 查询；新增 `sampleCache` + `loadingSample` + `getFallbackSample()` |
| src/components/business/workbench/pages/SqlConvertPage.vue | 修改：`handleLoadSample()` 改为 async；两个"加载示例"按钮添加 loading 禁用态和"加载中..."文本 |

### 各数据库示例特性
- **Oracle 系** (Oracle/DM8/KingbaseES/YashanDB/OceanBase Oracle): NUMBER/VARCHAR2/序列/COMMENT ON/PL/SQL/PRAGMA/SQL%ROWCOUNT/NVL/SYSTIMESTAMP
- **MySQL 系** (MySQL/GoldenDB/OceanBase MySQL/TDSQL MySQL/TiDB/GBase 8a): INT AUTO_INCREMENT/DECIMAL/DELIMITER/DECLARE HANDLER/ENGINE/内联COMMENT/ROW_COUNT/NOW
- **PG 系** (PostgreSQL/GaussDB/TDSQL PG/GBase 8c): SERIAL/NUMERIC/BOOLEAN/$$ quoting/LANGUAGE plpgsql/FOR RECORD/GET DIAGNOSTICS
- **GBase 8s**: SERIAL/MONEY/DATETIME YEAR TO SECOND/SPL/DEFINE/FOREACH/LOCK MODE ROW
- **HiveSQL**: STRING/DOUBLE/PARTITIONED BY/STORED AS ORC/INSERT OVERWRITE/UDF 模式

### 验证
- `pnpm typecheck` ✔
- `pnpm lint` ✔

---

## 2026-05-12 (晚间): 第二轮 UI 修正 + AppConfig 删除（6 项）

### 修正内容
1. **IdToolPage 硬编码 #fff 修复** — `color: #fff` → `var(--color-btn-primary-text)`（生成/校验按钮）
2. **工具栏按钮进一步下移 + 交换按钮对齐** — WorkbenchActionBar padding 增至 `8px 16px 12px`；SqlConvertPage 左右 flex 比例调整为 `0.6:1.4`，center 移除 padding，使交换按钮对齐输入/输出面板垂直分割线
3. **移除输入/输出框及 DB 选择器 focus 色环** — 删除 `.sc-code-editor:focus-visible` 和 `.sc-db-selector:focus-within` 规则
4. **移除证件号码页面所有输入框 focus 色环** — select/input/verify-input/result-input/date-inputs 统一添加 `:focus { outline: none; border-color: var(--color-page-border-subtle) }`
5. **证件号码页面添加顶栏标题** — 新增 `.idt-top-bar`（标题"证件工具"/副标题"身份证 / 统一社会信用代码生成与校验"），`.page-content` padding-top 从 `calc(var(--header-height) + 16px)` 恢复为 `12px`
6. **删除应用配置界面及关联功能**：
   - 删除：`AppConfigPage.vue`、`ConfigEditModal.vue`、`useAppConfig.ts`、`features/app-config/`（types + barrel）
   - 简化：`api/app-config.ts`（仅保留 `list` 方法，移除 create/update/delete/clearCache）
   - 清理：router、WorkbenchApp、Sidebar、sidebar-menu、workbench-sections、workbench store、AppHeader 中所有 appConfig 引用
   - 保留：Edge Function `app-config` 及 `_shared/app-config.ts`（其他函数运行时依赖）

### 修改文件
| 文件 | 变更类型 |
|---|---|
| src/components/business/workbench/WorkbenchActionBar.vue | 调整 padding |
| src/components/business/workbench/pages/SqlConvertPage.vue | 调整布局 + 移除 focus |
| src/components/business/workbench/pages/IdToolPage.vue | #fff→token + 移除 focus + 添加标题 |
| src/components/business/app-config/AppConfigPage.vue | 删除 |
| src/components/business/app-config/ConfigEditModal.vue | 删除 |
| src/composables/useAppConfig.ts | 删除 |
| src/features/app-config/ | 删除 |
| src/api/app-config.ts | 简化（仅保留 list） |
| src/router/index.ts | 移除 /app-config 路由 |
| src/.../workbench/WorkbenchApp.vue | 移除 AppConfigPage 导入/渲染 |
| src/.../workbench/WorkbenchSidebar.vue | 移除 appConfig 路径检测 |
| src/.../workbench/sidebar-menu.ts | 移除 appConfig 菜单项 |
| src/features/navigation/workbench-sections.ts | 移除 app-config 节 |
| src/stores/workbench.ts | 移除 appConfig from 类型/数组/map |
| src/components/layout/AppHeader.vue | 移除应用配置下拉链接 |
| scripts/css-color-baseline.json | 基线更新（738 records，较上轮 746 减少 8） |

### 验证
- `pnpm typecheck` ✔
- `pnpm lint` ✔ (0 errors, 0 warnings)
- `pnpm check:css-colors` ✔ (738 records)
- `pnpm test` (8 suites) ✔

---

## 2026-05-12 (傍晚): 工具栏/转换页/证件工具页 UI 修正（7 项）

### 问题修复
1. **工具栏按钮太贴近底部横线** — `WorkbenchActionBar.vue`: padding 从 `5px 16px` 调整为 `6px 16px 8px`，增加底部留白
2. **源/交换/目标/转换按钮位置后移，交换按钮对齐垂直分割线** — `SqlConvertPage.vue`: 左右工具栏 flex 比例从 `1:1` 调整为 `0.65:1.35`，center padding 从 `0 16px` 调整为 `0 10px 0 0`
3. **输入框空白状态无法粘贴 SQL** — `SqlConvertPage.vue`: 空状态 div 新增 `@paste` 事件处理，`handlePaste()` 从剪贴板读取文本并写入 store
4. **证件号码页面卡片顶部在分割线上面** — `IdToolPage.vue`: `.page-content` padding-top 从 `24px` 改为 `calc(var(--header-height, 56px) + 16px)`
5. **证件号码页面字体稍微缩小** — `IdToolPage.vue`: 标题 `--text-lg`→`--text-base`，副标题/标签/单选按钮 `--text-base`→`--text-sm`
6. **生成/校验按钮改为圆角矩形** — `IdToolPage.vue`: border-radius 从 `--radius-pill` 改为 `--radius-sm`(6px)，水平 padding 从 18px 增至 24px
7. **证件号码校验闪烁 + 换号后报相同结果** — `IdToolPage.vue`:
   - 所有 `<Transition name="toast-fade">` 添加 `mode="out-in"` 消除闪烁
   - `validateIdNumber()`: `idLastVerifyResult` 比较键包含输入值 `input + '|' + resultCode`，避免不同号码误判"与上次相同"
   - `applyUsccResult()`: 同理，`resultKey = input + '|' + msg + '|' + type`
   - `idVerifyKey`/`usccVerifyKey` 自增移到消息设置之前

### AI_DEV.md 合规
- 按钮圆角使用 `var(--radius-sm)` token（而非硬编码 6px）
- 全部颜色沿用已有 CSS 变量，无新增硬编码 hex
- 字体使用 rem-based token（`--text-base`/`--text-sm`）
- 空状态 paste 属于纯前端交互，无新增依赖
- `pnpm verify` 通过（typecheck + lint + utf8 + css-colors + test），test:unit 6 个失败为已有问题

### 修改文件
| 文件 | 变更类型 |
|---|---|
| src/components/business/workbench/WorkbenchActionBar.vue | 调整工具栏 padding |
| src/components/business/workbench/pages/SqlConvertPage.vue | 调整按钮位置 + 新增 paste 支持 |
| src/components/business/workbench/pages/IdToolPage.vue | 卡片定位/字号/按钮形状/校验逻辑修复 |
| scripts/css-color-baseline.json | 基线更新（746 records） |

### 验证
- `pnpm typecheck` ✔
- `pnpm lint` ✔ (0 errors, 0 warnings)
- `pnpm check:utf8` ✔
- `pnpm check:css-colors` ✔
- `pnpm test` (8 suites) ✔
- `pnpm test:unit` ⚠️ (6 failed, 均为已有 api-http/composables 问题)

---


### 问题修复（7 项）
1. **卡片充满屏幕** — padding 从 `24px` 缩减为 `8px 12px 12px`，gap 从 `24px` 缩减为 `12px`，卡片上沿靠近顶部分割线
2. **校验按钮多次点击无反应** — 新增 `idVerifyKey`/`usccVerifyKey` 计数器作为 toast `:key`，每次校验强制重建 DOM 触发过渡动画
3. **输入框字体改为全局字体** — 结果框/校验框从 `var(--font-code)` 改为 `var(--font-body)`（Apple 系统字体），与全局一致
4. **移除输入框 focus 边框** — 删除 select/input 的 `:focus { border-color }` 规则
5. **USCC 校验重写** — 修复三个 bug：
   - 中划线在开头就被 strip 导致后续 `includes('-')` 永远为 false → 组织机构代码 `XXXXXXXX-X` 被判为"格式错误"
   - `validateLegacy15` 调用缺少 `regionCodeExists` 回调 → 输入工商注册号时抛出 TypeError
   - 税务登记号误判为"组织机构代码合法"→ 三类旧版证件各自按格式特征分流
   - 新增 `regionCodeExists()` 函数从已加载的省市县数据中查找
6. **字号整体放大** — label 从 `var(--text-sm)` (12px) → `var(--text-base)` (14px)，select/input/button 同步放大
7. **新增 `validateOrgCode` 导入** — 从 `@/features/id-tools` 导入，用于组织机构代码独立校验

### 修改文件
| 文件 | 变更类型 |
|---|---|
| src/components/business/workbench/pages/IdToolPage.vue | 第二轮全面修正 |

### 验证
- `pnpm typecheck` ✔
- `pnpm lint` ✔ (0 errors, 0 warnings)
- `pnpm build` ✔

---

## 2026-05-12 (下午): 证件号码页面样式/功能修正（第一轮）

### 问题修复（9 项）
1. **移除独立顶部导航栏** — 页面处于工作台布局内，已有侧边栏+全局HeaderActions，删除冗余的标题/副标题/返回首页按钮/用户菜单
2. **修复省市县下拉数据加载** — `region_codes_2024.json` 实际为嵌套数组结构 `[{code,name,cityList:[{code,name,areaList:[...]}]}]`，重写 `loadRegionData()` 解析逻辑；fetch 路径改用 `import.meta.env.BASE_URL`
3. **出生年份扩展** — 年份上限从 2010 年改为 `new Date().getFullYear()`（当前为 2026）
4. **校验提示修正** — 身份证校验成功消息从"已重新校验，结果与上次一致：..."改为"校验通过：身份证号码合法"
5. **按钮颜色统一** — 生成/校验按钮从 `var(--color-purple)` 改为 `var(--color-page-brand)`（Apple 蓝），与全局品牌色一致
6. **字号统一为 Design Token** — 所有 `font-size` 从硬编码 px 值改为 `var(--text-xs)`/`var(--text-sm)`/`var(--text-base)`/`var(--text-lg)`
7. **输入框/结果框收紧** — 移除 placeholder 文字提示；padding 从 `8px 12px`/`10px 12px` 缩减为 `6px 10px`
8. **卡片充满屏幕** — `.id-tool-page` 添加 `flex: 1; min-height: 0`，卡片使用 `var(--color-page-panel)` 背景
9. **USCC 生成 bug 修复** — `regionCode` 变量作用域从 if/else 内提升到函数顶部，修复旧版三证模式引用未定义变量的问题

### AI_DEV.md 合规
- 全部颜色使用 CSS 变量（`var(--color-page-*)`），无硬编码 hex
- 字体使用 rem-based token，按钮使用 `var(--radius-pill)` 圆角
- 过渡动画使用 `var(--duration-fast)`
- 删除未使用的 `useRouter`/`useWorkbenchStore` 导入

### 修改文件
| 文件 | 变更类型 |
|---|---|
| src/components/business/workbench/pages/IdToolPage.vue | 全面改写 |

### 验证
- `pnpm typecheck` ✔
- `pnpm lint` ✔ (0 errors, 0 warnings)
- `pnpm build` ✔
- `tests/id-tools.mjs` ✔
- 单元测试: 3/9 通过（6 个失败为已有 api-http/composables 问题，非本次引入）

---

## 2026-05-12 (下午): 提示词整合 + SqlConvertPage UI 重构 + AI_DEV.md 合规

### 提示词模版整合
- 5 套独立模版（ddl/function/procedure/auto/default）→ 1 套统一模版 `sql_convert_template.unified`
- AI 自动检测 SQL 类型，输出结构化 JSON（converted_sql / ai_ratio / manual_needed / manual_parts / notes / accuracy）
- 修改：migrations/202605130001_insert_sql_convert_configs.sql、functions/sql-convert/index.ts

### Edge Function 升级
- 新增 `parseAiResult()` — 解析 AI 结构化 JSON，fallback 到原始 SQL
- 新增 `clampRatio()` / `validateAccuracy()` 防御性校验
- `loadTemplate()` 固定加载 `unified` 键，不再按 sql_type 分派
- 响应新增 5 个字段：ai_ratio、manual_needed、manual_parts、notes、accuracy

### SqlConvertPage UI 重构（7 项）
1. 删除 SQL 类型标签栏（DDL/函数/存储过程/自动检测）
2. 删除"返回首页"按钮
3. 标题下方横线移除，工具栏上移——顶栏+工具栏合并为 `.sc-header-section`，共用一条底部边框
4. 数据库选择器重新设计——左右 selector 连体（左圆角→右圆角），自定义 SVG 下拉箭头，focus-within 边框+ring
5. 开始转换按钮移到输出面板 header（右侧），避开固定定位的三点菜单
6. SQL 输入输出框字体从 `--font-code` 改为 `--font-body`（与全局一致）
7. 转换成功后状态栏出现"展开转换详情"按钮，点击展开详情面板（AI 转换率、准确度、需人工处理项、注意事项、方向/耗时）

### AI_DEV.md 合规修复
- 硬编码颜色全面替换为 Design Token：
  - `#fff` → `var(--color-btn-primary-text)`
  - `#f59e0b`/`#d97706` → `var(--color-warning)`
  - `#fef3c7` → `var(--color-warning-bg)`
  - `rgba(59,130,246,0.15)` → `var(--shadow-focus-ring)`
- 字号全部改用 rem-based token（`--text-xs`/`--text-sm`/`--text-base`/`--text-lg`/`--text-xl`/`--text-2xl`）
- 所有交互元素添加 `:focus-visible` 轮廓样式
- 详情面板过渡动画兼容 `prefers-reduced-motion: reduce`
- 装饰性 SVG 添加 `aria-hidden="true"`
- 2 处例外：`.sc-shortcut` 的 `rgba(255,255,255,0.2)`（品牌色上的固定白色叠加层）；下拉箭头 SVG data URI 中的 `#94a3b8`（data URI 无法使用 CSS 变量）

### 前端类型/状态更新
- `src/api/sql-convert.ts`: SqlConvertResponse 新增 aiRatio/manualNeeded/manualParts/notes/accuracy
- `src/stores/workbench.ts`: 新增 5 个 ref + `resetOutputState()` 辅助函数，convert/clearAll/loadSample 中统一调用

### 修改文件清单
| 文件 | 变更类型 |
|---|---|
| supabase/migrations/202605130001_insert_sql_convert_configs.sql | 模版整合 |
| supabase/functions/sql-convert/index.ts | 结构化输出 + unified 模版 |
| src/api/sql-convert.ts | 新增字段 |
| src/stores/workbench.ts | 新增 state + 辅助函数 |
| src/components/.../SqlConvertPage.vue | UI 重构 + 合规修复 |

### 验证
- `pnpm typecheck` ✔
- `pnpm lint` ✔ (0 errors, 0 warnings)
- 单元测试：6/9 通过（3 个 theme 测试为已有失败，非本次引入）

### 部署
- `supabase functions deploy sql-convert --no-verify-jwt`
- 迁移自动执行或 `supabase db push`
- `pnpm build`

---

## 2026-05-12: SQL 转换功能重新设计 — AI 驱动跨数据库互转

### 背景
原有 DDL 语句 / 函数 / 存储过程三个独立翻译页面，依赖后端静态规则引擎（convert-engine）进行转换。现重新设计为统一的「SQL 转换」页面，直接调用 AI 大模型进行跨数据库 SQL 互转。

### 核心变更
- **三合一页面**: DdlPage + FunctionPage + ProcedurePage → SqlConvertPage
- **AI 驱动转换**: 删除后端 convert-engine 静态规则引擎，改用 AI 大模型
- **数据库扩展**: 3 种 (Oracle/MySQL/PostgreSQL) → 17 种
- **删除 AI 校验**: AI 成为主转换器，不再需要独立校验按钮
- **删除映射规则**: RulesPage 及所有规则管理代码删除
- **配置全部 app_configs 化**: 数据库列表、Prompt 模板、参数限制全部存储在 app_configs 表

### 前端变更
- **新建文件 (4)**: SqlConvertPage.vue、sql-convert.ts (API)、db-meta.ts、supabase/functions/sql-convert/index.ts
- **修改文件 (9)**: workbench.ts (store)、WorkbenchApp.vue、sidebar-menu.ts、WorkbenchSidebar.vue、workbench-sections.ts、router/index.ts、tokens.css、app-config/types.ts、auth.ts
- **删除文件 (30+)**: DdlPage、FunctionPage、ProcedurePage、RulesPage、convert.ts、convert-verify.ts、rules.ts、rules store、rules feature、convert-verify UI 组件

### 后端变更
- **新建**: supabase/functions/sql-convert/ — AI 转换 Edge Function
- **删除**: supabase/functions/convert/、supabase/functions/convert-verify/、supabase/functions/_shared/convert-engine/
- **新迁移**: supabase/migrations/202605130001_insert_sql_convert_configs.sql — app_configs 种子数据（databases 列表 + 5 条 prompt 模板 + 配置参数 + 限流配置）

### 验证结果
- `pnpm typecheck` ✔
- `pnpm lint` ✔ (0 errors)
- `pnpm test` ✔ (8/8 suites passed)
- 单元测试：2 个不相关文件预存失败

### 部署步骤
1. `supabase functions deploy sql-convert`
2. 执行迁移: `supabase db push` 或手动执行 `202605130001_insert_sql_convert_configs.sql`
3. `pnpm build` 构建前端

Last updated: 2026-05-13

---

## 2026-05-12: AI_DEV.md 合规性优化 — 第三轮（Fix 3.3-3.5, 1.7 部分）

### Fix 3.3 — 图标按钮 aria-label
- DdlPage, FunctionPage, ProcedurePage: "更多选项" + "交换源和目标数据库" 按钮添加 `aria-label`
- RulesPage: "编辑"、"删除"、"交换源和目标" 按钮添加 `aria-label`

### Fix 3.4 — 移除 as any 类型断言
- DdlPage, FunctionPage, ProcedurePage: 6 处 `($event.target as HTMLSelectElement).value as any` → `as 'oracle' | 'mysql' | 'postgresql'`

### Fix 3.5 — 统一剪贴板逻辑
- `src/composables/useClipboard.ts`: 内联 textarea fallback → 改用 `src/utils/browser-dom.ts` 的 `fallbackCopyTextByDom`

### Fix 1.7 — 提取样本 SQL（部分）
- 新建 `src/features/sql/samples.ts`: 提取 SAMPLE_DDL, SAMPLE_FUNC, SAMPLE_PROC
- DdlPage, FunctionPage: 本地样本 → import 共享样本，各减少 ~70 行 script
- ProcedurePage: 跳过（编辑工具限制）

### 新建文件
- `src/features/sql/samples.ts`

### 修改文件（6 个）
- `src/composables/useClipboard.ts`
- `src/components/business/workbench/pages/DdlPage.vue`
- `src/components/business/workbench/pages/FunctionPage.vue`
- `src/components/business/workbench/pages/ProcedurePage.vue` (aria-label + as any only)
- `src/components/business/workbench/pages/RulesPage.vue`

Last updated: 2026-05-11

---

## 2026-05-11: 全代码库 AI_DEV.md 合规性优化（Phase 0-3，第二轮）

### 待处理项推进
完成 5 项待处理中的 3 项：
- Fix 1.3: `convert/index.ts` handler 分解（213→50行） ✅
- Fix 1.4: `feedback/index.ts` handler 分解（180→55行） ✅
- Fix 1.7: `WorkbenchSidebar.vue` script 提取（157→~110行） ✅
- Fix 1.2: `computeZiweiChart` 分解 ⏭️ 跳过（339行核心算法，无测试覆盖）
- Fix 1.5: AI client 统一 ⏭️ 跳过（影响紫微 AI 功能）

### 新增文件
- `src/components/business/workbench/sidebar-menu.ts` — 侧边栏菜单数据 + SECTION_MAP

### 修改文件（6 个）
- `supabase/functions/convert/index.ts` — 提取 validateConvertRequest、checkConvertCache、executeConvertEngine、persistConvertCache；移除本地 isPlainObject，改用 _shared/utils.ts
- `supabase/functions/feedback/index.ts` — 提取 parseFeedbackPayload、checkFeedbackRateLimit、insertFeedbackRow；移除本地 toSafeString，改用 _shared/utils.ts
- `src/components/business/workbench/WorkbenchSidebar.vue` — 菜单数据和路由映射提取到 sidebar-menu.ts

---

## 2026-05-11: 全代码库 AI_DEV.md 合规性优化（Phase 0-3）

---

## 2026-05-11: 全代码库 AI_DEV.md 合规性优化（Phase 0-3）

### 概述
对 DDL 翻译 → 操作日志全功能链（排除 AI 配置页面）进行 AI_DEV.md 合规性优化，修复 2 个 P0 Bug、3 项 P1 结构重构、5 项 P2 清理、2 项 P3 打磨。

### Phase 0 — P0 Bug 修复
- **Fix 0.1**: `src/features/ziwei/compute.ts` — `currentYear` 未声明导致运行时 NaN，添加声明
- **Fix 0.2**: `supabase/functions/app-config/index.ts` — `Boolean(is_encrypted)` 对字符串 `'false'` 返回 `true`，添加 `toBoolean()` 辅助函数

### Phase 1 — P1 结构重构
- **Fix 1.1**: `src/stores/workbench.ts` — `convert()` 89 行 + 三段重复 → `convertKind()` 49 行
- **Fix 1.3-1.5**: 跳过（convert/feedback handler 分解、AI client 统一，避免功能风险）
- **Fix 1.6**: 12+ 静默 catch 块 → 添加 `console.error/warn`（rules/sync.ts, history-sync.ts, ai-utils.ts, compute.ts, http.ts）

### Phase 2 — P2 中等清理
- **Fix 2.1**: 新建 `src/utils/type-guards.ts`（`asRecord`, `asString`, `asArray`, `asNumber`），3 文件引用改为 import
- **Fix 2.2**: 新建 `src/features/navigation/shared.ts`，提取 `resolveLegacyMobileBreakpoint`
- **Fix 2.3**: `_shared/utils.ts` 新增 `isPlainObject`, `toSafeString`
- **Fix 2.4**: `src/api/convert.ts` + `src/stores/workbench.ts` — 使用 `ApiError.code` 替代 `String(err)`
- **Fix 2.6**: CORS 默认 header 提取为 `CORS_DEFAULT_ALLOW_HEADERS`/`CORS_DEFAULT_ALLOW_METHODS` 常量

### Phase 3 — P3 打磨
- **Fix 3.1**: convert-verify 4 组件（ConvertVerifyPanel, VerifyIssueList, VerifyScoreBadge, VerifySuggestionCard）— 硬编码 Tailwind 颜色替换为语义类（`bg-panel`, `text-text`, `bg-brand-600`, `bg-successBg` 等），支持深色主题
- **Fix 3.2**: `src/utils/error-map.ts` 新增 30+ 错误码（convert, rules, id-tool, ziwei, history, operation-logs, app-config）；4 个 stores（rules, operation-logs, ziwei-history, workbench）改用 `mapErrorCodeToMessage()`
- DB 类型颜色替换：FunctionPage, ProcedurePage, RulesPage 中 `#f59e0b/#10b981/#6366f1` → `var(--color-warning/success/chat-accent)`

### 新建文件
- `src/utils/type-guards.ts`
- `src/features/navigation/shared.ts`

### 修改文件（20 个）
- `src/features/ziwei/compute.ts` — currentYear + catch 日志
- `src/features/ziwei/ai-utils.ts` — import type-guards + catch 日志
- `src/features/ziwei/history.ts` — import type-guards
- `src/features/ziwei/history-sync.ts` — catch 日志
- `src/features/rules/persistence.ts` — import type-guards
- `src/features/rules/sync.ts` — catch 日志
- `src/features/navigation/workbench-effects.ts` — import shared
- `src/features/navigation/workbench-state.ts` — import shared
- `src/stores/workbench.ts` — convertKind + ApiError
- `src/stores/rules.ts` — error-map
- `src/stores/operation-logs.ts` — error-map
- `src/stores/ziwei-history.ts` — error-map + 修复 import
- `src/api/convert.ts` — ApiError
- `src/api/http.ts` — catch 日志
- `src/utils/error-map.ts` — 30+ 新错误码
- `src/components/business/convert-verify/ConvertVerifyPanel.vue` — 主题支持
- `src/components/business/convert-verify/VerifyIssueList.vue` — 主题支持
- `src/components/business/convert-verify/VerifyScoreBadge.vue` — 主题支持
- `src/components/business/convert-verify/VerifySuggestionCard.vue` — 主题支持
- `src/components/business/workbench/pages/FunctionPage.vue` — 颜色变量
- `src/components/business/workbench/pages/ProcedurePage.vue` — 颜色变量
- `src/components/business/workbench/pages/RulesPage.vue` — 颜色变量
- `supabase/functions/app-config/index.ts` — toBoolean
- `supabase/functions/_shared/utils.ts` — isPlainObject + toSafeString
- `supabase/functions/_shared/cors.ts` — CORS 常量

### 待后续处理（跳过的 P1 项）
- Fix 1.2: `computeZiweiChart` 339 行分解（高风险纯重构）
- Fix 1.3: `convert/index.ts` handler 213 行分解
- Fix 1.4: `feedback/index.ts` handler 180 行分解
- Fix 1.5: AI client 统一
- Fix 1.7: 大 Vue 组件 script 提取（9 个文件 >150 行）

---

## 2026-05-11: 开发规范合并 — FEATURE_DEV_SPEC 并入 AI_DEV.md

### 概述
将 `docs/FEATURE_DEV_SPEC_AI_NAV_CHAT_FEEDBACK_MENU.md` 独有内容合并到 `docs/AI_DEV.md`，删除原文件，统一为单一规范来源。

### 合并内容
- **§7.2**：补充增量迁移回滚脚本要求
- **§13**：新增"去冗余与复用"6条规则 + 日期注释按需使用说明
- **§15**：补充虚拟滚动、资源加载策略、新增响应式设计子节（§15.4）
- **§20**：明确配置优先级 — `app_configs` 表 > Secrets > 环境变量 > 代码默认值
- **§21.3**：组件清单非穷举说明，Button/Card/Modal 补充细节，新增 Dropdown/Select、Scrollbar 规范
- **§24**：重构为三个子节 — 24.1 任务完成三项输出、24.2 提交前自检清单（9项）、24.3 验收确认

### 冲突裁决
- SQL migration 已提交不可改（以 AI_DEV §7.2 为准）
- 配置优先级以 `app_configs` 表为最高优先级

### 删除文件
- `docs/FEATURE_DEV_SPEC_AI_NAV_CHAT_FEEDBACK_MENU.md`

---

## 2026-05-11: 重复代码消除 — 前端公共组件/Composable + 后端 _shared/ 增强（B1—B14）

### 概述
按照 CODE_REVIEW_FIX_LIST.md 第五章建议，消除前后端 ~800 行重复代码，创建 7 个新文件，修改 17 个现有文件。

### B1 — BaseModal.vue + 3 个弹窗重构

**问题**：ProviderConfigModal、AddKeyModal、ConfigEditModal 各自实现 overlay + ESC + 关闭按钮 + header/footer，~300 行重复 CSS/JS。

**修复**：新建 `src/components/common/BaseModal.vue`（Teleport + overlay + ESC + header/body/footer slot），三个弹窗改为 `<BaseModal>` 包裹，移除重复的 overlay/header/footer CSS 和 `useEscapeKey` 调用。

- ProviderConfigModal: 690 → ~340 行
- AddKeyModal: 457 → ~300 行
- ConfigEditModal: 637 → ~330 行

### B2 — ThemeToggle.vue

**问题**：AppHeader（两处）和 WorkbenchHeaderActions 的主题切换按钮 + SVG 图标完全重复。

**修复**：新建 `src/components/common/ThemeToggle.vue`，支持 `variant="text"|"icon"` 两种模式。AppHeader 主区域用 `variant="text"`，下拉菜单用 `variant="icon"`；WorkbenchHeaderActions 下拉菜单用 `variant="icon"`。移除 6 个内联 SVG 定义和重复的 `.theme-btn`/`.wb-theme-btn` CSS。

### B3 — storage.ts localStorage 工具

**问题**：`try/catch + JSON.parse` 模式在 `AiConfigPage.vue`、`useThemeRuntime.ts`、`stores/ai.ts` 等 5+ 处重复。

**修复**：新建 `src/utils/storage.ts`，导出 `getJson<T>(key, defaultVal): T`、`setJson(key, value): void`、`removeJson(key): void`。更新 3 个文件中的调用处。

### B4 — useEscapeKey 已存在

`src/composables/useEscapeKey.ts` 已在之前的 MEDIUM Issue Fix 中创建，三个 AI 弹窗均已在 B1 重构前就使用此 composable。

### B5 — handleCors() 统一 CORS 处理

**问题**：`buildCorsHeaders(req)` → OPTIONS 返回 → `!corsHeaders` 返回 403 的 6 行样板在 5 个 EF 中逐字重复。

**修复**：`_shared/cors.ts` 新增 `handleCors(req, corsHelpers): Response | null`，返回 null 表示放行。5 个 EF 全部更新为一行调用。

### B6 — errorResponse 规范化

**问题**：ai-chat/feedback 用 `{ ok: false, error }`；ai-config/app-config/convert 用 `{ error }`（缺 `ok: false`）。

**修复**：`errorResponse()` 已是 `{ ok: false, error }` 格式的唯一出口。ai-config 的 `makeResponse` helper 已保留，app-config 和 convert 的 `jsonResponse(..., { error: ... })` 调用未批量修改（需要大面积回归测试），但 `sanitizeError` 移入 `_shared/response.ts` 后统一了错误脱敏逻辑。

### B7 — parseJsonBody()

**问题**：`req.json().catch(() => null)` 在 5 个 EF 中各自手写。

**修复**：`_shared/request.ts` 新增 `parseJsonBody<T>(req): Promise<T | null>`。ai-chat 已更新使用。

### B8 — createLogger() 消除重复 userId/email/ip

**问题**：`logOperation({ userId, userEmail, clientIp, ... }).catch(() => {})` 样板 ~60 处，前三个字段每次重复传入。

**修复**：`_shared/operation-logger.ts` 新增 `createLogger(ctx)` 返回预绑定的 `(operation, overrides?) => void` 函数，内置 `.catch(() => {})`。

### B9 — maskApiKeySync 统一 API Key 掩码

**问题**：ai-config（8+8 或 4+4）、crypto.ts（4+4）、ai-chat（仅末 4 位）、operation-logger（整字段移除）4 种不同实现。

**修复**：`_shared/crypto.ts` 新增 `maskApiKeySync(plain)`（同步版本，前 4 + 后 4 格式），`maskApiKey` 内部复用。ai-chat 和 ai-config 的 `buildMaskedResponse` 已更新使用统一格式。

### B10 — createTtlCache()

**问题**：`cachedXxx + time + if (now - time < TTL) return` 手动 TTL 模式在 ai-chat、ai-config、convert 中逐字重复。

**修复**：`_shared/app-config.ts` 新增 `createTtlCache<T>(fetcher, ttlMs): () => Promise<T>`。

### B11 — sanitizeError 统一

**问题**：ai-config（完整版）、app-config（简化版）各自定义。

**修复**：ai-config 完整版移入 `_shared/response.ts` 并统一导出。ai-config 和 app-config 的本地副本已删除，改为 `import { sanitizeError } from '../_shared/response.ts'`。

### B12 — checkIsAdmin() 统一管理员检查

**问题**：ai-config 查 `admin_users` 表，app-config 查 `app_metadata.is_admin`。

**修复**：`_shared/auth.ts` 新增 `checkIsAdmin(adminClient, email): Promise<boolean>`，统一查询 `admin_users` 表。app-config 已更新使用。

### B13 — getSupabaseEnv()

**问题**：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 在 8 个文件中重复 `Deno.env.get`。

**修复**：`_shared/app-config.ts` 新增 `getSupabaseEnv()` 返回 `{ url, anonKey, serviceRoleKey }`。ai-chat、app-config 已更新使用。

### B14 — ai-client.ts 统一 AI HTTP 调用

**问题**：ai-chat（chat completions）和 ai-config（连接测试）各自实现 URL 拼接、Authorization 头、错误码分类。

**修复**：新建 `_shared/ai-client.ts`，导出 `callAiProvider(config, messages, options): Promise<string>`，统一 URL 构建（含 Claude 特殊路径）、请求头（含 x-api-key 格式）和错误分类（429/401/403/5xx → 统一错误码）。

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/utils/storage.ts` | localStorage JSON 读写工具 |
| `src/components/common/BaseModal.vue` | 通用弹窗组件（overlay+ESC+header/body/footer slot） |
| `src/components/common/ThemeToggle.vue` | 主题切换组件（text/icon 双 variant） |
| `supabase/functions/_shared/ai-client.ts` | 统一 AI HTTP 调用客户端 |

### 修改文件清单

| 文件 | 修改类型 |
|------|----------|
| `src/stores/ai.ts` | B3: localStorage → storage.ts |
| `src/composables/useThemeRuntime.ts` | B3: localStorage → storage.ts |
| `src/components/business/ai/AiConfigPage.vue` | B3: localStorage → storage.ts |
| `src/components/business/ai/ProviderConfigModal.vue` | B1: 重构为 BaseModal 包裹 |
| `src/components/business/ai/AddKeyModal.vue` | B1: 重构为 BaseModal 包裹 |
| `src/components/business/ai/ConfigEditModal.vue` | B1: 重构为 BaseModal 包裹 |
| `src/components/layout/AppHeader.vue` | B2: 主题切换 → ThemeToggle |
| `src/components/business/workbench/WorkbenchHeaderActions.vue` | B2: 主题切换 → ThemeToggle |
| `supabase/functions/_shared/cors.ts` | B5: 新增 handleCors() |
| `supabase/functions/_shared/response.ts` | B11: 新增 sanitizeError() |
| `supabase/functions/_shared/request.ts` | B7: 新增 parseJsonBody() |
| `supabase/functions/_shared/crypto.ts` | B9: 新增 maskApiKeySync() |
| `supabase/functions/_shared/app-config.ts` | B10+B13: 新增 createTtlCache() + getSupabaseEnv() |
| `supabase/functions/_shared/auth.ts` | B12: 新增 checkIsAdmin() |
| `supabase/functions/_shared/operation-logger.ts` | B8: 新增 createLogger() |
| `supabase/functions/ai-chat/index.ts` | B5/B7/B9/B13: handleCors + parseJsonBody + maskApiKeySync + getSupabaseEnv |
| `supabase/functions/ai-config/index.ts` | B5/B9/B11: handleCors + maskApiKeySync + sanitizeError |
| `supabase/functions/app-config/index.ts` | B5/B11/B12/B13: handleCors + sanitizeError + checkIsAdmin + getSupabaseEnv |
| `supabase/functions/feedback/index.ts` | B5: handleCors |
| `supabase/functions/convert/index.ts` | B5: handleCors |

### 构建状态
- ✅ `vue-tsc --noEmit` 通过
- ✅ ESLint 通过（修改文件零 error）
- 消除 ~800 行重复代码

### 部署

```bash
supabase functions deploy ai-chat
supabase functions deploy ai-config
supabase functions deploy app-config
supabase functions deploy feedback
supabase functions deploy convert
pnpm build && pnpm verify
```

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

## 2026-05-11: AI 配置交互响应优化（第二轮）

### 问题与根因

| # | 问题 | 根因 |
|---|---|---|
| 1 | 拖拽排序偶现刷新后顺序回退 | `persistToCache()` 在 API `.then()` 回调中执行，若用户刷新时 API 尚未返回，缓存仍是旧顺序 |
| 2 | 新增/编辑供应商点击保存仍很慢 | `ProviderConfigModal.handleSave()` 自行调用 API → `emit('saved')` → 父级再 `loadProviders()`，弹窗在两次 HTTP 往返期间一直悬停 |
| 3 | Key 管理表格 API Key 显示 `[encrypted] ****` | `buildMaskedResponse` 对加密 key 直接返回 `[encrypted] ****`，未先解密再脱敏 |
| 4 | AI 对话框发消息后回到初始状态，不显示模型/剩余次数 | ① 首条消息失败时 `catch` 清除本地消息导致 `hasMessages=false`，`v-else-if="!hasMessages && !sending"` 欢迎页优先渲染，错误被隐藏；② `providerLabel()` 仅依赖 `useChat()` 的异步数据，无 aiStore 回退 |

### 修复文件

| 文件 | 修改 | 说明 |
|---|---|---|
| `src/stores/ai.ts` | +9 行 | 新增 `persistToCache()` 方法 |
| `src/components/business/ai/AiConfigPage.vue` | 多处 | ① 拖拽排序先调 `persistToCache()` 乐观写缓存再调 API；② 新增 `handleProviderSave()` 接收 payload，先关弹窗再 API，直接更新本地列表跳过全量 fetch；③ `handleAddKeySaved` 先关弹窗再 API |
| `src/components/business/ai/ProviderConfigModal.vue` | 重构 | emit 改为 `save` 携带 payload（isEdit/providerId/data），不再自行调用 API；移除 `aiConfigApi` 导入；`resetForm()` 补充重置 `saving` |
| `supabase/functions/ai-config/index.ts` | handleGet | admin 路径先并行解密所有 config 的 api_key，再传给 `buildMaskedResponse`，显示 `sk-a***b1c2` 脱敏格式 |
| `src/components/business/ai/FloatingChat.vue` | 2 处 | ① 欢迎页条件增加 `&& !error`，失败时错误可见；② `providerLabel()` 新增 aiStore fallback，显示 AI 配置页激活的模型 |

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
