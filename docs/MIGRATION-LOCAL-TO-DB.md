# 本地缓存与本地转换迁移方案

> 目标：将 localStorage 缓存和客户端转换引擎迁移至数据库 + 后端 API，降低前端复杂度，实现跨设备同步。

## 一、总体策略

```
┌─────────────────────────────────────────────────────────┐
│                     变更前                               │
│                                                         │
│  localStorage (8处)  +  内存 Map (9处)  +  客户端转换引擎 │
│  rules/history/theme  lunar/AI/convert   9000+ 行 TS/JS │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                     变更后                               │
│                                                         │
│  保留 localStorage (3处 UI偏好)                          │
│  theme / sidebarCollapsed / fileEncoding                │
│                                                         │
│  数据库表 (5张新表)                                              │
│  user_rules / ziwei_history / convert_cache / ai_cache / logs  │
│                                                         │
│  后端 API (改造 Edge Function)                           │
│  单一转换引擎 + 规则管理 + 缓存 + 操作日志               │
│                                                         │
│  新增页面                                                │
│  /workbench/operation-logs（操作日志查询）               │
└─────────────────────────────────────────────────────────┘
```

---

## 二、保留 localStorage（3 处，统一 key 命名）

> 遵循 AI_DEV.md §15.2：key 命名统一为 `sqldev:<module>:<key>`。

| 旧 Key | 新 Key | 理由 |
|--------|--------|------|
| `theme` / `sqldev:theme` | `sqldev:app:theme` | 主题切换需即时响应，不能等网络 |
| `sqldev_last_view` | `sqldev:app:last_view` | 上次停留页，路由启动用 |
| `sidebarCollapsed` | `sqldev:app:sidebar_collapsed` | 纯 UI 状态，无需跨设备同步 |
| `fileEncoding` | `sqldev:editor:file_encoding` | 编辑器偏好，无安全风险 |

**读写规范**（§15.2）：
- `getItem` / `setItem` / `removeItem` 均包裹 `try-catch`
- 单个 key 内容不超过 100KB
- 存储格式变更必须有版本号或迁移逻辑

---

## 三、数据库设计（5 张新表）

### 3.1 用户规则表 `user_rules`

```sql
-- 202604300001_create_user_rules.sql
create table public.user_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  kind        int not null check (kind in (1, 2)),
  rules_json  jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.user_rules is 'SQL 转换规则，系统默认规则 user_id 为 NULL，用户自定义规则绑定 user_id';
comment on column public.user_rules.user_id is '所属用户 ID，NULL 表示系统默认规则（所有用户可读）';
comment on column public.user_rules.kind is '规则类型：1 = DDL 类型映射，2 = 程序块变换';
comment on column public.user_rules.rules_json is '规则 JSON 数组，每项含 source/target（DDL）或 s/t（Body）';

alter table public.user_rules enable row level security;

-- user_id + kind 唯一约束（仅对非 NULL user_id 生效）
create unique index idx_user_rules_user_kind
  on public.user_rules (user_id, kind)
  where user_id is not null;

-- 系统规则（user_id is null）和自己的规则，登录用户可读
create policy "user_rules_select" on public.user_rules
  for select to authenticated
  using (user_id is null or auth.uid() = user_id);

-- 只能写自己的规则
create policy "user_rules_insert" on public.user_rules
  for insert to authenticated
  with check (auth.uid() = user_id);
create policy "user_rules_update" on public.user_rules
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_rules_delete" on public.user_rules
  for delete to authenticated
  using (auth.uid() = user_id);

create trigger user_rules_set_updated_at
  before update on public.user_rules
  for each row execute function public.set_updated_at();
```

**迁移**：`ojw_ddlRules` + `ojw_bodyRules` → `user_rules`（kind=1 为 DDL，kind=2 为 Body）

### 3.2 紫微排盘历史表 `ziwei_history`

```sql
-- 202604300002_create_ziwei_history.sql
create table public.ziwei_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  input_json  jsonb not null,
  result_json jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.ziwei_history is '紫微斗数排盘历史记录，登录用户可查看自己最近 30 条';
comment on column public.ziwei_history.input_json is '排盘输入参数（出生日期、时辰、性别、流派等）';
comment on column public.ziwei_history.result_json is '排盘结果快照（命盘数据、星曜分布等），可为空表示仅保存输入';

alter table public.ziwei_history enable row level security;

create policy "ziwei_history_select_own" on public.ziwei_history
  for select to authenticated using (auth.uid() = user_id);
create policy "ziwei_history_insert_own" on public.ziwei_history
  for insert to authenticated with check (auth.uid() = user_id);
create policy "ziwei_history_delete_own" on public.ziwei_history
  for delete to authenticated using (auth.uid() = user_id);

create index idx_ziwei_history_user_time
  on public.ziwei_history (user_id, created_at desc);
```

**迁移**：`sqldev_ziwei_history_v1` → `ziwei_history`（上限从 30 条改为查询 `LIMIT 30`）

### 3.3 转换结果缓存表 `convert_cache`

```sql
-- 202604300003_create_convert_cache.sql
create table public.convert_cache (
  cache_key   text primary key,
  kind        text not null,
  from_db     text not null,
  to_db       text not null,
  input_hash  text not null,
  rules_ver   text not null,
  output_sql  text not null,
  created_at  timestamptz not null default now(),
  hit_count   int not null default 0
);

comment on table public.convert_cache is 'SQL 转换结果缓存，由 Edge Function 管理，service_role 读写，前端不可直连';
comment on column public.convert_cache.cache_key is '缓存键：kind|from_db|to_db|rules_ver|input_hash 拼接';
comment on column public.convert_cache.input_hash is '输入 SQL 的哈希值（SHA-256），用于去重';
comment on column public.convert_cache.rules_ver is '规则版本号，规则变更时旧缓存自动失效';
comment on column public.convert_cache.hit_count is '缓存命中次数，用于监控和清理低频缓存';

alter table public.convert_cache enable row level security;

-- 无策略 = 前端 anon/authenticated 不可访问，service_role 自动绕过 RLS
-- 仅 Edge Function 通过 service_role 读写

-- 7 天自动清理
create or replace function public.cleanup_convert_cache()
returns void language sql as $$
  delete from public.convert_cache
  where created_at < now() - interval '7 days';
$$;

-- 索引
create index idx_convert_cache_created
  on public.convert_cache (created_at);
```

**用途**：后端转换时先查缓存，命中则直接返回，避免重复计算。仅 Edge Function 通过 `service_role` 访问。

### 3.4 AI 解盘缓存表 `ziwei_ai_cache`

```sql
-- 202604300004_create_ziwei_ai_cache.sql
create table public.ziwei_ai_cache (
  signature   text primary key,
  result_json jsonb not null,
  created_at  timestamptz not null default now(),
  hit_count   int not null default 0
);

comment on table public.ziwei_ai_cache is '紫微 AI 解盘结果缓存，由 Edge Function 管理，service_role 读写，前端不可直连';
comment on column public.ziwei_ai_cache.signature is '命盘签名（基于星曜分布、四化、大限等关键数据生成的唯一哈希）';
comment on column public.ziwei_ai_cache.result_json is 'AI 解盘结果 JSON（含 overview、sections、yearFocus 等结构）';
comment on column public.ziwei_ai_cache.hit_count is '缓存命中次数，用于监控和清理低频缓存';

alter table public.ziwei_ai_cache enable row level security;

-- 无策略 = 前端 anon/authenticated 不可访问，service_role 自动绕过 RLS
-- 仅 Edge Function 通过 service_role 读写

create index idx_ziwei_ai_cache_created
  on public.ziwei_ai_cache (created_at);
```

**迁移**：`_ziweiAiCache` Map → `ziwei_ai_cache`（上限 12 改为 7 天 TTL 自动清理）

### 3.5 操作日志表 `operation_logs`

```sql
-- 202604300005_create_operation_logs.sql
create table public.operation_logs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid references auth.users(id) on delete set null,
  user_email      text,
  client_ip       text,
  operation       text not null,
  api_name        text,
  request_body    jsonb,
  response_body   jsonb,
  response_status int,
  duration_ms     int,
  error_message   text,
  extra           jsonb
);

comment on table public.operation_logs is '用户操作日志，记录所有关键操作和 API 调用，供管理员审计和用户自查';
comment on column public.operation_logs.user_id is '操作用户 ID，未登录时为空';
comment on column public.operation_logs.user_email is '操作用户邮箱快照，便于查询时直接展示（避免 join）';
comment on column public.operation_logs.client_ip is '客户端 IP 地址，从请求头 X-Forwarded-For 或 CF-Connecting-IP 提取';
comment on column public.operation_logs.operation is '操作类型，如 convert_ddl / convert_func / rule_save / feedback_submit / ziwei_ai_analysis 等';
comment on column public.operation_logs.api_name is 'Edge Function 名称，如 convert / rules / feedback / ziwei-analysis';
comment on column public.operation_logs.request_body is '上送报文（脱敏后），敏感字段（token/key/password）已移除';
comment on column public.operation_logs.response_body is '返回报文（脱敏后），大型响应截断至前 2000 字符';
comment on column public.operation_logs.response_status is 'HTTP 响应状态码，200/400/401/500 等';
comment on column public.operation_logs.duration_ms is '请求处理耗时（毫秒），从接收到返回';
comment on column public.operation_logs.error_message is '错误信息，成功时为空';
comment on column public.operation_logs.extra is '扩展字段，存储业务特定上下文（如 fromDb/toDb/kind/cached 等）';

alter table public.operation_logs enable row level security;

-- 管理员可查所有日志（通过邮箱白名单判断）
create policy "operation_logs_select_admin" on public.operation_logs
  for select to authenticated
  using (
    auth.email() in (
      select unnest(string_to_array(current_setting('app.admin_emails', true), ','))
    )
  );

-- 用户可查自己的操作日志
create policy "operation_logs_select_own" on public.operation_logs
  for select to authenticated
  using (auth.uid() = user_id);

-- 仅 service_role 可写入（Edge Function 记录日志）
-- 无 insert/update/delete 策略 = 前端不可写，service_role 自动绕过 RLS

-- 索引：按时间、用户、操作类型查询
create index idx_operation_logs_created_at
  on public.operation_logs (created_at desc);
create index idx_operation_logs_user_created
  on public.operation_logs (user_id, created_at desc);
create index idx_operation_logs_operation
  on public.operation_logs (operation, created_at desc);
create index idx_operation_logs_api_name
  on public.operation_logs (api_name, created_at desc);

-- 自动清理：保留 90 天
create or replace function public.cleanup_operation_logs()
returns void language sql as $$
  delete from public.operation_logs
  where created_at < now() - interval '90 days';
$$;
```

**写入时机**：每个 Edge Function 处理完成后，异步写入一条日志（不阻塞响应）。

**报文脱敏规则**：
- `request_body`：移除 `token`、`access_token`、`password`、`authorization` 等字段
- `response_body`：截断至 2000 字符，移除 `token`、`access_token` 等字段
- `client_ip`：保留原始值（IP 本身不是敏感信息，但需遵守当地隐私法规）

---

## 四、后端 API 改造

### 4.1 规则 CRUD（新增 Edge Function `rules`）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/functions/v1/rules` | 读取用户规则（kind=ddl\|body） |
| PUT | `/functions/v1/rules` | 保存用户规则 |
| DELETE | `/functions/v1/rules` | 重置为默认规则 |

### 4.2 转换 API 改造（改造 `convert`）

```
POST /functions/v1/convert
  请求: { kind, fromDb, toDb, input }
  响应: { output, warnings?, rulesVersion, cached: boolean }
```

改动点：

1. 先查 `convert_cache` 表，命中则 `hit_count+1` 并返回
2. 未命中则执行转换，写入缓存后返回
3. 移除客户端传 `rules` 的要求（改为服务端读 `user_rules`）
4. 规则变更时清理相关缓存

### 4.3 紫微历史 API（新增 Edge Function `ziwei-history`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/functions/v1/ziwei-history` | 获取最近 30 条 |
| POST | `/functions/v1/ziwei-history` | 新增一条 |
| DELETE | `/functions/v1/ziwei-history/:id` | 删除一条 |

### 4.4 AI 解盘 API 改造（改造 `ziwei-analysis`）

改动点：

1. 先查 `ziwei_ai_cache`，命中则返回
2. 未命中则调用 AI，写入缓存后返回
3. 移除客户端 `_ziweiAiCache` Map

### 4.5 操作日志 API（新增 Edge Function `operation-logs`）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/functions/v1/operation-logs` | 查询操作日志（支持分页、筛选） | 管理员查所有，用户查自己 |
| POST | `/functions/v1/operation-logs` | 写入操作日志（内部调用） | 仅 service_role |

**查询参数**（GET）：

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 页码，默认 1 |
| `page_size` | number | 每页条数，默认 20，最大 100 |
| `start_time` | string | 起始时间（ISO 8601） |
| `end_time` | string | 结束时间（ISO 8601） |
| `operation` | string | 操作类型筛选 |
| `user_email` | string | 用户邮箱模糊搜索 |
| `api_name` | string | API 名称筛选 |

**响应格式**：

```json
{
  "total": 150,
  "page": 1,
  "page_size": 20,
  "items": [
    {
      "id": "...",
      "created_at": "2026-04-30T12:00:00Z",
      "user_email": "user@example.com",
      "client_ip": "1.2.3.4",
      "operation": "convert_ddl",
      "api_name": "convert",
      "request_body": { "kind": "ddl", "fromDb": "oracle", "toDb": "mysql", "input": "CREATE TABLE..." },
      "response_body": { "output": "CREATE TABLE...", "cached": false },
      "response_status": 200,
      "duration_ms": 342,
      "error_message": null,
      "extra": { "fromDb": "oracle", "toDb": "mysql", "kind": "ddl", "cached": false }
    }
  ]
}
```

### 4.6 操作日志记录工具（`_shared/operation-logger.ts`）

在 `supabase/functions/_shared/` 新增日志记录工具，所有 Edge Function 统一调用：

```typescript
// supabase/functions/_shared/operation-logger.ts
export interface OperationLogEntry {
  userId?: string
  userEmail?: string
  clientIp: string
  operation: string
  apiName: string
  requestBody?: unknown
  responseBody?: unknown
  responseStatus: number
  durationMs: number
  errorMessage?: string
  extra?: Record<string, unknown>
}

export async function logOperation(
  supabaseAdmin: SupabaseClient,
  entry: OperationLogEntry
): Promise<void> {
  // 异步写入，不阻塞响应
  const sanitized = sanitizeLogEntry(entry)
  await supabaseAdmin.from('operation_logs').insert(sanitized)
}

function sanitizeLogEntry(entry: OperationLogEntry) {
  return {
    user_id: entry.userId || null,
    user_email: entry.userEmail || null,
    client_ip: entry.clientIp,
    operation: entry.operation,
    api_name: entry.apiName,
    request_body: removeSensitiveFields(entry.requestBody),
    response_body: truncateResponse(entry.responseBody),
    response_status: entry.responseStatus,
    duration_ms: entry.durationMs,
    error_message: entry.errorMessage || null,
    extra: entry.extra || null
  }
}

function removeSensitiveFields(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  const sensitiveKeys = ['token', 'access_token', 'password', 'authorization', 'api_key', 'secret']
  const cleaned = { ...body as Record<string, unknown> }
  for (const key of sensitiveKeys) delete cleaned[key]
  return cleaned
}

function truncateResponse(body: unknown): unknown {
  if (!body) return null
  const str = JSON.stringify(body)
  if (str.length <= 2000) return body
  // 找到安全的截断点（完整对象/数组边界）
  let safeLength = 1995
  while (safeLength > 0 && str[safeLength] !== '}' && str[safeLength] !== ']') {
    safeLength--
  }
  if (safeLength < 100) {
    // 无法找到安全截断点，返回摘要
    return { _truncated: true, _original_length: str.length, _preview: str.slice(0, 100) }
  }
  try {
    const truncated = JSON.parse(str.slice(0, safeLength + 1))
    truncated._truncated = true
    truncated._original_length = str.length
    return truncated
  } catch {
    return { _truncated: true, _original_length: str.length, _preview: str.slice(0, 100) }
  }
}
```

**调用示例**（在 `convert/index.ts` 中）：

```typescript
const startTime = Date.now()
// ... 处理转换逻辑 ...
const durationMs = Date.now() - startTime

await logOperation(supabaseAdmin, {
  userId: user?.id,
  userEmail: user?.email,
  clientIp: getClientIp(request),
  operation: `convert_${kind}`,
  apiName: 'convert',
  requestBody: { kind, fromDb, toDb, input },
  responseBody: { output, cached },
  responseStatus: 200,
  durationMs,
  extra: { fromDb, toDb, kind, cached, rulesVersion }
})
```

### 4.7 所有 Edge Function 接入日志

| Edge Function | 记录的 operation | 记录时机 |
|---------------|------------------|----------|
| `convert` | `convert_ddl` / `convert_func` / `convert_proc` | 每次转换完成 |
| `rules` | `rule_read` / `rule_save` / `rule_reset` | 规则 CRUD 操作 |
| `ziwei-history` | `ziwei_history_list` / `ziwei_history_create` / `ziwei_history_delete` | 历史操作 |
| `ziwei-analysis` | `ziwei_ai_analysis` / `ziwei_ai_qa` | AI 解盘/问答 |
| `feedback` | `feedback_submit` | 反馈提交 |

---

## 五、前端代码删减清单

### 5.1 删除的文件/模块

| 文件 | 行数 | 理由 |
|------|------|------|
| `src/features/ddl/*.ts`（10 个文件） | ~2400 | 转换逻辑移至后端 |
| `src/features/routines/*.ts`（7 个文件） | ~1400 | 转换逻辑移至后端 |
| `src/features/rules/body-transform.ts` | ~98 | 转换逻辑移至后端 |
| `src/features/ddl/facade.ts` | ~57 | 不再需要前端 facade |
| `src/features/ddl/legacy-bridge.ts` | ~166 | 不再需要桥接 |
| `src/features/routines/legacy-bridge.ts` | ~69 | 不再需要桥接 |
| `src/features/rules/legacy-bridge.ts` | ~37 | 不再需要桥接 |
| `src/features/convert/legacy-bridge.ts` | ~13 | 不再需要桥接 |
| `src/legacy/modules/sql-conversion-actions.js` | ~174 | 转换 action 移至后端 |
| **小计** | **~4414 行** | |

### 5.2 保留但需改造的文件

| 文件 | 改动 |
|------|------|
| `src/api/convert.ts` | 移除 `rules` 参数，改为后端自动读取用户规则 |
| `src/stores/app.ts` | 新增 `userRules` state + CRUD 方法 |
| `src/features/rules/persistence.ts` | localStorage → Supabase API |
| `src/legacy/app.js` | 移除 `_convertResultCache`、`_frontendRulesCache`、`_doPersist` 中的 localStorage 写入 |
| `src/legacy/feedback.js` | `sqldev_feedback_queue` localStorage → 已有后端 API |
| `src/composables/useThemeRuntime.ts` | 统一 key 为 `sqldev:theme` |

### 5.3 保留不动的模块

| 模块 | 理由 |
|------|------|
| `src/features/sql/sql-format.ts` | 纯文本格式化，无网络依赖 |
| `src/features/id-tools/*.ts` | 身份证/信用代码工具，与 SQL 无关 |
| `src/features/shared/database.ts` | 10 行类型定义 |
| `src/features/navigation/*.ts` | 路由逻辑 |
| `src/features/browser/*.ts` | 文件上传逻辑 |
| `src/legacy/samples.js` | 示例数据，前端展示用 |

---

## 六、操作日志查询页面

### 页面路径

`/workbench/operation-logs`（需登录，管理员可查所有，普通用户只能查自己）

### 路由配置

```typescript
// src/router/index.ts 新增
{
  path: '/workbench/operation-logs',
  name: 'operation-logs',
  component: () => import('@/pages/workbench/operation-logs.vue'),
  meta: { requiresAuth: true }
}
```

### 页面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  操作日志                                                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ │
│  │ 时间范围  │ │ 操作类型  │ │ 用户邮箱  │ │ API 名称 │ │ 查询  │ │
│  │ 开始~结束 │ │ 下拉选择  │ │ 输入搜索  │ │ 下拉选择 │ │       │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 时间 │ 用户 │ IP │ 操作 │ API │ 状态 │ 耗时 │ 详情        ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ 12:00 │ user@… │ 1.2.3.4 │ convert_ddl │ convert │ 200 │ 342ms ││
│  │ 12:01 │ user@… │ 1.2.3.4 │ rule_save   │ rules   │ 200 │  89ms ││
│  │ ...   │        │         │             │         │     │       ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  « 1 2 3 ... 10 »                    共 150 条  每页 20 条  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 筛选条件

| 筛选项 | 组件 | 说明 |
|--------|------|------|
| 时间范围 | DatePicker（开始~结束） | 默认最近 7 天 |
| 操作类型 | Select（多选） | convert_ddl / convert_func / convert_proc / rule_save / feedback_submit / ziwei_ai_analysis 等 |
| 用户邮箱 | Input（模糊搜索） | 仅管理员可见，普通用户只能看自己 |
| API 名称 | Select | convert / rules / feedback / ziwei-analysis / ziwei-history |

### 详情弹窗

点击表格行展开详情，显示：

- **基本信息**：时间、用户、IP、操作类型、API 名称、状态码、耗时
- **上送报文**：JSON 格式化展示（语法高亮），敏感字段已脱敏
- **返回报文**：JSON 格式化展示（语法高亮），大型响应截断提示
- **错误信息**：如有错误，红色高亮显示
- **扩展字段**：extra JSON 展示

### 组件拆分

| 组件 | 路径 | 职责 |
|------|------|------|
| `OperationLogsPage` | `src/pages/workbench/operation-logs.vue` | 页面容器，组合筛选+表格+详情 |
| `OperationLogFilters` | `src/components/business/operation-logs/OperationLogFilters.vue` | 筛选表单 |
| `OperationLogTable` | `src/components/business/operation-logs/OperationLogTable.vue` | 日志列表表格 |
| `OperationLogDetail` | `src/components/business/operation-logs/OperationLogDetail.vue` | 详情弹窗/抽屉 |

### API 封装

```typescript
// src/api/operation-logs.ts
export interface OperationLogFilters {
  startTime?: string
  endTime?: string
  operation?: string
  userEmail?: string
  apiName?: string
  page?: number
  pageSize?: number
}

export interface OperationLog {
  id: string
  created_at: string
  user_email: string | null
  client_ip: string | null
  operation: string
  api_name: string | null
  request_body: Record<string, unknown> | null
  response_body: Record<string, unknown> | null
  response_status: number | null
  duration_ms: number | null
  error_message: string | null
  extra: Record<string, unknown> | null
}

export interface OperationLogResponse {
  total: number
  page: number
  page_size: number
  items: OperationLog[]
}

export async function fetchOperationLogs(
  filters: OperationLogFilters
): Promise<OperationLogResponse> {
  // 调用 /functions/v1/operation-logs GET
}

export async function fetchOperationLogById(
  id: string
): Promise<OperationLog> {
  // 调用 /functions/v1/operation-logs/:id GET
}
```

### 权限控制

| 角色 | 查看范围 | 筛选用户 |
|------|----------|----------|
| 管理员 | 所有用户的操作日志 | 可按任意用户筛选 |
| 普通用户 | 仅自己的操作日志 | 隐藏用户筛选框 |

管理员判断：后端通过 `app.admin_emails` 配置或数据库白名单表判断。

---

## 七、农历缓存处理

`_zwSolarToLunarCache` 等 4 个 Map 是**纯计算缓存**（公历↔农历转换），有以下选择：

| 方案 | 优劣 |
|------|------|
| A. 保留前端计算 + 内存缓存 | 零延迟，无网络依赖，但紫微功能代码量大 |
| B. 移至后端 API | 前端精简，但每次排盘需网络请求 |
| C. 前端计算 + 去掉缓存 | 简单，农历计算本身很快（<1ms） |

**建议方案 C**：农历转换算法本身极快，去掉 Map 缓存即可，无需后端。

---

## 八、实施步骤（7 个阶段）

> **状态：全部完成** ✅
>
> | 阶段 | 状态 | 完成日期 |
> |------|------|----------|
> | 阶段 1：数据库 | ✅ 完成 | 2026-04-30 |
> | 阶段 2：后端 API | ✅ 完成 | 2026-04-30 |
> | 阶段 3：前端 Store + API 层 | ✅ 完成 | 2026-04-30 |
> | 阶段 4：前端数据迁移 | ✅ 完成 | 2026-04-30 |
> | 阶段 5：前端清理 | ✅ 完成 | 2026-05-03 |
> | 阶段 6：操作日志页面 | ✅ 完成 | 2026-04-30 |
> | 阶段 7：localStorage key 统一 | ✅ 完成 | 2026-04-30 |

### 阶段 1：数据库

- 创建 5 张表（user_rules / ziwei_history / convert_cache / ziwei_ai_cache / operation_logs）
- 配置 RLS 策略
- 创建索引和清理函数

### 阶段 2：后端 API

- 改造 `convert` Edge Function（加入缓存逻辑 + 操作日志）
- 新增 `rules` Edge Function（规则 CRUD + 操作日志）
- 新增 `ziwei-history` Edge Function（+ 操作日志）
- 改造 `ziwei-analysis` Edge Function（加入缓存逻辑 + 操作日志）
- 新增 `operation-logs` Edge Function（查询日志）
- 新增 `_shared/operation-logger.ts`（日志记录工具）

### 阶段 3：前端 Store

- 新增 Pinia store 方法（userRules / ziweiHistory）
- 新增 API 层（src/api/rules.ts / src/api/ziwei-history.ts / src/api/operation-logs.ts）
- 更新 `src/api/convert.ts`（移除 rules 参数）

### 阶段 4：前端迁移

- `src/features/rules/persistence.ts`：localStorage → Supabase API
- `src/legacy/app.js`：移除 localStorage 读写（rules / history / feedback queue）
- `src/legacy/feedback.js`：队列 → 直接调用后端 API

### 阶段 5：前端清理

- 删除客户端转换引擎（~4414 行）
- 移除内存缓存 Map（`_convertResultCache`、`_frontendRulesCache`、`_ziweiAiCache`）
- 移除农历缓存 Map（4 个）

### 阶段 6：操作日志页面

- 新增 `src/pages/workbench/operation-logs.vue`
- 新增 3 个组件（Filters / Table / Detail）
- 新增路由配置
- 新增 API 封装（src/api/operation-logs.ts）

### 阶段 7：统一 localStorage key 命名

按 `sqldev:<module>:<key>` 格式迁移所有保留的 localStorage key：

| 旧 Key | 新 Key |
|--------|--------|
| `theme` | `sqldev:app:theme` |
| `sqldev:theme` | `sqldev:app:theme` |
| `sqldev_last_view` | `sqldev:app:last_view` |
| `sidebarCollapsed` | `sqldev:app:sidebar_collapsed` |
| `fileEncoding` | `sqldev:editor:file_encoding` |

迁移逻辑：读取时先查新 key，不存在则读旧 key 并写入新 key，删除旧 key。写入时只写新 key。

---

## 九、风险与回退

| 风险 | 应对 |
|------|------|
| 后端转换延迟增加 | `convert_cache` 表兜底，命中率预计 >80% |
| 未登录用户无法用转换 | 未登录走匿名转换（不限制），登录后才读写规则 |
| 数据库迁移失败 | 每张表独立 migration，可单独回滚 |
| 前端删减导致回归 | 先加开关 `FEATURE_BACKEND_ONLY=true`，灰度切换 |

---

## 十、补充：数据库层细节（§7 对照）

### 10.1 database.types.ts 重新生成

每次 migration 执行后必须重新生成类型定义：

```powershell
supabase gen types typescript --local > src/types/database.types.ts
pnpm typecheck
```

禁止手动修改 `database.types.ts`。

### 10.2 cleanup 函数定时执行

`cleanup_convert_cache()` / `cleanup_operation_logs()` 仅定义了函数，需要定时触发。两种方案：

| 方案 | 实现 | 优劣 |
|------|------|------|
| A. pg_cron 扩展 | `select cron.schedule('cleanup-caches', '0 3 * * *', 'select public.cleanup_convert_cache(); select public.cleanup_operation_logs();')` | 零额外代码，但仅 Supabase Pro+ 计划可用 |
| B. Supabase Scheduled Functions | 新增 `cleanup` Edge Function，通过 `config.toml` cron 配置定时触发 | 免费计划可用，平台内置，推荐 |

**推荐方案 B**：Supabase 免费计划支持 Scheduled Functions，无需外部依赖。

```toml
# supabase/config.toml
[functions.cleanup]
verify_jwt = false

[functions.cleanup.cron]
schedule = "0 3 * * *"  # 每天凌晨 3 点（UTC+8 为 11 点）
```

```typescript
// supabase/functions/cleanup/index.ts
import { createServiceRoleClient } from '../_shared/supabase.ts'

Deno.serve(async () => {
  const supabase = createServiceRoleClient()

  const results = await Promise.allSettled([
    supabase.rpc('cleanup_convert_cache'),
    supabase.rpc('cleanup_convert_verify_results'),
    supabase.rpc('cleanup_operation_logs')
  ])

  const summary = results.map((r, i) => ({
    task: ['convert_cache', 'verify_results', 'operation_logs'][i],
    status: r.status
  }))

  return new Response(JSON.stringify({ ok: true, tasks: summary }))
})
```

### 10.3 admin_emails 配置

`operation_logs` 的管理员 RLS 策略依赖 `app.admin_emails`，需在 Supabase Dashboard → Database → Settings 中设置：

```sql
-- 在 Supabase Dashboard 的 Database Settings 中设置
-- 或通过 migration 设置默认值
ALTER DATABASE postgres SET app.admin_emails = 'admin@example.com';
```

**替代方案**：创建 `admin_users` 表，RLS 策略改为 `EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email())`。

```sql
-- 替代方案：admin_users 表
CREATE TABLE public.admin_users (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.admin_users IS '管理员邮箱白名单，仅 service_role 可写';

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- 无策略 = 前端不可访问，service_role 自动绕过

-- operation_logs 管理员策略改为
CREATE POLICY "operation_logs_select_admin" ON public.operation_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));
```

---

## 十一、补充：Edge Function 层细节（§9 对照）

### 11.1 config.toml 配置

新增的 Edge Function 需要在 `supabase/config.toml` 中配置：

```toml
[functions.rules]
verify_jwt = true

[functions.ziwei-history]
verify_jwt = true

[functions.operation-logs]
verify_jwt = true

[functions.cleanup]
verify_jwt = false  # Supabase Scheduled Functions 调用，无需 JWT
```

### 11.2 CORS 复用策略

所有新增函数复用现有 CORS 策略（`_shared/cors.ts`），不单独配置：

```typescript
import { handleCors } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  // ... 业务逻辑
})
```

### 11.3 请求体校验

所有 Edge Function 必须校验请求体（§9.2）：

| 校验项 | 规则 | 适用函数 |
|--------|------|----------|
| Content-Type | 必须 `application/json` | 所有 POST/PUT |
| 请求体大小 | ≤ 100KB | convert / rules |
| 字段类型 | kind 必须是 ddl/func/proc，fromDb/toDb 必须是 oracle/mysql/postgresql | convert |
| SQL 输入长度 | ≤ 50000 字符 | convert |
| rules_json 大小 | ≤ 50KB | rules |
| operation_logs 写入 | request_body/response_body 各 ≤ 50KB | operation-logs |

```typescript
function validateConvertBody(body: unknown): { ok: boolean; error?: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' }
  const { kind, fromDb, toDb, input } = body as Record<string, unknown>
  const validDbs = ['oracle', 'mysql', 'postgresql']
  const validKinds = ['ddl', 'func', 'proc']
  if (!validKinds.includes(kind as string)) return { ok: false, error: 'invalid_kind' }
  if (!validDbs.includes(fromDb as string)) return { ok: false, error: 'invalid_from_db' }
  if (!validDbs.includes(toDb as string)) return { ok: false, error: 'invalid_to_db' }
  if (typeof input !== 'string' || input.length > 50000) return { ok: false, error: 'invalid_input' }
  return { ok: true }
}
```

### 11.4 限流策略

| Edge Function | 限流 | 说明 |
|---------------|------|------|
| `convert` | 已有（复用现有） | — |
| `rules` | 10 次/分钟/用户 | 防止频繁刷写 |
| `ziwei-history` | 30 次/分钟/用户 | 正常使用不限 |
| `ziwei-analysis` | 已有（复用现有） | — |
| `operation-logs` | 100 次/分钟/用户 | 查询操作，限流宽松 |
| `feedback` | 已有（复用现有） | — |

### 11.5 统一错误响应结构

所有 Edge Function 使用统一错误格式（§9.2、§11.1）：

```typescript
interface ErrorResponse {
  ok: false
  error: string        // snake_case 错误码，如 'invalid_body' / 'rate_limited'
  message: string      // 用户可读的中文提示
  status: number       // HTTP 状态码
}

function errorResponse(error: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ ok: false, error, message, status }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}
```

**错误码与中文映射**（需加入 `src/utils/error-map.ts`）：

| 错误码 | HTTP | 中文提示 |
|--------|------|----------|
| `invalid_body` | 400 | 请求格式不正确，请检查参数 |
| `invalid_kind` | 400 | 不支持的转换类型 |
| `invalid_from_db` / `invalid_to_db` | 400 | 不支持的数据库类型 |
| `invalid_input` | 400 | 输入内容过长或为空 |
| `unauthorized` | 401 | 请先登录 |
| `forbidden` | 403 | 无权限执行此操作 |
| `rate_limited` | 429 | 请求过于频繁，请稍后重试 |
| `rule_save_failed` | 500 | 规则保存失败，请重试 |
| `history_create_failed` | 500 | 历史记录保存失败 |
| `convert_failed` | 500 | SQL 转换失败，请检查输入 |
| `ai_analysis_failed` | 500 | AI 解盘失败，请稍后重试 |

---

## 十二、补充：错误处理层（§11 对照）

### 12.1 API 返回 Result 类型

所有新增 API 封装使用 Result 模式：

```typescript
// src/api/rules.ts
import type { Result } from '@/types/result'

export async function fetchUserRules(kind: 'ddl' | 'body'): Promise<Result<UserRules, string>> {
  try {
    const data = await invokeEdgeFunction('rules', { kind })
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: mapErrorCodeToMessage('rule_read_failed') }
  }
}
```

### 12.2 error-map.ts 更新

新增以下错误码映射：

```typescript
// src/utils/error-map.ts 新增
rule_read_failed: '读取规则失败，请刷新页面重试',
rule_save_failed: '规则保存失败，请检查网络后重试',
rule_reset_failed: '规则重置失败，请重试',
history_read_failed: '读取历史记录失败，请刷新页面重试',
history_create_failed: '历史记录保存失败，请重试',
history_delete_failed: '删除历史记录失败，请重试',
log_read_failed: '读取操作日志失败，请刷新页面重试',
```

---

## 十三、补充：测试层（§12 对照）

### 13.1 新增测试文件

| 测试文件 | 测试对象 | 说明 |
|----------|----------|------|
| `tests/unit/api-operation-logs.test.ts` | `src/api/operation-logs.ts` | 参数校验、分页、权限 |
| `tests/unit/api-rules.test.ts` | `src/api/rules.ts` | CRUD 操作、错误处理 |
| `tests/unit/operation-logger.test.ts` | `_shared/operation-logger.ts` | 脱敏逻辑、截断逻辑 |

### 13.2 smoke.mjs 更新

```javascript
// tests/smoke.mjs 新增断言
assert.ok(
  fs.existsSync('src/pages/workbench/operation-logs.vue'),
  'operation-logs page must exist'
)
assert.ok(
  fs.existsSync('src/api/operation-logs.ts'),
  'operation-logs API must exist'
)
assert.ok(
  fs.existsSync('supabase/functions/_shared/operation-logger.ts'),
  'operation-logger shared module must exist'
)
```

### 13.3 package.json scripts 更新

```json
{
  "scripts": {
    "test:operation-logs": "node tests/unit/api-operation-logs.test.ts",
    "test:rules-api": "node tests/unit/api-rules.test.ts"
  }
}
```

---

## 十四、补充：安全层（§22 对照）

### 14.1 JWT 校验策略

| Edge Function | verify_jwt | 鉴权方式 |
|---------------|------------|----------|
| `convert` | 复用现有 | Bearer token 校验 |
| `rules` | `true` | Supabase 自动校验 JWT |
| `ziwei-history` | `true` | Supabase 自动校验 JWT |
| `ziwei-analysis` | 复用现有 | Bearer token + 白名单 |
| `operation-logs` | `true` | Supabase 自动校验 JWT，再判断管理员/普通用户 |
| `cleanup` | `false` | Supabase Scheduled Functions 调用，无需 JWT |

### 14.2 请求体大小限制

```typescript
const MAX_BODY_SIZE = 100 * 1024  // 100KB
const contentLength = parseInt(req.headers.get('content-length') || '0', 10)
if (contentLength > MAX_BODY_SIZE) {
  return errorResponse('payload_too_large', '请求体过大', 413)
}
```

### 14.3 operation_logs 写入鉴权

POST 写入必须校验调用方是 service_role：

```typescript
// operation-logs 的 POST 接口
const authHeader = req.headers.get('authorization') || ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
if (authHeader !== `Bearer ${serviceRoleKey}`) {
  return errorResponse('forbidden', '仅服务端可写入操作日志', 403)
}
```

### 14.4 user_id 清理策略

`operation_logs.user_id` 使用 `ON DELETE SET NULL`，理由：

- 日志是审计记录，不应随用户删除而消失
- 用户注销后日志保留，`user_id` 置空，`user_email` 快照仍可查
- 符合审计日志的通用实践

如需彻底清除用户数据（GDPR），可额外执行：

```sql
DELETE FROM public.operation_logs WHERE user_id = '<deleted-user-id>';
```

---

## 十五、补充：数据迁移策略

### 15.1 localStorage → 数据库迁移

现有 localStorage 中的规则/历史数据需要迁移到数据库。采用**懒迁移**策略：

```typescript
// src/features/rules/persistence.ts
async function migrateLocalStorageToDb(kind: 'ddl' | 'body'): Promise<void> {
  const storageKey = kind === 'ddl' ? 'ojw_ddlRules' : 'ojw_bodyRules'
  const localData = localStorage.getItem(storageKey)
  if (!localData) return

  try {
    const rulesJson = JSON.parse(localData)
    await saveUserRules(kind, rulesJson)
    localStorage.removeItem(storageKey)
  } catch {
    // 迁移失败不阻塞，下次再试
  }
}
```

**触发时机**：用户登录后首次访问规则页面时自动迁移。

### 15.2 sqldev_feedback_queue 处理

队列中可能有未发送的反馈：

```typescript
// src/legacy/feedback.js 迁移逻辑
async function flushFeedbackQueue(): Promise<void> {
  const queue = JSON.parse(localStorage.getItem('sqldev_feedback_queue') || '[]')
  for (const item of queue) {
    try {
      await submitFeedback(item)
    } catch {
      // 单条失败不影响其他
    }
  }
  localStorage.removeItem('sqldev_feedback_queue')
}
```

**触发时机**：用户登录后自动 flush。

### 15.3 紫微历史迁移

```typescript
async function migrateZiweiHistory(): Promise<void> {
  const localData = localStorage.getItem('sqldev_ziwei_history_v1')
  if (!localData) return

  try {
    const history = JSON.parse(localData)
    for (const item of history) {
      await createZiweiHistory(item)
    }
    localStorage.removeItem('sqldev_ziwei_history_v1')
  } catch {
    // 迁移失败不阻塞
  }
}
```

---

## 十六、补充：Feature Flag 方案

### 16.1 实现方式

使用环境变量控制灰度切换：

```env
# .env.example
VITE_FEATURE_BACKEND_ONLY=false
```

```typescript
// src/features/shared/feature-flags.ts
export function isBackendOnlyEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_BACKEND_ONLY === 'true'
}
```

### 16.2 使用方式

```typescript
// src/legacy/modules/sql-conversion-actions.js
if (isBackendOnlyEnabled()) {
  // 调用后端 API
  const result = await requestConvert({ sourceDialect, targetDialect, sql, kind })
} else {
  // 走本地转换引擎（过渡期）
  const result = convertDDL(sql, sourceDialect, targetDialect)
}
```

### 16.3 灰度计划

| 阶段 | VITE_FEATURE_BACKEND_ONLY | 说明 |
|------|---------------------------|------|
| 开发测试 | `false` | 默认走本地 |
| 内部灰度 | `true` | 内部用户走后端 |
| 全量发布 | `true` | 所有用户走后端 |
| 清理代码 | 删除 flag | 删除本地转换引擎 |

---

## 十七、补充：operation 枚举值清单

所有操作类型集中定义：

```typescript
// src/types/operation-log.ts
export const OPERATION_TYPES = {
  // SQL 转换
  CONVERT_DDL: 'convert_ddl',
  CONVERT_FUNC: 'convert_func',
  CONVERT_PROC: 'convert_proc',
  // 规则管理
  RULE_READ: 'rule_read',
  RULE_SAVE: 'rule_save',
  RULE_RESET: 'rule_reset',
  // 紫微历史
  ZIWEI_HISTORY_LIST: 'ziwei_history_list',
  ZIWEI_HISTORY_CREATE: 'ziwei_history_create',
  ZIWEI_HISTORY_DELETE: 'ziwei_history_delete',
  // AI 解盘
  ZIWEI_AI_ANALYSIS: 'ziwei_ai_analysis',
  ZIWEI_AI_QA: 'ziwei_ai_qa',
  // 反馈
  FEEDBACK_SUBMIT: 'feedback_submit'
} as const

export type OperationType = (typeof OPERATION_TYPES)[keyof typeof OPERATION_TYPES]
```

---

## 十八、补充：监控与告警

### 18.1 监控指标

| 指标 | 来源 | 告警阈值 |
|------|------|----------|
| 转换缓存命中率 | `convert_cache.hit_count` | < 50% 需关注 |
| API 错误率 | `operation_logs.response_status >= 400` | > 5% 需告警 |
| API 平均耗时 | `operation_logs.duration_ms` | > 5000ms 需告警 |
| 日志写入量 | `operation_logs` 每日新增 | > 10000 条/天需扩容 |
| AI 缓存命中率 | `ziwei_ai_cache.hit_count` | < 30% 需关注 |

### 18.2 监控查询

```sql
-- 每日 API 调用量和错误率
SELECT
  date_trunc('day', created_at) AS day,
  count(*) AS total,
  count(*) FILTER (WHERE response_status >= 400) AS errors,
  round(avg(duration_ms)) AS avg_ms
FROM public.operation_logs
WHERE created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 1 DESC;

-- 缓存命中率
SELECT
  kind,
  count(*) AS entries,
  sum(hit_count) AS total_hits,
  round(sum(hit_count)::numeric / greatest(count(*), 1), 2) AS avg_hits_per_entry
FROM public.convert_cache
GROUP BY kind;
```

---

## 十九、补充：任务验收清单（§23 对照）

每个阶段完成后必须确认：

### 阶段 1 验收（数据库）

- [ ] 5 张表创建成功，`COMMENT ON` 完整
- [ ] RLS 策略生效（anon/authenticated 无法直接访问 convert_cache / ai_cache）
- [ ] `supabase gen types typescript --local > src/types/database.types.ts` 执行成功
- [ ] `pnpm typecheck` 通过

### 阶段 2 验收（后端 API）

- [ ] 6 个 Edge Function 本地测试通过
- [ ] `config.toml` 配置正确（verify_jwt 设置）
- [ ] CORS 验证通过（真实登录态 2xx / 4xx）
- [ ] 请求体校验生效（超大请求返回 400）
- [ ] 限流生效（超限返回 429）
- [ ] 操作日志写入成功（查询 operation_logs 表有记录）
- [ ] 错误响应脱敏（不暴露 stack trace）
- [ ] 需要更新 `FUNCTION-AUTH-STRATEGY.md`

### 阶段 3 验收（前端 Store）

- [ ] API 封装函数类型正确（Result 模式）
- [ ] error-map.ts 包含所有新错误码
- [ ] `pnpm typecheck` + `pnpm lint` 通过

### 阶段 4 验收（前端迁移）

- [ ] 懒迁移逻辑正常（登录后自动迁移 localStorage 数据）
- [ ] feedback_queue flush 正常
- [ ] 旧 localStorage key 已清理
- [ ] 现有页面功能不受影响

### 阶段 5 验收（前端清理）

- [ ] 删除的文件不被其他模块引用（`pnpm typecheck` 通过）
- [ ] legacy.html 中对应的 bridge `<script>` 标签已移除
- [ ] smoke 测试更新并通过
- [ ] `pnpm build` 通过

### 阶段 6 验收（操作日志页面）

- [ ] 页面正常加载，筛选功能正常
- [ ] 管理员可查所有日志，普通用户只能查自己
- [ ] 详情弹窗 JSON 格式化展示正常
- [ ] 分页正常，空状态展示正常
- [ ] `pnpm typecheck` + `pnpm lint` 通过

### 阶段 7 验收（localStorage key 迁移）

- [ ] 新旧 key 迁移逻辑正常（读新→读旧→写新→删旧）
- [ ] 主题切换、侧栏折叠、编码偏好功能正常

### 全局验收

- [ ] 更新 `docs/CONTEXT_FULL.md`
- [ ] `pnpm verify` 全部通过
- [ ] `pnpm build` 成功
- [ ] Edge Function 部署清单确认

---

## 二十、补充：Edge Function 部署清单

| 顺序 | 函数 | 操作 | 依赖 |
|------|------|------|------|
| 1 | `_shared/operation-logger.ts` | 新增 | — |
| 2 | `rules` | 新增 | operation-logger |
| 3 | `ziwei-history` | 新增 | operation-logger |
| 4 | `operation-logs` | 新增 | — |
| 5 | `cleanup` | 新增 | — |
| 6 | `convert` | 改造 | operation-logger |
| 7 | `ziwei-analysis` | 改造 | operation-logger |
| 8 | `feedback` | 改造 | operation-logger |

```powershell
# 按顺序部署
supabase functions deploy rules
supabase functions deploy ziwei-history
supabase functions deploy operation-logs
supabase functions deploy cleanup
supabase functions deploy convert
supabase functions deploy ziwei-analysis
supabase functions deploy feedback
```

---

## 二十一、补充：Supabase Secrets 清单

| Secret | 用途 | 是否新增 |
|--------|------|----------|
| `CORS_PRIMARY_ORIGIN` | CORS 来源 | 已有 |
| `CORS_ALLOWED_ORIGINS` | 额外允许来源 | 已有 |
| `ALLOW_LOCALHOST_ORIGIN` | 本地开发 CORS | 已有 |
| `CONVERT_RATE_LIMIT_MAX_REQUESTS` | convert 限流 | 已有 |
| `CONVERT_RATE_LIMIT_WINDOW_MS` | convert 限流窗口 | 已有 |
| `RULES_RATE_LIMIT_MAX_REQUESTS` | rules 限流 | **新增** |
| `HISTORY_RATE_LIMIT_MAX_REQUESTS` | ziwei-history 限流 | **新增** |

---

## 二十二、补充：回滚步骤

### 数据库回滚

```powershell
# 回滚单张表（按相反顺序）
supabase migration down  # 如果使用 supabase migration

# 手动回滚
psql -c "DROP TABLE IF EXISTS public.operation_logs CASCADE;"
psql -c "DROP TABLE IF EXISTS public.ziwei_ai_cache CASCADE;"
psql -c "DROP TABLE IF EXISTS public.convert_cache CASCADE;"
psql -c "DROP TABLE IF EXISTS public.ziwei_history CASCADE;"
psql -c "DROP TABLE IF EXISTS public.user_rules CASCADE;"
psql -c "DROP FUNCTION IF EXISTS public.cleanup_convert_cache();"
psql -c "DROP FUNCTION IF EXISTS public.cleanup_operation_logs();"
```

### Edge Function 回滚

```powershell
# 回滚到改造前版本
git revert <改造commit-hash>
supabase functions deploy convert
supabase functions deploy ziwei-analysis
```

### 前端回滚

```powershell
# 设置 feature flag 关闭后端模式
# .env.local
VITE_FEATURE_BACKEND_ONLY=false

# 或回滚代码
git revert <前端改造commit-hash>
```

### localStorage 回滚

懒迁移的 localStorage key 在迁移成功后才删除，回滚时数据仍在数据库中，前端会重新从数据库读取。

---

## 二十三、本地缓存完整清单（变更前）

### localStorage（8 处）

| Key（旧） | Key（新） | 位置 | 用途 | 迁移动作 |
|-----------|-----------|------|------|----------|
| `theme` / `sqldev:theme` | `sqldev:app:theme` | `preferences-runtime.js`, `app.js`, `useThemeRuntime.ts` | 主题偏好 | **保留，统一 key** |
| `sqldev_last_view` | `sqldev:app:last_view` | `preferences-runtime.js:42` | 上次停留页 | **保留** |
| `sidebarCollapsed` | `sqldev:app:sidebar_collapsed` | `app.js:3214` | 侧栏折叠状态 | **保留** |
| `fileEncoding` | `sqldev:editor:file_encoding` | `app.js:7465` | 文件编码偏好 | **保留** |
| `ojw_ddlRules` | — | `app.js:1626` | 用户自定义 DDL 映射规则 | **→ user_rules 表** |
| `ojw_bodyRules` | — | `app.js:1627` | 用户自定义程序块规则 | **→ user_rules 表** |
| `sqldev_feedback_queue` | — | `feedback.js:149` | 失败反馈队列 | **→ 直接调用后端 API** |
| `sqldev_ziwei_history_v1` | — | `app.js:5809` | 紫微排盘历史 | **→ ziwei_history 表** |

### 内存缓存 Map/Object（9 处）

| 变量 | 位置 | 用途 | 上限 | 清理策略 | 迁移动作 |
|------|------|------|------|----------|----------|
| `_ziweiAiCache` | `app.js:3618` | AI 解盘结果 | 12 | FIFO | **→ ziwei_ai_cache 表** |
| `analysisCache` | `ziwei-ai-requests.js:37` | AI 解盘结果（模块实例） | 12 | FIFO | **→ ziwei_ai_cache 表** |
| `_zwSolarToLunarCache` | `app.js:3678` | 公历→农历转换 | 无界 | 无 | **删除缓存，保留计算** |
| `_zwLunarToSolarCache` | `app.js:3679` | 农历→公历转换 | 无界 | 无 | **删除缓存，保留计算** |
| `_zwLeapMonthCache` | `app.js:3680` | 闰月查询 | 无界 | 无 | **删除缓存，保留计算** |
| `_zwLunarMonthDaysCache` | `app.js:3681` | 农历月天数 | 无界 | 无 | **删除缓存，保留计算** |
| `_frontendRulesCache` | `app.js:7445` | 规则序列化缓存 | 1 | 规则变更时重建 | **删除（后端处理）** |
| `_convertResultCache` | `app.js:7446` | SQL 转换结果缓存 | 24 | FIFO + 规则变更时 clear | **→ convert_cache 表** |
| HTTP `force-cache` | `app.js:4331` | 行政区划数据 | 浏览器默认 | 浏览器管理 | **保留** |

---

## 二十四、本地转换完整清单（变更前）

### 转换域

| 域 | 代码量 | 关键模块 | 运行位置 | 迁移动作 |
|----|--------|----------|----------|----------|
| DDL 转换（CREATE TABLE/VIEW） | ~2400 行 | `features/ddl/*.ts` | 纯客户端 | **删除，后端处理** |
| 函数/存储过程转换 | ~1400 行 | `features/routines/*.ts` | 纯客户端 | **删除，后端处理** |
| Body 变换规则（40+ handler） | ~900 行 | `rules.js` body 部分 | 客户端 + 服务端 | **仅保留服务端** |
| 类型映射（~195 条规则） | ~220 行 | `rules.js` DDL 部分 + `type-mapping.ts` | 客户端 + 服务端 | **仅保留服务端** |
| Legacy 引擎（app.js 内置） | ~2500 行 | `app.js` | 客户端 + 服务端 | **仅保留服务端** |
| 示例数据 | ~1066 行 | `samples.js` | 客户端 | **保留** |
| SQL 格式化 | ~101 行 | `sql-format.ts` | 纯客户端 | **保留** |
| 身份工具（身份证/统一信用代码） | ~263 行 | `id-tools/` | 纯客户端 | **保留** |
| 后端 Edge Function | ~382 行 | `convert/index.ts` | 服务端 | **保留并增强** |

### DDL 转换支持的方向（6 向）

| 源 → 目标 | 规则数 | 覆盖类型 |
|-----------|--------|----------|
| Oracle → MySQL | 32 | NUMBER, VARCHAR2, CLOB, DATE, TIMESTAMP, BOOLEAN... |
| Oracle → PG | 30 | + XMLTYPE, RAW, BFILE |
| MySQL → Oracle | 35 | BIGINT, TEXT, ENUM, SET, DATETIME... |
| MySQL → PG | 37 | + AUTO_INCREMENT→SERIAL, JSON→JSONB |
| PG → Oracle | 32 | SERIAL, JSONB, UUID, ARRAY, INTERVAL... |
| PG → MySQL | 29 | + TEXT[], BOOLEAN 拼接 |

### Body 变换覆盖（40+ handler）

核心变换包括：

- `DECODE` → `CASE WHEN`
- `NVL2` → `CASE` / `IF`
- `RAISE_APPLICATION_ERROR` → `RAISE EXCEPTION` / `SIGNAL SQLSTATE`
- `||` 拼接 → `CONCAT()`
- `ROWNUM` → `LIMIT` / `FETCH FIRST`
- `EXECUTE IMMEDIATE` → `PREPARE` / `EXECUTE`
- `MERGE INTO` → `INSERT ON DUPLICATE KEY UPDATE`
- `FOR r IN (SELECT)` → 游标循环
- `%ROWCOUNT` → `GET DIAGNOSTICS`
- 异常块 → `DECLARE HANDLER`
- `date_trunc` → `DATE_FORMAT` / `TRUNC`
- `MONTHS_BETWEEN` → `TIMESTAMPDIFF` / `AGE`
