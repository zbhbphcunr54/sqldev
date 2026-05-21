# AI 开发规范（长期目标）

> 本文档是本项目的长期目标规范，用于约束 AI Coding Agent 与人工协作时的实现方式、架构边界和交付质量。  
> 它不是“项目实时快照”，不维护易变的页面清单、完整目录树或一次性事实。

## 0. 适用范围

- IDE：VSCode
- AI 助手：AI Coding Agent（不绑定具体产品名）
- 前端：Vue 3 + TypeScript + Vite
- 后端能力：Supabase（Auth / Database / Storage / Realtime / Edge Functions）
- Edge Functions 运行时：Deno
- 包管理器：pnpm

## 1. Source Of Truth 规则

不同类型的信息必须有明确的唯一事实来源：

- 长期工程规则、架构边界、交付标准：本文件 `docs/AI_DEV.md`
- 当前实现细节、历史沿革、阶段性方案：`docs/CONTEXT_FULL.md`
- 可执行命令、测试入口、校验脚本：`package.json`
- 运行时路由、页面注册、状态归属、缓存行为：仓库代码本身
- 数据库结构：`supabase/migrations/*` + `src/types/database.types.ts`

如果本文档与代码冲突：

- 代码是有意演进后的新基线：同一任务内同步更新本文档
- 代码只是临时例外：在变更说明或 `docs/CONTEXT_FULL.md` 中明确标记，不把临时状态写成规范

## 2. 核心原则

1. 单一事实来源优先，避免同一规则在多处平行维护。
2. 敏感能力后移到服务端，前端不承担安全边界职责。
3. 配置优于硬编码，可变参数应可运营、可调试、可灰度。
4. 纯逻辑与框架/DOM/IO 剥离，优先保持可测试性。
5. 状态按作用域归属，不把所有状态塞进单一 store。
6. 先保证正确性与一致性，再追求局部炫技式抽象。
7. 文档只写稳定规则，不写容易过时的“当前页面名清单”。

## 3. 技术栈基线（必须遵守）

### 3.1 前端

- Vue 3，仅使用 Composition API
- TypeScript strict 模式
- Vue Router 4
- Pinia，仅使用 setup store，禁止 options store
- 网络请求统一走 `src/api/http.ts` 或其上层 API 封装，禁止散写 `fetch`
- TailwindCSS 与 Design Token 混合使用
- ESLint + Prettier

### 3.2 Supabase / 后端

- 前端统一使用 `@supabase/supabase-js`
- 数据库为 PostgreSQL（由 Supabase 提供）
- RLS 默认开启，新增表必须配策略
- Edge Functions 仅处理需要服务端权限、第三方密钥、AI 调用、限流、风控、配置解析等敏感逻辑
- Edge Functions 使用 Deno API，禁止套用 Node.js 专属运行时能力
- 数据库类型定义通过 Supabase CLI 生成，禁止手改生成结果

## 4. AI Agent 输出与执行规则

1. 默认使用 `<script setup lang="ts">`。
2. 涉及 Supabase 的能力必须先判断是用户态查询还是服务端敏感能力。
3. 执行型任务优先直接改代码并验证，不只停留在方案描述。
4. 说明型任务至少包含：改动范围、关键实现思路、风险、验证方式。
5. 响应式状态优先使用 `ref`；仅在对象关系强且整体更新频繁时使用 `reactive`。
6. Props / Emits 使用泛型声明，避免运行时弱约束写法。
7. 访问 Pinia store 时，涉及响应式解包统一使用 `storeToRefs()`。
8. 不允许为了“先跑起来”而绕过错误处理、权限校验、RLS 或类型收窄。

## 5. 架构分层与代码落点

### 5.1 稳定分层

以下职责分层是长期稳定规则：

- `src/api/`：前端 API 封装、协议适配、请求参数与响应结构整理
- `src/components/`：UI 组件与业务组件
- `src/composables/`：Vue 响应式逻辑、组件级状态编排
- `src/features/`：纯业务逻辑、算法、格式化、解析、规则、领域工具
- `src/layouts/`：全局布局容器
- `src/pages/`：路由入口页
- `src/stores/`：跨页面或全局状态
- `src/styles/`：token、全局样式、主题层
- `src/types/`：共享类型
- `src/utils/`：通用工具与类型守卫
- `supabase/functions/_shared/`：Edge Function 共享能力

### 5.2 新代码放置规则

- 纯逻辑、无 DOM、无 Vue 依赖：放 `src/features/<domain>/`
- 可复用的 Vue 响应式逻辑：放 `src/composables/`
- 所有网络访问封装：放 `src/api/`
- 路由入口组件：放 `src/pages/`
- 与具体业务强相关但可复用的 UI：放 `src/components/business/`
- 通用 UI 基础件：放 `src/components/common/`
- Edge Function 共享逻辑：放 `supabase/functions/_shared/`

### 5.3 Barrel 与依赖边界

- Feature 模块可通过 `index.ts` 做具名 re-export
- 禁止无边界的 `export *` 把内部实现细节全部暴露出去
- `src/features/` 内禁止直接操作 DOM
- 纯领域逻辑禁止依赖 Vue、Router、Pinia、浏览器 API

### 5.4 目录文档策略

- 本文档不维护完整目录树，不维护具体页面名列表
- 易变的目录与文件清单放在 `docs/CONTEXT_FULL.md` 或直接以代码为准
- 如果必须在规范里给目录示例，必须明确标注“示例，不是完整清单”

## 6. 配置治理

### 6.1 配置分类

可变参数必须落入以下之一：

- 前端公开配置：`VITE_*`
- 服务端敏感配置：Supabase Secrets
- 运行时业务配置：`app_configs`
- 供应商/用户级 AI 配置：`ai_providers` / `ai_configs`
- 代码默认值：仅作为兜底，不作为主配置来源

### 6.2 优先级原则

每个子系统必须明确自己的配置优先级。未特别说明时，默认遵循：

- 运行时数据库配置 > 服务端 Secret / 环境变量 > 代码默认值

AI 配置解析必须显式声明优先级。长期目标遵循：

- 用户级配置 > 全局配置 > 环境变量兜底 > 代码默认值

### 6.3 Prompt 与 AI 模板规则

- Prompt 不写死在前端页面中
- Prompt 必须拆分为 `system` 与 `user` 两层
- Prompt、temperature、建议问题、长度限制等应走可配置渠道
- 前端只传必要的结构化业务数据，不传密钥、token 或不必要隐私信息

### 6.4 配置命名与维护

- 环境变量名保持语义化、按域分组
- `app_configs` 使用 `category + key` 命名
- 同一配置项不得出现多套并行命名方案
- 配置变更时，需同步更新：读取代码、默认值、测试、运维文档

### 6.5 示例（非穷举）

前端公开变量示例：

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_TIMEOUT_MS=30000
```

服务端环境变量示例：

```env
SUPABASE_SERVICE_ROLE_KEY=...
CORS_PRIMARY_ORIGIN=...
CORS_ALLOWED_ORIGINS=...
ALLOW_LOCALHOST_ORIGIN=false
DEFAULT_AI_BASE_URL=...
DEFAULT_AI_MODEL=...
DEFAULT_AI_API_KEY=...
AI_CONFIG_ENCRYPT_KEY=...
```

> 示例只展示命名风格与职责，不表示完整变量清单。

## 7. Supabase 客户端与类型规范

- 浏览器侧只使用 anon key，禁止暴露 `service_role`
- 客户端实例统一放在 `src/lib/`
- 缺失关键环境变量时必须 fail fast
- 数据库类型统一从 `@/types` 入口导入
- 每次 migration 变更后，必须重新生成数据库类型并通过类型检查
- 禁止手改 `src/types/database.types.ts`

## 8. Auth、权限与会话规范

1. 登录态来源统一以 `getSession()` + `onAuthStateChange` 为准。
2. 路由守卫负责拦截受保护页面，UI 隐藏不是安全边界。
3. 管理员、白名单、配额、供应商可用性等敏感判断以服务端结果为准。
4. 登出必须清理用户敏感状态与用户级缓存。
5. 重定向路径必须经过净化，防止 open redirect。

### 8.1 订阅与监听清理

- `onAuthStateChange`
- `matchMedia`
- `addEventListener`
- 长生命周期定时器

以上资源必须有对应清理逻辑，并考虑 HMR 与测试环境重复挂载。

## 9. 数据库、RLS 与迁移规范

### 9.1 RLS 与表设计

- 新表默认开启 RLS
- 用户私有数据必须有 `user_id` 或等价归属字段，并绑定 `auth.uid()`
- 敏感表不得依赖“前端不显示入口”来做权限控制
- 所有业务表必须有表注释；非直观字段必须有列注释

### 9.2 Migration 策略

- migration 文件只做增量演进，不作为手工记事本
- 已进入共享环境的 migration 禁止回写修改，修正必须新建 migration
- 尚未进入共享环境的本地 migration 可整理，但必须谨慎
- 破坏性迁移必须提供回滚思路或显式不可回滚说明
- DDL 与大规模 DML 尽量拆分

### 9.3 Schema 示例规则

- 本文档中的 SQL 示例仅用于说明规范，不作为真实 schema 的复制来源
- 真实字段、约束、索引、注释以最新 migration 为准

## 10. 前端数据访问与 API 契约

### 10.1 调用边界

- 页面组件不直接拼复杂请求
- 页面通过 `src/api/*` 或经过封装的 composable 发起请求
- 所有异步请求必须处理 `loading / success / error / empty`

### 10.2 运行时校验

- TypeScript 只解决编译期问题
- 关键 API 必须做运行时校验
- 输入结构、长度、枚举值在前端做最小必要校验，服务端做完整校验
- 服务端校验失败必须返回结构化 `validation_*` 错误码

### 10.3 HTTP 层能力要求

统一请求层长期应具备以下能力：

- token 缓存与到期前刷新
- 并发相同请求去重
- 超时控制
- 网络错误与 5xx 重试
- 结构化错误转换
- 统一的用户提示映射

## 11. Edge Function 设计规范

### 11.1 何时必须使用 Edge Function

- 需要 `service_role`
- 需要第三方 API Key
- 需要聚合多张受限表
- 需要统一限流、配额、白名单、审计
- 需要对 AI 请求进行模板控制、输出治理或脱敏

### 11.2 分层约束

- 入口只负责：CORS、鉴权、解析、分发、响应
- 共享逻辑沉淀到 `_shared/`
- 复杂业务逻辑拆成 handler / service / parser / provider 层
- 禁止把整段业务写在单文件入口中

### 11.3 标准处理流程

长期统一流程：

```txt
CORS -> 限流 -> 认证 -> 请求体校验 -> 业务逻辑 -> 结构化响应 -> 审计日志
```

### 11.4 响应与错误

- 错误响应必须结构化
- 禁止把上游 AI 原始报文、SQL、stack trace 直接回给用户
- 需要流式输出时，必须定义稳定事件协议

## 12. AI 接入与模型治理

1. AI 请求必须从服务端发起。
2. Prompt 必须可配置，不允许前端写死核心模板。
3. 供应商解析优先走用户/全局配置，再走环境变量兜底。
4. AI Key 必须加密存储或保存在服务端 Secret 中。
5. 温度、超时、长度限制、建议问题等参数必须可配置。
6. 复杂输出优先结构化；超长输出优先流式或分段，而不是盲目加大超时。
7. AI 失败必须有可理解的降级提示，且不暴露 provider 内部细节。

## 13. 页面组织、状态归属与生命周期

### 13.1 状态归属规则

按作用域决定状态放置位置：

- 全局导航、跨页面共享状态：Pinia store
- 单页面或单业务流状态：页面内 composable
- 纯展示派生状态：`computed`
- 需要刷新后保留的状态：显式持久化到 storage 或后端

禁止把所有页面状态都塞进单一“超级 store”。

### 13.2 Page Cache / KeepAlive 规则

当页面在“切换后返回仍应保留状态”时：

- 可使用 `KeepAlive`
- 必须明确缓存边界和失效条件
- 外层 `RouterView`、布局层 `key`、动态组件 `key` 不得误伤缓存根节点
- 如果业务要求只是“切页保留”，不要错误承诺“刷新浏览器也保留”

### 13.3 持久化规则

- 需要刷新后保留的状态必须显式设计持久化
- `localStorage` key 统一命名为 `sqldev:<module>:<key>`
- 用户相关缓存必须按用户维度隔离
- 存储结构变更必须有版本或迁移策略

## 14. 错误处理与可观测性

### 14.1 错误表达

- `src/features/` 中的纯逻辑优先返回 `Result`
- API 封装层可抛 `ApiError`，但必须有稳定 `code`
- 禁止用裸字符串作为复杂错误协议

建议模式：

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

### 14.2 用户文案

- 用户侧错误文案集中在 `error-map`
- 组件和 composable 中禁止散写大量面向用户的错误文案
- 错误文案应可理解、可操作，不只写“出错了”

### 14.3 日志与追踪

- 禁止空 `catch {}`
- 请求链路应可追踪，建议统一 `request_id`
- 结构化日志至少包含：时间、服务、操作、状态、耗时、错误码、用户标识（可空）
- 严禁记录 token、密钥、完整 SQL、上游原始报文、隐私明文

## 15. 测试规范

### 15.1 测试栈策略

- 当前仓库允许混合测试栈并存，例如 Node `.mjs` 测试与 Vitest
- `package.json` 中的脚本是唯一事实来源
- 规范文档描述的是“应验证什么”，不是替代脚本清单

### 15.2 长期要求

- 新增纯逻辑必须有自动化测试
- 复杂 API 协议与错误映射必须有测试
- 复杂 composable 必须有测试
- 关键入口、barrel 导出、架构约束必须有 smoke 测试

### 15.3 脚本接入规则

- 如果新增新的测试入口，必须纳入 `package.json`
- `pnpm verify` 必须保持为完整门禁入口
- CI 至少执行 `verify`，重大改动应附加 `build`

## 16. 代码风格与质量门槛

- 函数应短小、职责单一
- 超长组件优先拆 composable 或无状态子组件
- 复杂正则、算法分支、时序逻辑必须提取命名常量或加简短 WHY 注释
- 避免重复实现；出现第二处相同逻辑时，优先抽象
- 优先使用 `unknown` + 类型守卫，不滥用 `as`
- 优先复用现有基础件，不制造平行组件体系
- 编辑器统一遵循 `.editorconfig`
- 所有源码、文档、脚本与配置文件默认使用 UTF-8 编码，建议无 BOM，禁止提交会导致乱码的其他编码文件
- 新增或修复文件时，如发现历史遗留的非 UTF-8 文件，应在确认安全后统一转换为 UTF-8
- 提交前应运行 `pnpm check:utf8`；若校验失败，必须先定位并修复编码问题，再继续提交

### 16.1 注释原则

注释只写以下内容：

- 非直觉技术决策
- 临时 workaround 与后续清理计划
- 跨模块协作必须知道的隐含约束

禁止写重复代码字面意思的注释。

## 17. Git、Hooks 与 CI/CD

### 17.1 Git 规则

- 分支命名语义化，如 `feat/*`、`fix/*`、`refactor/*`
- Commit Message 采用 Conventional Commits
- 除非用户明确要求，提交前先完成本地验证

### 17.2 Hooks 原则

- 提交规范可通过 Husky、CI 或两者共同保证
- 如果仓库已经存在 hook，文档与实际行为必须一致
- 不再把“已存在的 hook”写成“待引入”

### 17.3 CI/CD 原则

CI 长期至少覆盖：

1. 安装依赖
2. 静态检查
3. 类型检查
4. 自动化测试
5. 构建验证

CD 涉及 Edge Functions 或 migration 时，必须有明确部署步骤与回滚说明。

## 18. 性能与缓存规范

- 路由页面默认懒加载
- 大型第三方依赖按需引入
- 长列表考虑分页或虚拟滚动
- 图片与字体有明确加载策略
- 请求层必须防抖/去重/重试策略清晰
- storage 缓存必须有大小上限、TTL 或版本

## 19. 响应式与多端适配规范

### 19.1 默认原则

- 工作台类、信息密度高的页面默认 desktop-first
- 面向终端用户的页面可按业务目标选择 mobile-first
- 无论采用哪种策略，手机端与平板端必须保持功能可用，不允许“只缩放桌面布局”
- 移动端适配范围默认覆盖 Android 手机 / 平板、iPhone / iPad、鸿蒙手机 / 平板上的主流浏览器与 WebView；除非需求明确收窄，不允许只在单一系统验证后视为完成
- 规则优先基于浏览器能力、视口和交互边界，而不是针对单一机型写硬编码特判；确需特判时必须说明原因、影响范围和后续清理条件

### 19.2 断点与验收

- 手机：375px 起
- 平板：768px 起
- 桌面：1024px 起

至少验证：

- Android 手机浏览器 / WebView
- Android 平板浏览器 / WebView
- iPhone Safari / WKWebView 类环境
- iPad Safari / WKWebView 类环境
- 鸿蒙手机浏览器 / WebView
- 鸿蒙平板浏览器 / WebView
- 手机竖屏
- 手机横屏或小高宽比场景
- 平板竖屏
- 平板横屏
- 平板分屏 / 多窗口或近似中等宽度场景
- 桌面
- 软键盘弹起后的表单、输入区、底部操作区
- 长内容滚动、抽屉 / Modal / Bottom Sheet 开关、loading / empty / error 状态

### 19.3 视口与安全区

- 全屏容器、移动端抽屉、底部弹层优先使用 `100dvh`，可保留 `100vh` 作为兼容 fallback
- 固定头部、底部操作栏、底部输入区、Bottom Sheet 必须考虑 `env(safe-area-inset-top/bottom/left/right)`，避免被刘海屏、圆角和系统手势区遮挡
- 不允许假设移动端可视高度恒定；涉及 `fixed` / `sticky` / 全屏容器时必须验证地址栏展开收起后的布局稳定性
- 平板分屏、多窗口和横竖屏切换时，必须验证 `fixed` / `sticky` / Drawer / Bottom Sheet 的位置与尺寸是否仍然正确
- 需要沉浸式铺满屏幕时，必须明确是否依赖 `viewport-fit=cover`，并同步处理安全区内边距

### 19.4 交互与表单

- 热区不小于 44x44px
- 关键能力不能只依赖 hover
- 手机端输入控件最小高度建议不低于 44px，输入字体不小于 16px，避免 iOS 自动缩放
- 表单应按场景补齐 `inputmode`、`autocomplete`、`enterkeyhint` 等移动端输入提示，减少错误输入与键盘切换成本
- 固定底部 CTA、聊天输入框、Bottom Sheet 内表单必须验证软键盘弹起后仍可见、可点击、可关闭
- 模态、抽屉、下拉必须考虑小屏可达性与背景滚动锁定

### 19.5 滚动与层级

- 页面主纵向滚动容器必须清晰，避免多层 `overflow: hidden` / `overflow: auto` 叠加导致滚动阻断
- 长内容与嵌套滚动必须避免滚动冲突
- 横向滚动区、轮播区、卡片滑动区应显式处理 `overscroll-behavior`、滚动穿透与误触问题；必要时启用 `-webkit-overflow-scrolling: touch`
- `sticky` / `fixed` 元素必须验证与抽屉、遮罩、弹层、系统安全区之间的层级关系，不允许出现操作入口被遮挡或不可点击

### 19.6 信息密集页面的移动端降级

- 桌面双栏 / 三栏 / 工作台页面在 `<=1023px` 时必须提供明确降级方案，如单栏堆叠、Tab、Drawer、折叠区或摘要视图
- 平板端是否采用桌面布局，必须依据实际可用宽度与交互密度判断，不能仅按“这是平板”就强行复用桌面三栏
- 表格、代码块、日志流、编辑器类区域必须定义小屏策略：横向滚动、列裁剪、卡片化或只读摘要；不允许默认溢出破版
- 关键主操作在手机端必须可发现，不得只藏在 hover 工具条、桌面侧栏或首屏外难以理解的位置

## 20. 编辑器与高复杂度组件规范

- 高复杂度组件必须有明确的状态边界、输入输出契约和销毁清理逻辑
- SQL 编辑器类组件应支持主题、语法高亮、提交快捷键与只读态
- 高复杂度组件的键盘、焦点、滚动行为必须有明确约束
- 复杂组件应优先提供最小稳定 API，避免透传过多内部细节

## 21. UI/UX 与 Design Token 规范

### 21.1 视觉方向

- 简洁、通透、层级清晰、克制动效
- 中性色为主，品牌色与功能色为辅
- 通过留白、字重、对比与弱描边建立高级感

### 21.2 Token 规则

- 新样式优先复用 `src/styles/tokens.css`
- 模板优先使用 Tailwind 语义类
- 样式文件优先使用 CSS 变量
- 禁止随意发明新颜色、圆角、阴影、间距体系

### 21.3 组件规范

- Button：必须有 hover / active / disabled / loading / focus-visible
- Card：标题区、内容区、操作区结构清晰
- Form：必须有 label、错误提示、提交反馈
- Table / List：必须有 loading / empty / error
- Modal / Drawer：必须支持 ESC、焦点管理、背景滚动控制
- Dropdown / Select：必须支持外部点击关闭与基础键盘可达
- Scrollbar：统一视觉风格，避免每页各写一套

### 21.4 可访问性

- 文本对比度满足 WCAG AA
- 图标按钮必须有 `aria-label`
- 不能只靠颜色表达状态
- 动态内容应考虑 `aria-live`
- 尊重 `prefers-reduced-motion`

## 22. 禁止项清单（高优先级）

### 22.1 代码层

- 禁止 Vue 2 / Vuex 写法
- 禁止未收敛的 `any`
- 禁止页面散写复杂业务 SQL 或请求逻辑
- 禁止空 `catch {}`
- 禁止无校验地消费外部输入

### 22.2 安全层

- 禁止在前端暴露 `service_role`
- 禁止建议长期关闭 RLS
- 禁止把服务端敏感能力下放到浏览器
- 禁止把内部错误细节直接返回给用户

### 22.3 样式层

- 禁止在新 UI 中大面积硬编码颜色
- 禁止无 token 支撑的随意 spacing / radius / shadow
- 禁止复制粘贴出第二套平行设计体系

### 22.4 配置层

- 禁止把未来可能调整的业务参数写死在代码里
- 禁止同一配置项存在多套命名与多条读取链路
- 禁止把当前临时默认值写成长期规范

## 23. 安全检查清单

涉及接口、认证、AI、上传、数据库变更时，必须检查：

- CORS 是否只放行必要 origin
- JWT / token 是否在服务端校验
- RLS 是否开启且有策略
- 请求体是否有大小、深度、结构校验
- 是否有速率限制或配额控制
- 是否做了错误脱敏
- 日志是否避免泄露敏感信息
- 前端权限隐藏是否有服务端校验兜底
- AI Key 是否加密存储或保存在安全 Secret 中
- 重定向路径是否已净化

## 24. 任务验收标准

### 24.1 完成任务后至少应说明

1. 变更了哪些文件，目的是什么
2. 做了哪些验证，结果是什么
3. 是否需要部署、执行 migration、更新配置或补充文档

### 24.2 提交前自检

1. 是否出现重复实现
2. 是否遵守状态归属与缓存边界
3. 是否保持前后端配置、错误文案、权限判断一致
4. 是否补充了必要测试
5. 是否影响多端布局、主题或可访问性
6. 是否需要同步更新文档

## 25. 文档维护与演进规则

### 25.1 本文档写什么

- 稳定架构边界
- 长期工程规则
- 质量与验收标准
- 应该如何做，而不是今天有哪些具体页面文件

### 25.2 本文档不写什么

- 容易变动的完整目录树
- 当前所有页面名和组件名清单
- 某次临时排障结论
- 可执行脚本的完整复制版

### 25.3 更新规则

- 当代码演进改变了长期基线，必须同步更新本文档
- 当只是阶段性实现变化，优先更新 `docs/CONTEXT_FULL.md`
- 如果规范落后于实现，优先修规范，而不是让旧规范继续误导后续开发

### 25.4 演进原则

- 优先兼容当前已采用的稳定能力
- 不为了抽象而抽象，不为了统一而制造复杂度
- 新依赖、新架构、新配置模型的引入，必须说明收益、成本、回滚路径
