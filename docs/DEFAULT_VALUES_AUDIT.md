# 默认值审计清单 — AI 配置 / 导航栏 / 反馈 / AI 助手 / 三点菜单

> 2026-05-11 | 覆盖前后端 27 个文件

---

## 一、后端 Edge Functions

### ai-chat/index.ts

| # | 位置 | 默认值 | 用途 | 可入 app_configs？ | 建议 key |
|---|------|--------|------|--------------------|----------|
| 1 | L123 | `0.7` | AI temperature | **是** | `ai_chat.temperature` |
| 2 | L124 | `4096` | AI max_tokens | **是** | `ai_chat.max_tokens` |
| 3 | L128 | `attempt < 2` | AI 调用重试次数 | **否**（建议直接删除重试） | — |
| 4 | L42-44 | `'你是 SQLDev 的 AI 数据库助手。'` | system_prompt 默认值 | **已是** `ai_chat.system_prompt`（有 defaultValue 兜底） | 已有 |
| 5 | L46-49 | `20` | daily_limit 默认值 | **已是** `ai_chat.daily_limit`（有 defaultValue 兜底） | 已有 |
| 6 | L51-54 | `0` | context_limit 默认值（0=不加载历史） | **已是** `ai_chat.context_limit`（有 defaultValue 兜底） | 已有 |
| 7 | L65-71 | `windowMs: 60_000, maxRequests: 10` | 频率限制参数 | **是** | `ai_chat.rate_limit_max`、`ai_chat.rate_limit_window_ms` |
| 8 | L328 | `message.length > 4000` | 用户消息最大长度 | **是** | `ai_chat.max_message_length` |

### ai-config/index.ts

| # | 位置 | 默认值 | 用途 | 可入 app_configs？ | 建议 key |
|---|------|--------|------|--------------------|----------|
| 11 | L325 | `45000`（经 `getDefaultTimeout`） | 新增 Key 默认超时 | **已是** `ai.default_timeout_ms`（有 defaultValue 兜底） | 已有 |
| 12 | L317 | `count >= 20` | 全局最大 ai_configs 数量 | **是** | `ai_config.max_configs_global` |
| 13 | L24-25 | `RATE_LIMIT = 6, RATE_WINDOW = 60_000` | 测试接口频率限制 | **是** | `ai_config.test_rate_limit_max`、`ai_config.test_rate_limit_window_ms` |
| 14 | L1028-1042 | `cooldownSeconds = 10`（测试冷却） | 同 provider 测试冷却 | **是** | `ai_config.test_cooldown_seconds` |

### ai-resolver.ts

| # | 位置 | 默认值 | 用途 | 可入 app_configs？ | 建议 key |
|---|------|--------|------|--------------------|----------|
| 15 | L70 | `'https://api.deepseek.com/v1'` | 默认 AI base_url | **已是** `ai.default_base_url`（有 defaultValue 兜底） | 已有 |
| 16 | L71 | `'deepseek-chat'` | 默认 AI model | **已是** `ai.default_model`（有 defaultValue 兜底） | 已有 |
| 17 | L72 | `''`（空字符串） | 默认 AI api_key | **已是** `ai.default_api_key`（有 defaultValue 兜底） | 已有 |
| 18 | L73 | `45000` | 默认 AI timeout_ms | **已是** `ai.default_timeout_ms`（有 defaultValue 兜底） | 已有 |

### feedback/index.ts

| # | 位置 | 默认值 | 用途 | 可入 app_configs？ | 建议 key |
|---|------|--------|------|--------------------|----------|
| 19 | L105-111 | `windowMs: 60_000, maxRequests: 10` | 反馈频率限制 | **是** | `feedback.rate_limit_max`、`feedback.rate_limit_window_ms` |
| 20 | ~L79 | `content.length > 1200` | 反馈内容最大长度 | **是**（前后端两处独立维护） | `feedback.max_content_length`（已有，但当前函数未读取） |
| 21 | ~L97 | `contact.length > 120` | 联系方式最大长度 | **是** | `feedback.max_contact_length`（已有，但当前函数未读取） |

### cors.ts

| # | 位置 | 默认值 | 用途 | 可入 app_configs？ | 建议 key |
|---|------|--------|------|--------------------|----------|
| 22 | L60-61 | `allowHeaders: 'authorization, x-client-info, apikey, content-type'` | CORS 允许头 | **是** | `cors.allow_headers` |
| 23 | L61,72 | `allowMethods: 'GET, POST, PATCH, DELETE, OPTIONS'` | CORS 允许方法 | **是** | `cors.allow_methods` |
| 24 | L59 | `allowLocalhost: true` | 是否允许本地开发 | **已是** `cors.allow_localhost` | 已有 |

### rate-limit.ts

| # | 位置 | 默认值 | 用途 | 可入 app_configs？ | 建议 key |
|---|------|--------|------|--------------------|----------|
| 25 | — | `trackMax` 无统一默认（由调用方显式传入，如 ai-chat=500、feedback=2000） | 内存限流器最大追踪数 | **否**（运行时行为参数，运维调优用） | — |
| 26 | — | `storeMode: 'kv'`（默认） | 限流存储模式 | **否**（架构选择） | — |

---

## 二、前端

### http.ts（API 层）

| # | 位置 | 默认值 | 用途 | 可入 app_configs？ | 建议 key |
|---|------|--------|------|--------------------|----------|
| 27 | L9 | `DEFAULT_TIMEOUT_MS = 60_000` | 前端 fetch 超时 | **否**（已是 `VITE_API_TIMEOUT_MS` 环境变量，运行时不需要动态改） | — |
| 28 | L10 | `MAX_RETRIES = 2` | 请求自动重试次数 | **否**（客户端网络策略，不应服务端配置） | — |
| 29 | L13 | `RETRY_DELAY_BASE = 500` | 重试延迟基数 | **否**（客户端网络策略） | — |
| 30 | L15 | `DEFAULT_TOKEN_TTL_SECONDS = 3600` | token 缓存 TTL | **否**（客户端缓存策略） | — |

### AiConfigPage.vue

| # | 位置 | 默认值 | 用途 | 可入 app_configs？ | 建议 key |
|---|------|--------|------|--------------------|----------|
| 31 | L35 | `LONG_PRESS_DELAY = 150` | 长按触发拖拽阈值(ms) | **否**（UI 交互微调） | — |
| 32 | L36 | `DRAG_THRESHOLD = 5` | 拖拽启动像素阈值 | **否**（UI 交互微调） | — |
| 33 | L316 | `TOOLTIP_WIDTH = 300` | 提示框宽度 | **否**（应放 tokens.css） | — |
| 34 | L317 | `TOOLTIP_OFFSET = 12` | 提示框偏移 | **否**（应放 tokens.css） | — |

### WorkbenchSidebar.vue

| # | 位置 | 默认值 | 用途 | 可入 app_configs？ | 建议 key |
|---|------|--------|------|--------------------|----------|
| 35 | L164 | `width: 240px` | 侧边栏宽度 | **否**（应引用 CSS 变量 `--sidebar-width`，在 tokens.css 管理） | — |

### FeedbackWidget.vue

| # | 位置 | 默认值 | 用途 | 可入 app_configs？ | 建议 key |
|---|------|--------|------|--------------------|----------|
| 36 | ~L15 | `MAX_LENGTH = 1200` | 反馈内容最大字符（前端校验） | **是**（与后端 #20 统一源） | `feedback.max_content_length`（已有，需前后端同源） |
| 37 | ~L24 | `content.value.trim().length >= 6` | 反馈内容最小字符 | **是** | `feedback.min_content_length` |

### useChat.ts

| # | 位置 | 默认值 | 用途 | 可入 app_configs？ | 建议 key |
|---|------|--------|------|--------------------|----------|
| 38 | L2-3（通过 ai-chat.ts API） | 无显式默认值 | 会话列表最大 50 条（后端 `.limit(50)`） | **是** | `ai_chat.max_sessions` |

---

## 三、CSS 设计令牌（tokens.css）— 非 app_configs，应在 CSS 变量层管理

以下为硬编码像素/颜色值，**不适合入 app_configs**（属于 UI 设计系统），但应统一为 CSS 变量：

| # | 类别 | 举例 | 建议 |
|---|------|------|------|
| 39 | 宽度/高度 | `240px`、`420px`、`520px`、`480px`、`36px`、`32px`、`44px`、`24px` 等 | 已有的通过 `--sidebar-width` 等 token 引用；未定义的扩展 tokens.css |
| 40 | 字体大小 | `13px`、`12px`、`11px`、`10px` 散落在各组件 | 已有 `--text-xs`~`--text-4xl`，未使用的改用 token |
| 41 | 圆角 | `6px`、`8px`、`10px`、`12px`、`16px` 散落 | 已有 `--radius-sm`~`--radius-xl`，统一替换 |
| 42 | 阴影 | `0 10px 40px rgba(0,0,0,0.3)` 等 | 已有 `--shadow-sm`~`--shadow-xl`，统一替换 |
| 43 | 颜色（硬编码 hex） | `#4f7df9`、`#8b5cf6`、`#c084fc`、`#34c759`、`#fff`、`#ffffff` | FloatingChat 约 15 处，FeedbackWidget 约 6 处，WorkbenchHeaderActions 约 4 处，全部替换为 CSS 变量 |
| 44 | 动画时长 | `0.15s`、`0.2s`、`0.3s` 散落 | 已有 `--duration-fast`~`--duration-slow`，替换 |

---

## 四、汇总 — 应入 app_configs 的清单

按优先级排列：

| 优先级 | # | 类别 | 当前默认值 | 建议 key | 现状 |
|--------|---|------|-----------|----------|------|
| **P0** | 1 | AI temperature | `0.7` | `ai_chat.temperature` | **硬编码，需新增** |
| **P0** | 2 | AI max_tokens | `4096` | `ai_chat.max_tokens` | **硬编码，需新增** |
| **P0** | 7,13,19 | 全局限流（ai-chat / ai-config 测试 / feedback 共用） | `10 req/60s` | `rate_limit.max_requests` + `rate_limit.window_ms` | **三处硬编码，统一为一套** |
| **P0** | 12 | 全局 max_configs | `20` | `ai_config.max_configs_global` | **硬编码** |
| **P1** | 8 | 用户消息最大长度 | `4000` | `ai_chat.max_message_length` | **硬编码** |
| **P1** | 14 | 测试冷却时间 | `10s` | `ai_config.test_cooldown_seconds` | **硬编码** |
| **P1** | 36-37 | 反馈内容长度 | `1200/6` | `feedback.max_content_length` / `feedback.min_content_length` | **已有但前后端不同步** |
| **P2** | 22-23 | CORS 头+方法 | `authorization,...` | `cors.allow_headers` + `cors.allow_methods` | **硬编码** |
| **P2** | 38 | 最大会话列表数 | `50` | `ai_chat.max_sessions` | **硬编码** |

### 已有 app_configs 但靠 defaultValue 兜底的（无迁移时等于硬编码）

| 配置 key | defaultValue | 说明 |
|----------|-------------|------|
| `ai_chat.system_prompt` | 长文本 | 依赖迁移写入，无迁移时为兜底值 |
| `ai_chat.daily_limit` | `20` | 同上 |
| `ai_chat.context_limit` | `0` | 同上 |
| `ai.default_timeout_ms` | `45000` | 已补迁移 ✅ |
| `ai.default_base_url` | `https://api.deepseek.com/v1` | 无迁移写入 |
| `ai.default_model` | `deepseek-chat` | 无迁移写入 |
| `ai.default_api_key` | `''`（空） | 无迁移写入 |

**结论**：P0 的 4 项（temperature / max_tokens / AI 频率限制 / max_configs）完全没有配置入口，每次改都要改代码重新部署。其余项中，一部分虽已有 app_configs key（如 feedback 长度），但函数尚未接入读取逻辑，仍需改代码统一配置源。
