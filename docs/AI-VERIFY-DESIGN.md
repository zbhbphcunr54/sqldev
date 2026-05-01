# AI 转换校验功能设计

> 对转换后的 DDL / 函数 / 存储过程进行 AI 语法、语义、业务逻辑校验，生成校验结果和修改意见清单。

---

## 一、功能定位

```
用户输入 SQL → [转换引擎] → 转换后 SQL → [AI 校验] → 校验报告
                                                      ↓
                                              语法问题 / 语义问题
                                              业务逻辑风险
                                              修改建议清单
```

**触发方式**：转换完成后，用户点击"AI 校验"按钮手动触发（不自动触发，避免浪费 token）。

**运行位置**：Edge Function（`convert-verify`），前端不可直连 AI API（§10.1）。

**配额限制**：每用户每天每种类型（ddl/func/proc）限 10 次，缓存命中不计次。

**环境感知**：校验前用户需配置 AI 身份和目标数据库环境，AI 据此进行精准校验。

---

## 二、AI 身份与环境配置

### 2.1 配置内容

用户在发起校验前，需要设定以下信息：

| 配置项 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| **AI 身份** | 是 | AI 扮演的角色和专业领域 | "资深 Oracle→MySQL 迁移专家" |
| **目标数据库版本** | 是 | 目标 DB 的具体版本 | MySQL 8.0 / PostgreSQL 16 / Oracle 21c |
| **源数据库版本** | 否 | 源 DB 版本（影响兼容性判断） | Oracle 19c / MySQL 5.7 |
| **业务场景** | 否 | SQL 的业务用途，帮助 AI 判断逻辑风险 | "电商订单系统，日均百万级写入" |
| **特殊要求** | 否 | 用户自定义的校验关注点 | "重点关注性能和数据精度" |

### 2.2 配置存储

用户配置保存在数据库中，下次自动加载：

```sql
-- 202605010002_create_verify_profiles.sql
create table public.verify_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  profile_name        text not null default 'default',
  ai_identity         text not null,
  target_db_version   text not null,
  source_db_version   text,
  business_context    text,
  special_requirements text,
  is_default          boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(user_id, profile_name)
);

comment on table public.verify_profiles is 'AI 校验环境配置，每个用户可保存多套配置（如不同项目）';
comment on column public.verify_profiles.ai_identity is 'AI 身份设定，如「资深 Oracle→MySQL 迁移专家，10年经验」';
comment on column public.verify_profiles.target_db_version is '目标数据库版本，如 MySQL 8.0 / PostgreSQL 16';
comment on column public.verify_profiles.source_db_version is '源数据库版本，如 Oracle 19c，用于判断兼容性边界';
comment on column public.verify_profiles.business_context is '业务场景描述，帮助 AI 判断性能/数据量/并发等风险';
comment on column public.verify_profiles.special_requirements is '用户自定义校验关注点';
comment on column public.verify_profiles.is_default is '是否为默认配置，每用户仅一个默认（部分唯一索引强制）';

alter table public.verify_profiles enable row level security;

create policy "verify_profiles_select_own" on public.verify_profiles
  for select to authenticated using (auth.uid() = user_id);
create policy "verify_profiles_insert_own" on public.verify_profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "verify_profiles_update_own" on public.verify_profiles
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "verify_profiles_delete_own" on public.verify_profiles
  for delete to authenticated using (auth.uid() = user_id);

create trigger verify_profiles_set_updated_at
  before update on public.verify_profiles
  for each row execute function public.set_updated_at();

-- 每用户只能有一个默认配置
create unique index idx_verify_profiles_one_default
  on public.verify_profiles (user_id)
  where is_default = true;
```

### 2.3 默认配置

用户首次使用时自动创建默认配置：

```typescript
const DEFAULT_PROFILES: Record<string, { aiIdentity: string; targetVersion: string }> = {
  oracle_to_mysql: {
    aiIdentity: '资深 Oracle→MySQL 数据库迁移专家，精通两种数据库的语法差异、性能优化和数据类型映射',
    targetVersion: 'MySQL 8.0'
  },
  oracle_to_postgresql: {
    aiIdentity: '资深 Oracle→PostgreSQL 数据库迁移专家，精通 PL/pgSQL 存储过程和 Oracle PL/SQL 的差异',
    targetVersion: 'PostgreSQL 16'
  },
  mysql_to_oracle: {
    aiIdentity: '资深 MySQL→Oracle 数据库迁移专家，精通 Oracle 的高级特性和 MySQL 的兼容性限制',
    targetVersion: 'Oracle 21c'
  },
  mysql_to_postgresql: {
    aiIdentity: '资深 MySQL→PostgreSQL 数据库迁移专家，精通两种数据库的函数差异和性能特性',
    targetVersion: 'PostgreSQL 16'
  },
  postgresql_to_oracle: {
    aiIdentity: '资深 PostgreSQL→Oracle 数据库迁移专家，精通 PL/SQL 和 PL/pgSQL 的转换',
    targetVersion: 'Oracle 21c'
  },
  postgresql_to_mysql: {
    aiIdentity: '资深 PostgreSQL→MySQL 数据库迁移专家，精通两种数据库的存储过程差异',
    targetVersion: 'MySQL 8.0'
  }
}
```

### 2.4 配置 UI

在转换结果面板顶部增加"校验配置"区域：

```
┌─────────────────────────────────────────────────────────────┐
│  AI 校验配置                                    [编辑] [切换]│
├─────────────────────────────────────────────────────────────┤
│  AI 身份：资深 Oracle→MySQL 迁移专家                         │
│  目标版本：MySQL 8.0    源版本：Oracle 19c                   │
│  业务场景：电商订单系统，日均百万级写入                       │
│  特殊要求：重点关注性能和数据精度                            │
└─────────────────────────────────────────────────────────────┘
│                                                             │
│  [AI 校验] 按钮                                              │
```

**编辑弹窗**：点击"编辑"打开配置编辑弹窗，可修改所有配置项。

**切换配置**：点击"切换"打开配置列表，可选择已保存的其他配置或创建新配置。

---

## 三、配额限制

### 3.1 配额规则

| 维度 | 限制 | 说明 |
|------|------|------|
| 每用户 | — | 所有配额按用户隔离 |
| 每类型 | 10 次/天 | ddl / func / proc 各 10 次 |
| 每天 | 自然日（UTC+8） | 每天 00:00 重置 |
| 缓存命中 | 不计次 | 相同 SQL 返回缓存结果不消耗配额 |

### 3.2 配额表

```sql
-- 202605010003_create_verify_quota.sql
create table public.verify_quota (
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('ddl', 'func', 'proc')),
  usage_date  date not null default (now() at time zone 'Asia/Shanghai')::date,
  used_count  int not null default 0,
  primary key (user_id, kind, usage_date)
);

comment on table public.verify_quota is 'AI 校验每日配额，每用户每类型每天 10 次';
comment on column public.verify_quota.user_id is '用户 ID';
comment on column public.verify_quota.kind is '校验类型：ddl / func / proc';
comment on column public.verify_quota.used_count is '已使用次数，缓存命中不计数';
comment on column public.verify_quota.usage_date is '使用日期（UTC+8 自然日）';

alter table public.verify_quota enable row level security;

create policy "verify_quota_select_own" on public.verify_quota
  for select to authenticated using (auth.uid() = user_id);

-- 仅 service_role 可写入
-- 无 insert/update/delete 策略 = 前端不可写

create index idx_verify_quota_date
  on public.verify_quota (usage_date);
```

### 3.3 配额检查逻辑

```typescript
// supabase/functions/convert-verify/quota.ts
import { parsePositiveInt } from '../_shared/utils.ts'

const DAILY_LIMIT = parsePositiveInt(Deno.env.get('CONVERT_VERIFY_DAILY_LIMIT'), 10)

export async function checkQuota(
  supabaseAdmin: SupabaseClient,
  userId: string,
  kind: string
): Promise<{ allowed: boolean; remaining: number; used: number }> {
  const today = getTodayUTC8()

  const { data } = await supabaseAdmin
    .from('verify_quota')
    .select('used_count')
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('usage_date', today)
    .single()

  const used = data?.used_count ?? 0
  return {
    allowed: used < DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - used),
    used
  }
}

export async function incrementQuota(
  supabaseAdmin: SupabaseClient,
  userId: string,
  kind: string
): Promise<void> {
  const today = getTodayUTC8()

  await supabaseAdmin.rpc('increment_verify_quota', {
    p_user_id: userId,
    p_kind: kind,
    p_date: today
  })
}

function getTodayUTC8(): string {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().split('T')[0]
}
```

```sql
-- 配额递增函数（原子操作）
create or replace function public.increment_verify_quota(
  p_user_id uuid,
  p_kind text,
  p_date date
) returns void language plpgsql as $$
begin
  insert into public.verify_quota (user_id, kind, usage_date, used_count)
  values (p_user_id, p_kind, p_date, 1)
  on conflict (user_id, kind, usage_date)
  do update set used_count = verify_quota.used_count + 1;
end;
$$;
```

### 3.4 配额耗尽响应

```json
{
  "ok": false,
  "error": "quota_exceeded",
  "message": "今日 DDL 校验次数已用完（10/10），明天 00:00 重置",
  "quota": {
    "kind": "ddl",
    "used": 10,
    "limit": 10,
    "remaining": 0,
    "resetAt": "2026-05-01T00:00:00+08:00"
  }
}
```

### 3.5 配额查询 API

```typescript
// GET /functions/v1/convert-verify?action=quota
// 响应
{
  "ok": true,
  "quota": {
    "ddl": { "used": 3, "limit": 10, "remaining": 7 },
    "func": { "used": 7, "limit": 10, "remaining": 3 },
    "proc": { "used": 0, "limit": 10, "remaining": 10 }
  }
}
```

前端在面板中展示配额状态：

```
┌─────────────────────────────────────────────────────────────┐
│  今日配额：DDL 3/10  函数 7/10  存储过程 0/10               │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、校验维度

### 4.1 语法校验

| 检查项 | 说明 | 示例 |
|--------|------|------|
| 关键字拼写 | 目标 DB 的关键字是否正确 | `AUTO_INCREMENT` vs `GENERATED ALWAYS AS IDENTITY` |
| 语法兼容性 | 生成的语法是否被目标 DB 版本支持 | MySQL 8.0+ 才支持 `WITH` CTE |
| 括号/分号匹配 | 基本语法结构完整性 | 缺少 `END IF;`、`END LOOP;` |
| 类型声明 | 数据类型是否为目标 DB 有效类型 | `VARCHAR2` 在 MySQL 中无效 |
| 默认值兼容 | `DEFAULT` 表达式是否目标 DB 支持 | `SYSDATE` 在 PostgreSQL 中无效 |
| 分隔符 | 函数/过程体的分隔符是否正确 | MySQL 用 `$$`，PostgreSQL 用 `$$` 或 `$$` |

### 4.2 语义校验

| 检查项 | 说明 | 示例 |
|--------|------|------|
| 函数语义等价 | 转换后的函数是否保持原始语义 | `NVL(a,b)` → `COALESCE(a,b)` 正确，但 `NVL(a,b,c)` 可能丢失参数 |
| 空值处理差异 | 不同 DB 的 NULL 处理差异 | Oracle `'' = NULL`，PostgreSQL `'' ≠ NULL` |
| 隐式类型转换 | 依赖隐式转换的代码在目标 DB 可能失败 | Oracle 隐式 `NUMBER→VARCHAR`，PostgreSQL 不支持 |
| 游标行为差异 | 游标属性在不同 DB 的行为差异 | `%NOTFOUND` vs `NOT FOUND` |
| 异常处理差异 | 异常捕获范围和传播机制差异 | Oracle `EXCEPTION` vs PostgreSQL `EXCEPTION` vs MySQL `DECLARE HANDLER` |
| 事务语义 | 自动提交、事务隔离级别差异 | MySQL 默认自动提交，Oracle 不自动提交 |

### 4.3 业务逻辑校验

| 检查项 | 说明 | 示例 |
|--------|------|------|
| 性能风险 | 转换后可能引入的性能问题 | `ROWNUM` → `LIMIT` 在无索引时可能慢 |
| 数据精度 | 数值类型精度变化 | `NUMBER(10,2)` → `DECIMAL(10,2)` 精度一致，但 `NUMBER` → `BIGINT` 可能丢失小数 |
| 字符集差异 | 字符集和排序规则差异 | Oracle `AL32UTF8` vs MySQL `utf8mb4` |
| 标识符长度 | 目标 DB 的标识符长度限制 | Oracle 30 字符，MySQL 64 字符，PostgreSQL 63 字符 |
| 保留字冲突 | 转换后的标识符是否与目标 DB 保留字冲突 | `ORDER`、`GROUP` 在某些 DB 是保留字 |
| 分区策略 | 分区语法转换后的等价性 | Oracle `PARTITION BY RANGE` vs PostgreSQL `PARTITION BY RANGE` 语法差异 |

---

## 五、数据库设计

### 5.1 校验结果表 `convert_verify_results`

```sql
-- 202605010001_create_convert_verify_results.sql
create table public.convert_verify_results (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid references auth.users(id) on delete set null,
  kind            text not null check (kind in ('ddl', 'func', 'proc')),
  from_db         text not null,
  to_db           text not null,
  input_sql       text not null,
  output_sql      text not null,
  input_hash      text not null,
  output_hash     text not null,
  ai_model        text not null,
  overall_score   int check (overall_score between 0 and 100),
  syntax_issues   jsonb not null default '[]',
  semantic_issues jsonb not null default '[]',
  logic_risks     jsonb not null default '[]',
  suggestions     jsonb not null default '[]',
  summary         text,
  raw_response    jsonb,
  duration_ms     int,
  error_message   text
);

comment on table public.convert_verify_results is 'AI 转换校验结果，记录语法/语义/业务逻辑校验报告';
comment on column public.convert_verify_results.overall_score is '综合评分 0-100，100=完全无问题';
comment on column public.convert_verify_results.syntax_issues is '语法问题清单，JSON 数组，每项含 line/severity/message/fix';
comment on column public.convert_verify_results.semantic_issues is '语义问题清单，JSON 数组，每项含 severity/message/original/converted';
comment on column public.convert_verify_results.logic_risks is '业务逻辑风险清单，JSON 数组，每项含 category/severity/message/impact';
comment on column public.convert_verify_results.suggestions is '修改建议清单，JSON 数组，每项含 priority/target_sql/explanation';
comment on column public.convert_verify_results.summary is 'AI 生成的总体评价文本';
comment on column public.convert_verify_results.input_hash is '原始 SQL 的 SHA-256 哈希';
comment on column public.convert_verify_results.output_hash is '转换后 SQL 的 SHA-256 哈希';
comment on column public.convert_verify_results.ai_model is '使用的 AI 模型名称';

alter table public.convert_verify_results enable row level security;

-- 用户可查自己的校验结果
create policy "verify_results_select_own" on public.convert_verify_results
  for select to authenticated using (auth.uid() = user_id);

-- 管理员可查所有
create policy "verify_results_select_admin" on public.convert_verify_results
  for select to authenticated
  using (exists (select 1 from public.admin_users where email = auth.email()));

-- 仅 service_role 可写入
-- 无 insert/update/delete 策略 = 前端不可写

create index idx_verify_results_user_created
  on public.convert_verify_results (user_id, created_at desc);
create index idx_verify_results_hashes
  on public.convert_verify_results (input_hash, output_hash);

-- 自动清理：保留 30 天
create or replace function public.cleanup_convert_verify_results()
returns void language sql as $$
  delete from public.convert_verify_results
  where created_at < now() - interval '30 days';
$$;
```

### 5.2 校验缓存

校验结果按 `(input_hash, output_hash)` 缓存，相同输入+输出不重复调用 AI：

```sql
-- 缓存命中逻辑（在 Edge Function 中实现）
SELECT * FROM public.convert_verify_results
WHERE input_hash = $1 AND output_hash = $2
ORDER BY created_at DESC LIMIT 1;
```

缓存有效期：30 天（与表清理策略一致）。

---

## 六、后端设计

### 6.1 新增 Edge Function `convert-verify`

**请求**：

```json
{
  "kind": "ddl",
  "fromDb": "oracle",
  "toDb": "mysql",
  "inputSql": "CREATE TABLE orders (...);",
  "outputSql": "CREATE TABLE orders (...);",
  "profileId": "uuid-of-verify-profile"  // 可选，不传则用默认配置
}
```

**响应**：

```json
{
  "ok": true,
  "overallScore": 72,
  "syntaxIssues": [
    {
      "line": 15,
      "severity": "error",
      "message": "MySQL 不支持 VARCHAR2 类型，应使用 VARCHAR",
      "fix": "将 VARCHAR2(100) 改为 VARCHAR(100)"
    },
    {
      "line": 23,
      "severity": "warning",
      "message": "IDENTITY 列语法在 MySQL 5.7 中不可用，需要 8.0+",
      "fix": "确认目标 MySQL 版本 >= 8.0"
    }
  ],
  "semanticIssues": [
    {
      "severity": "warning",
      "message": "Oracle 的空字符串等同于 NULL，但 MySQL 中不等同，可能导致业务逻辑变化",
      "original": "WHERE status = ''",
      "converted": "WHERE status = '' OR status IS NULL"
    }
  ],
  "logicRisks": [
    {
      "category": "performance",
      "severity": "medium",
      "message": "转换后的 LIMIT 语句在无合适索引时可能导致全表扫描",
      "impact": "大数据量场景下查询性能可能下降"
    },
    {
      "category": "data_precision",
      "severity": "high",
      "message": "NUMBER 无精度声明转换为 BIGINT，可能丢失小数部分",
      "impact": "金额计算可能出现精度误差"
    }
  ],
  "suggestions": [
    {
      "priority": "high",
      "targetSql": "...",
      "explanation": "将 VARCHAR2 改为 VARCHAR，并添加字符集声明 utf8mb4"
    },
    {
      "priority": "medium",
      "targetSql": "...",
      "explanation": "为 orders 表的 customer_id 列添加索引以优化 LIMIT 查询"
    }
  ],
  "summary": "转换整体可用，存在 2 个语法问题和 1 个数据精度风险。建议优先修复 VARCHAR2 类型和 NUMBER 精度问题。",
  "cached": false,
  "durationMs": 3200,
  "model": "gpt-4o-mini"
}
```

### 6.2 Prompt 设计

```typescript
// supabase/functions/convert-verify/prompt-template.ts
export interface VerifyEnvironment {
  aiIdentity: string
  targetDbVersion: string
  sourceDbVersion?: string
  businessContext?: string
  specialRequirements?: string
}

export function buildVerifySystemPrompt(
  kind: string,
  fromDb: string,
  toDb: string,
  env: VerifyEnvironment
): string {
  const identityLine = env.aiIdentity
    || `senior database migration expert specializing in ${fromDb} → ${toDb} conversion`

  const versionContext = [
    `Source database: ${fromDb}${env.sourceDbVersion ? ` ${env.sourceDbVersion}` : ''}`,
    `Target database: ${toDb} ${env.targetDbVersion}`
  ].join('\n')

  const businessLine = env.businessContext
    ? `\nBusiness context: ${env.businessContext}`
    : ''

  const requirementsLine = env.specialRequirements
    ? `\nSpecial requirements from user: ${env.specialRequirements}`
    : ''

  return `You are a ${identityLine}.

${versionContext}${businessLine}${requirementsLine}

Your task is to verify a converted ${kind.toUpperCase()} statement for correctness.

Analyze the ORIGINAL ${fromDb} SQL and the CONVERTED ${toDb} SQL, then produce a verification report.

Output strictly one JSON object. No markdown, no code fence.

JSON schema:
{
  "overallScore": 0-100,
  "syntaxIssues": [
    {
      "line": <line number or 0>,
      "severity": "error" | "warning" | "info",
      "message": "<issue description in Chinese>",
      "fix": "<suggested fix in Chinese>"
    }
  ],
  "semanticIssues": [
    {
      "severity": "error" | "warning" | "info",
      "message": "<issue description in Chinese>",
      "original": "<problematic original snippet>",
      "converted": "<problematic converted snippet>"
    }
  ],
  "logicRisks": [
    {
      "category": "performance" | "data_precision" | "charset" | "identifier" | "reserved_word" | "transaction" | "partition" | "other",
      "severity": "high" | "medium" | "low",
      "message": "<risk description in Chinese>",
      "impact": "<business impact in Chinese>"
    }
  ],
  "suggestions": [
    {
      "priority": "high" | "medium" | "low",
      "targetSql": "<suggested corrected SQL or fragment>",
      "explanation": "<explanation in Chinese>"
    }
  ],
  "summary": "<overall assessment in Chinese, 80-200 chars>"
}

Rules:
1) Focus on ${fromDb} ${env.sourceDbVersion || ''} → ${toDb} ${env.targetDbVersion} specific compatibility issues.
2) Check syntax compatibility with ${toDb} ${env.targetDbVersion} (keywords, types, functions).
3) Check semantic equivalence (NULL handling, type coercion, cursor behavior).
4) Check business logic risks (performance, precision, charset, reserved words).
5) Provide actionable fix suggestions with corrected SQL fragments.
6) Score: 100 = no issues, deduct points for each issue (error -15, warning -5, info -1).
7) Write all text in Simplified Chinese.
8) Be specific and reference actual SQL snippets, avoid generic advice.
9) Consider the target version ${env.targetDbVersion} when checking feature availability.`
}

export function buildVerifyUserPrompt(
  inputSql: string,
  outputSql: string
): string {
  return `Original SQL:
\`\`\`sql
${inputSql}
\`\`\`

Converted SQL:
\`\`\`sql
${outputSql}
\`\`\`

Please verify the converted SQL and output the JSON report.`
}
```

### 6.3 Edge Function 实现骨架

```typescript
// supabase/functions/convert-verify/index.ts
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { errorResponse, jsonResponse, logEdgeError } from '../_shared/response.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { logOperation } from '../_shared/operation-logger.ts'
import { buildVerifySystemPrompt, buildVerifyUserPrompt } from './prompt-template.ts'
import { requestAiVerify } from './provider.ts'
import { computeHash } from './hash.ts'
import { checkQuota, incrementQuota } from './quota.ts'
import { loadVerifyProfile } from './profile.ts'
import { parsePositiveInt } from '../_shared/utils.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: DEFAULT_WEB_ORIGIN
})

const RATE_LIMIT_MAX = parsePositiveInt(Deno.env.get('CONVERT_VERIFY_RATE_LIMIT_MAX'), 10)
const MAX_SQL_LENGTH = parsePositiveInt(Deno.env.get('CONVERT_VERIFY_MAX_SQL_LENGTH'), 50000)
const rateLimiter = createRateLimiter({
  scope: 'convert-verify',
  windowMs: 60_000,
  maxRequests: RATE_LIMIT_MAX
})

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const startTime = Date.now()
  let user: { id?: string; email?: string } | null = null

  try {
    // 1. 鉴权
    user = await validateUser(req)

    // 2. 限流
    const rateLimitResult = await rateLimiter.check(req, user.id)
    if (!rateLimitResult.allowed) {
      return errorResponse(429, 'rate_limited', corsHeaders)
    }

    if (req.method === 'GET') {
      // GET ?action=quota → 返回配额信息
      const quota = await getQuotaInfo(supabaseAdmin, user.id)
      return jsonResponse(200, { ok: true, quota }, corsHeaders)
    }

    if (req.method !== 'POST') {
      return errorResponse(405, 'method_not_allowed', corsHeaders)
    }

    // 3. 解析请求体
    const body = await req.json()
    const { kind, fromDb, toDb, inputSql, outputSql, profileId } = body

    // 4. 校验参数
    if (!['ddl', 'func', 'proc'].includes(kind)) return errorResponse(400, 'invalid_kind', corsHeaders)
    if (!inputSql || !outputSql) return errorResponse(400, 'missing_sql', corsHeaders)
    if (inputSql.length > MAX_SQL_LENGTH || outputSql.length > MAX_SQL_LENGTH) {
      return errorResponse(400, 'sql_too_long', corsHeaders)
    }

    // 5. 检查配额（缓存命中不计次）
    const quota = await checkQuota(supabaseAdmin, user.id, kind)
    if (!quota.allowed) {
      return jsonResponse(429, {
        ok: false,
        error: 'quota_exceeded',
        message: `今日 ${kind.toUpperCase()} 校验次数已用完（${quota.used}/10），明天 00:00 重置`,
        quota: { kind, used: quota.used, limit: 10, remaining: 0 }
      }, corsHeaders)
    }

    // 6. 计算哈希，查缓存
    const inputHash = await computeHash(inputSql)
    const outputHash = await computeHash(outputSql)
    const cached = await findCachedResult(supabaseAdmin, inputHash, outputHash)
    if (cached) {
      return jsonResponse(200, { ok: true, ...toCamelCase(cached), cached: true, quota }, corsHeaders)
    }

    // 7. 加载环境配置
    const profile = await loadVerifyProfile(supabaseAdmin, user.id, profileId)

    // 8. 调用 AI
    const systemPrompt = buildVerifySystemPrompt(kind, fromDb, toDb, profile)
    const userPrompt = buildVerifyUserPrompt(inputSql, outputSql)
    const aiResult = await requestAiVerify(config, systemPrompt, userPrompt)

    // 9. 写入缓存 + 递增配额
    await saveVerifyResult(supabaseAdmin, { userId: user.id, kind, fromDb, toDb, inputSql, outputSql, inputHash, outputHash, aiResult, durationMs: Date.now() - startTime })
    await incrementQuota(supabaseAdmin, user.id, kind)

    // 10. 记录操作日志
    await logOperation(supabaseAdmin, {
      userId: user.id, userEmail: user.email,
      operation: 'convert_verify', apiName: 'convert-verify',
      requestBody: { kind, fromDb, toDb, profileId },
      responseBody: { overallScore: aiResult.overallScore, cached: false },
      responseStatus: 200, durationMs: Date.now() - startTime,
      extra: { kind, fromDb, toDb, cached: false }
    })

    // 11. 返回结果
    return jsonResponse(200, {
      ok: true, ...aiResult, cached: false,
      quota: { kind, used: quota.used + 1, limit: 10, remaining: quota.remaining - 1 }
    }, corsHeaders)
  } catch (err) {
    logEdgeError('convert-verify', 'handler', err)
    return errorResponse(500, 'verify_failed', corsHeaders)
  }
})

// DB snake_case → API camelCase 映射
function toCamelCase(row: Record<string, unknown>): Record<string, unknown> {
  return {
    overallScore: row.overall_score,
    syntaxIssues: row.syntax_issues,
    semanticIssues: row.semantic_issues,
    logicRisks: row.logic_risks,
    suggestions: row.suggestions,
    summary: row.summary,
    aiModel: row.ai_model,
    durationMs: row.duration_ms
  }
}
```

### 6.4 config.toml

```toml
[functions.convert-verify]
verify_jwt = true
```

### 6.5 Secrets

| Secret | 说明 | 默认值 |
|--------|------|--------|
| `CONVERT_VERIFY_MODEL` | AI 模型名称 | `gpt-4o-mini` |
| `CONVERT_VERIFY_TIMEOUT_MS` | 超时时间 | `30000` |
| `CONVERT_VERIFY_MAX_TOKENS` | 最大 token | `4000` |
| `CONVERT_VERIFY_RATE_LIMIT_MAX` | 限流次数 | `10/分钟/用户` |
| `CONVERT_VERIFY_DAILY_LIMIT` | 每日每类型配额 | `10` |
| `CONVERT_VERIFY_MAX_SQL_LENGTH` | SQL 最大长度 | `50000` |

### 6.6 错误码映射（error-map.ts 新增）

```typescript
// src/utils/error-map.ts 新增
quota_exceeded: '今日校验次数已用完，明天 00:00 重置',
invalid_kind: '不支持的转换类型',
missing_sql: '缺少原始 SQL 或转换后 SQL',
sql_too_long: 'SQL 内容过长，请缩短后重试',
verify_failed: 'AI 校验失败，请稍后重试',
verify_profile_not_found: '校验配置不存在',
verify_profile_save_failed: '校验配置保存失败',
verify_profile_delete_failed: '校验配置删除失败',
```

### 6.7 DB → API 字段映射

数据库列用 snake_case，API 响应用 camelCase。Edge Function 返回时统一转换：

```typescript
function toCamelCase(row: Record<string, unknown>): Record<string, unknown> {
  return {
    overallScore: row.overall_score,
    syntaxIssues: row.syntax_issues,
    semanticIssues: row.semantic_issues,
    logicRisks: row.logic_risks,
    suggestions: row.suggestions,
    summary: row.summary,
    aiModel: row.ai_model,
    durationMs: row.duration_ms
  }
}
```

---

## 七、前端设计

### 7.1 API 封装

```typescript
// src/api/convert-verify.ts
import { invokeEdgeFunction } from '@/api/http'

export interface ConvertVerifyRequest {
  kind: 'ddl' | 'func' | 'proc'
  fromDb: 'oracle' | 'mysql' | 'postgresql'
  toDb: 'oracle' | 'mysql' | 'postgresql'
  inputSql: string
  outputSql: string
}

export type IssueSeverity = 'error' | 'warning' | 'info'

export interface SyntaxIssue {
  line: number
  severity: IssueSeverity
  message: string
  fix: string
}

export interface SemanticIssue {
  severity: IssueSeverity
  message: string
  original: string
  converted: string
}

export interface LogicRisk {
  category: string
  severity: 'high' | 'medium' | 'low'
  message: string
  impact: string
}

export interface Suggestion {
  priority: 'high' | 'medium' | 'low'
  targetSql: string
  explanation: string
}

export interface ConvertVerifyResponse {
  ok: boolean
  overallScore?: number
  syntaxIssues?: SyntaxIssue[]
  semanticIssues?: SemanticIssue[]
  logicRisks?: LogicRisk[]
  suggestions?: Suggestion[]
  summary?: string
  cached?: boolean
  durationMs?: number
  model?: string
  error?: string
}

export async function requestConvertVerify(
  payload: ConvertVerifyRequest
): Promise<ConvertVerifyResponse> {
  const result = await invokeEdgeFunction<ConvertVerifyRequest, ConvertVerifyResponse>(
    'convert-verify',
    payload
  )
  return result
}
```

### 7.2 组件拆分

| 组件 | 路径 | 职责 |
|------|------|------|
| `ConvertVerifyPanel` | `src/components/business/convert-verify/ConvertVerifyPanel.vue` | 校验面板容器，包含触发按钮和结果展示 |
| `VerifyScoreBadge` | `src/components/business/convert-verify/VerifyScoreBadge.vue` | 评分徽章（0-100 分，颜色渐变） |
| `VerifyIssueList` | `src/components/business/convert-verify/VerifyIssueList.vue` | 问题列表（语法/语义/逻辑分类展示） |
| `VerifySuggestionCard` | `src/components/business/convert-verify/VerifySuggestionCard.vue` | 建议卡片（含优先级标签、修正 SQL、说明） |

### 7.3 页面布局

```
┌─────────────────────────────────────────────────────────────┐
│  转换结果                              [AI 校验] 按钮       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │  ┌──────┐                                               ││
│  │ │ 72分  │  转换整体可用，存在 2 个语法问题和 1 个精度风险 ││
│  │  └──────┘                                               ││
│  │  [语法问题 2] [语义问题 1] [业务风险 2] [修改建议 3]     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ 语法问题 ──────────────────────────────────────────────┐│
│  │  ✗ L15  MySQL 不支持 VARCHAR2 类型                      ││
│  │        修复：将 VARCHAR2(100) 改为 VARCHAR(100)          ││
│  │  ⚠ L23  IDENTITY 列语法需要 MySQL 8.0+                 ││
│  │        修复：确认目标 MySQL 版本 >= 8.0                  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ 语义问题 ──────────────────────────────────────────────┐│
│  │  ⚠  Oracle 空字符串等同 NULL，MySQL 不等同               ││
│  │    原始：WHERE status = ''                               ││
│  │    转换：WHERE status = '' OR status IS NULL             ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ 业务逻辑风险 ──────────────────────────────────────────┐│
│  │  🔴 data_precision  NUMBER 无精度声明转 BIGINT 丢失小数  ││
│  │     影响：金额计算可能出现精度误差                        ││
│  │  🟡 performance    LIMIT 语句无索引可能全表扫描           ││
│  │     影响：大数据量场景下查询性能下降                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ 修改建议 ──────────────────────────────────────────────┐│
│  │  [高优先级]                                               ││
│  │  修正 SQL：...                                            ││
│  │  说明：将 VARCHAR2 改为 VARCHAR，添加字符集声明           ││
│  │                                                           ││
│  │  [中优先级]                                               ││
│  │  修正 SQL：...                                            ││
│  │  说明：为 customer_id 列添加索引                          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 7.4 触发时机

```typescript
// 在转换结果面板中
const verifyLoading = ref(false)
const verifyResult = ref<ConvertVerifyResponse | null>(null)

async function handleVerify() {
  verifyLoading.value = true
  try {
    verifyResult.value = await requestConvertVerify({
      kind: props.kind,
      fromDb: props.fromDb,
      toDb: props.toDb,
      inputSql: props.inputSql,
      outputSql: props.outputSql
    })
  } catch {
    verifyResult.value = { ok: false, error: 'verify_failed' }
  } finally {
    verifyLoading.value = false
  }
}
```

### 7.5 路由

无需新增路由。校验面板嵌入现有转换结果页面（workbench 的 DDL/函数/存储过程 tab）。

---

## 八、与 MIGRATION-LOCAL-TO-DB.md 的集成

### 8.1 新增表

在迁移方案 §三 中增加 3 张表：

| 表 | 用途 |
|----|------|
| `convert_verify_results` | 校验结果缓存 |
| `verify_profiles` | 用户环境配置 |
| `verify_quota` | 每日配额 |

### 8.2 新增函数

| 函数 | 用途 |
|------|------|
| `increment_verify_quota()` | 原子递增配额计数 |
| `cleanup_convert_verify_results()` | 清理 30 天前的校验结果 |

### 8.3 Edge Function 部署清单

在迁移方案 §二十 中增加：

| 顺序 | 函数 | 操作 | 依赖 |
|------|------|------|------|
| 9 | `convert-verify` | 新增 | operation-logger |

### 8.4 operation 枚举

在迁移方案 §十七 中增加：

```typescript
CONVERT_VERIFY: 'convert_verify',
VERIFY_PROFILE_SAVE: 'verify_profile_save',
VERIFY_PROFILE_DELETE: 'verify_profile_delete'
```

### 8.5 部署命令

```powershell
supabase functions deploy convert-verify
```

---

## 九、实施步骤

### 阶段 1：数据库

- 创建 `convert_verify_results` 表
- 创建 `verify_profiles` 表
- 创建 `verify_quota` 表
- 创建 `increment_verify_quota()` 函数
- 配置 RLS 策略
- 创建索引和清理函数
- 重新生成 `database.types.ts`

### 阶段 2：后端

- 新增 `convert-verify/prompt-template.ts`（含环境变量注入）
- 新增 `convert-verify/provider.ts`（复用 ziwei-analysis 的 AI 调用模式）
- 新增 `convert-verify/hash.ts`（SHA-256 计算）
- 新增 `convert-verify/quota.ts`（配额检查和递增）
- 新增 `convert-verify/profile.ts`（环境配置加载）
- 新增 `convert-verify/index.ts`
- 更新 `config.toml`

### 阶段 3：前端

- 新增 `src/api/convert-verify.ts`（含配额查询）
- 新增 `src/api/verify-profiles.ts`（环境配置 CRUD）
- 新增 5 个组件：
  - `ConvertVerifyPanel`（校验面板容器）
  - `VerifyEnvironmentConfig`（环境配置编辑）
  - `VerifyScoreBadge`（评分徽章）
  - `VerifyIssueList`（问题列表）
  - `VerifySuggestionCard`（建议卡片）
- 在现有转换结果面板中嵌入校验按钮和面板

### 9.4 测试

- 新增 `tests/unit/api-convert-verify.test.ts`
- 新增 `tests/unit/verify-quota.test.ts`
- 新增 `tests/unit/api-verify-profiles.test.ts`
- 更新 smoke 断言

---

## 十、验收清单

### 阶段 1 验收（数据库）

- [ ] 3 张表创建成功，`COMMENT ON` 完整
- [ ] RLS 策略生效（anon/authenticated 无法直接写入 verify_quota / convert_verify_results）
- [ ] `idx_verify_profiles_one_default` 部分唯一索引生效
- [ ] `increment_verify_quota()` 函数可调用
- [ ] `supabase gen types typescript --local > src/types/database.types.ts` 执行成功
- [ ] `pnpm typecheck` 通过

### 阶段 2 验收（后端）

- [ ] `convert-verify` Edge Function 本地测试通过
- [ ] 配额检查生效（超过 10 次返回 429）
- [ ] 缓存命中不计次（相同 SQL 第二次调用返回 cached: true 且配额不减）
- [ ] 限流生效（超限返回 429）
- [ ] 请求体校验生效（SQL 超长返回 400）
- [ ] 环境配置注入 Prompt（target_db_version 出现在 system prompt 中）
- [ ] 操作日志写入成功
- [ ] 错误响应脱敏
- [ ] `config.toml` 配置正确

### 阶段 3 验收（前端）

- [ ] API 封装类型正确
- [ ] error-map.ts 包含所有新错误码
- [ ] 环境配置编辑/切换功能正常
- [ ] 配额状态实时展示
- [ ] 校验结果面板正常展示（评分、问题、建议）
- [ ] 空状态/加载状态/错误状态处理
- [ ] `pnpm typecheck` + `pnpm lint` 通过

### 阶段 4 验收（测试）

- [ ] 3 个测试文件通过
- [ ] smoke 断言更新并通过
- [ ] `pnpm verify` 全部通过

---

## 十一、预期效果

| 指标 | 目标 |
|------|------|
| 校验耗时 | < 5 秒（含 AI 调用） |
| 缓存命中率 | > 60%（相同 SQL 重复校验） |
| 问题检出率 | 语法问题 100%，语义问题 80%+ |
| 建议可用性 | 修改建议可直接复制使用 |
| 单次成本 | ~$0.01-0.03（gpt-4o-mini，~2000 token） |
