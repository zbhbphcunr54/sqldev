# AI 开发规范（VSCode + Codex + Vue + Supabase）

> 本文档用于约束 AI Coding Agent在本项目中的代码生成行为。  
> 目标：统一技术栈、减少返工、确保生成代码可直接运行与维护。

---

## 0. 适用环境

- IDE：VSCode
- AI 助手：Codex
- 前端：Vue 3 + TypeScript + Vite
- 后端能力：Supabase（Auth / Database / Storage / Realtime / Edge Functions）
- 包管理器：pnpm（如项目已使用 npm/yarn，以现有为准）

---

## 1. 技术栈基线（必须遵守）

### 前端
- Vue 3（仅 Composition API）
- TypeScript
- Vue Router 4
- Pinia
- Axios 或 fetch（统一封装，不散写）
- CSS框架：TailwindCSS。必须使用 Tailwind 实用类进行样式编写，禁止散写内联 style，优先组合使用 Design Token 对应的类名
- ESLint + Prettier

### 后端（BaaS）
- Supabase JS SDK（`@supabase/supabase-js`）
- Supabase Auth（邮箱/OTP/OAuth 以项目配置为准）
- PostgreSQL（通过 Supabase 提供）
- Row Level Security（RLS）必须启用并配策略
- Storage Bucket（如有上传需求）
- Edge Functions（仅处理需要服务端权限的逻辑）
- 必须使用 Supabase CLI 生成的 Database 类型定义（假定路径为 src/types/supabase.ts），所有针对 Supabase的查询必须带上泛型 <Database> 以确保行列类型的严格推导

---

## 2. AI 输出总规则（必须执行）

1. 默认使用 `<script setup lang="ts">`。
2. 禁止使用 Vue 2 Options API（`data` / `methods` / `created`）。
3. 禁止引入 Vuex（状态管理统一 Pinia）。
4. 新代码必须有类型定义，避免裸 `any`。
5. 涉及 Supabase 的功能，必须区分：
   - **前端可做**：用户态查询（受 RLS 限制）
   - **服务端做**：管理员权限、敏感写操作（Edge Function）
6. 返回代码时必须包含：
   - 文件路径
   - 完整代码
   - 必要环境变量说明
   - 简短验证步骤
7. 前端响应式状态统一优先使用 ref，涉及复杂对象时再使用 reactive，禁止随意解构失去响应式

---

## 3. 项目建议目录结构

```txt
src/
  api/                 # 业务 API 封装（可封装 Supabase 查询）
  lib/
    supabase.ts        # Supabase Browser Client
  stores/              # Pinia
  composables/         # useAuth/useProfile 等
  pages/               # 路由页面
  router/              # 路由配置
  types/               # TS 类型
  utils/               # 工具函数
supabase/
  migrations/          # SQL migration
  functions/           # Edge Functions
docs/
  AI-DEV-RULES.md
```

---

## 4. 环境变量规范

前端仅使用公开 key：

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 强制规则
- **禁止**在前端使用 `service_role` key。
- `service_role` 只允许在服务端（Edge Function/安全服务器）使用。
- 任何密钥不得硬编码进源码。

---

## 5. Supabase 客户端标准写法

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

---

## 6. Auth 规范（必遵守）

1. 登录态来源以 `supabase.auth.getSession()` + `onAuthStateChange` 为准。
2. 用户信息统一放在 Pinia Store / composable，不在多个组件重复维护。
3. 路由守卫保护需要登录的页面。
4. 登出必须清理本地业务状态（Pinia 缓存等）。

---

## 7. 数据库与 RLS 规范（关键）

1. 新表默认开启 RLS。
2. 至少定义：
   - `select` 策略
   - `insert` 策略
   - `update` 策略
   - `delete` 策略（按需）
3. 用户私有数据必须包含 `user_id` 并绑定 `auth.uid()`。
4. 禁止为了“先跑通”而关闭 RLS。

示例策略思路（伪代码）：
- `select`: `auth.uid() = user_id`
- `insert`: `auth.uid() = user_id`
- `update`: `auth.uid() = user_id`

---

## 8. 前端数据访问规范

1. 所有 Supabase 查询统一封装到：
   - `src/api/*.ts` 或 `src/composables/*.ts`
2. 页面组件只调用封装函数，不直接拼复杂查询。
3. 异步请求必须处理三态：`loading / success / error`。
4. 列表页必须考虑空状态（empty state）。

---

## 9. 何时使用 Edge Functions

以下场景必须走 Edge Functions：
- 需要 `service_role` 权限
- 聚合多个受限表并返回裁剪结果
- 调用第三方私密 API（需隐藏密钥）
- 支付、风控、配额结算等敏感逻辑

---

## 10. 代码风格与质量门槛

- 函数单一职责，避免超长函数（>80 行建议拆分）
- 复用逻辑放 `composables`
- 可复用类型放 `types`
- 提交前通过：
- TypeScript 类型检查
- ESLint
- 基本可用性自测
- 超过 150 行的 Vue 组件必须进行拆分。UI 表现层分离为无状态组件（Dumb Components），业务逻辑保留在页面或智能组件（Smart Components）中

---

## 11. AI 任务响应模板（强制格式）

当我提需求时，请按以下结构输出：

1. 实现方案（3-6条）
2. 变更文件清单
3. 完整代码（按文件分别给出）
4. Supabase 变更（SQL / RLS / Function）
5. 验证步骤（本地如何运行、如何验收）
6. 风险与后续优化（可选）

---

## 12. 禁止项清单（高优先级）

- 禁止输出 Vue 2 语法
- 禁止在前端暴露 `service_role`
- 禁止建议关闭 RLS 作为长期方案
- 禁止无类型 API 返回
- 禁止把业务 SQL 直接散落在组件内
- 禁止跳过错误处理与空状态处理

---

## 13. 版本演进原则

- 优先兼容当前项目已安装依赖版本
- 不随意引入新库（先复用现有栈）
- 涉及升级（Vue/Supabase SDK）时，先给迁移清单，再改代码

## 14. UI/UX 视觉与交互规范（高端现代风格）

> 目标：界面风格对齐 2026 年主流 SaaS / AI 产品（简洁、通透、层次清晰、动效克制、信息密度合理）。

### 14.1 设计关键词（AI 必须遵循）

- 简洁（Simple）
- 通透（Clean / Airy）
- 高级灰（Neutral-first）
- 强层次（Clear hierarchy）
- 弱分割（少边框，靠留白和对比建立结构）
- 微动效（Subtle motion）
- 强可读性（Readable first）

---

### 14.2 视觉语言基线

1. **配色策略**
   - 使用「中性色 + 单一品牌色 + 功能色（成功/警告/错误）」体系。
   - 避免大面积高饱和颜色；品牌色用于按钮、链接、焦点态。
   - 支持浅色/深色双主题（默认跟随系统，可手动切换）。

2. **圆角与阴影**
   - 全局圆角统一：卡片 `12-16px`，按钮 `10-12px`，输入框 `10px`。
   - 阴影采用低对比柔和阴影，禁止厚重投影。
   - 优先使用边框 + 背景层次，而不是重阴影。

3. **间距与留白**
   - 采用 8pt 栅格系统（4/8/12/16/24/32/48）。
   - 卡片内边距建议 `20-24px`，模块间距 `24-32px`。
   - 页面最大内容宽度建议 `1200-1280px`，超宽屏保持居中与留白。

4. **排版层级**
   - 字体建议：`Inter` / `PingFang SC` / `SF Pro` / 系统无衬线回退。
   - 正文优先 `14px/16px`，行高 `1.5~1.7`。
   - 标题层级清晰（H1/H2/H3），禁止同屏多个视觉主标题抢焦点。
   - 数字、金额、指标使用等宽数字（tabular nums）提升专业感。

---

### 14.3 组件风格要求（AI 生成 UI 时必须执行）

1. **Button**
   - 主按钮：实心品牌色；次按钮：浅底/描边；危险按钮：红色语义化。
   - 必须提供 `hover / active / disabled / loading` 状态。
   - 禁止过度渐变、发光特效。

2. **Card**
   - 默认卡片用于承载主要信息块。
   - 卡片结构固定：`标题区 + 内容区 + 操作区（可选）`。
   - 禁止卡片内堆叠过多边框，优先分组和留白。

3. **Form**
   - 标签与输入框上下布局优先，移动端更易读。
   - 必须有：必填标识、即时校验、错误提示、提交反馈。
   - 错误文案可执行、可理解（告诉用户如何修复）。

4. **Table / List**
   - 表格行高适中（40-48px），表头信息明确。
   - 提供空状态、加载骨架屏、错误状态。
   - 操作列固定在右侧（如有多操作，收敛到菜单）。

5. **Modal / Drawer**
   - 仅用于短流程；复杂流程优先独立页面。
   - 必须支持 ESC 关闭、遮罩关闭（危险操作除外）、焦点回收。

---

### 14.4 交互体验规范（高级感核心）

1. **动效**
   - 动效时长建议 `150ms ~ 280ms`，缓动使用 `ease-out`。
   - 仅对必要元素做动效（弹层、hover、列表更新）。
   - 禁止大幅位移和频繁闪烁动画。

2. **反馈系统**
   - 所有用户操作必须有反馈：按钮 loading、toast、状态变化。
   - 异步请求必须有“进行中”状态，不可静默等待。
   - 危险操作必须二次确认（删除、覆盖、重置   。

3. **状态完备**
   - 每个页面都必须覆盖：`loading / empty / error / success` 四态。
   - 空状态要提供下一步动作（如“去创建”“去绑定”）。

4. **可用性细节**
   - 点击热区不小于 `40x40px`。
   - 键盘可达（Tab 顺序清晰，焦点样式可见）。
   - 文案避免技术黑话，强调业务可理解性。

---

### 14.5 响应式与布局规范

- 断点建议：
  - `sm: 640`
  - `md: 768`
  - `lg: 1024`
  - `xl: 1280`
  - `2xl: 1536`
- 页面布局推荐：
  - 桌面端：左侧导航 + 顶栏 + 内容区
  - 移动端：顶部导航 + 抽屉菜单
- 在 `md` 以下减少多列卡片，优先单列信息流。

---

### 14.6 可访问性（A11y）最低要求

- 文本与背景对比度满足 WCAG AA。
- 所有 icon button 必须有 `aria-label`。
- 表单元素必须绑定 label。
- 不仅靠颜色传达状态（需配合图标/文字）。

---

### 14.7 AI 生成页面时的附加输出要求

当生成任何页面 UI，请额外输出：

1. **视觉说明**：该页面如何体现“高端现代风格”（3 点以内）。
2. **主题 token**：颜色、圆角、阴影、间距 token 清单。
3. **状态清单**：列出该页面覆盖的 loading/empty/error/success。
4. **可访问性检查项**：至少 3 条。
5. **可优化项**：性能或体验优化建议（1-3 条）。

---

### 14.8 禁止的视觉问题（必须避免）

- 禁止“花哨但不实用”的重渐变、重投影、玻璃拟态滥用。
- 禁止页面元素未对齐、间距不一致、圆角不统一。
- 禁止字体大小层级混乱。
- 禁止弹窗里堆复杂流程。
- 禁止只有“好看截图”但缺少交互状态。

---

## 15. Design Token 执行规则（必须遵守）

1. 新增样式时，必须优先使用 `src/styles/tokens.css` 中的 token。
2. 禁止直接写硬编码颜色（如 `#3b82f6`），应改用 `var(--color-brand-500)`。
3. 禁止随意新增间距值（如 `18px`）；必须使用 spacing token。
4. 圆角、阴影、动效必须使用既有 token。
5. 新组件必须同时兼容 light/dark（至少保证可读性和对比度）。
6. 所有可交互元素（按钮、输入框、链接）必须有清晰 focus 态。
7. 页面必须覆盖 loading / empty / error / success 四种状态视觉。
8. 当我要求“高端感/现代化”时，优先通过：
   - 留白层次
   - 字重与字号层级
   - 轻阴影与弱边框
   - 克制动效
  来实现，而非花哨特效。