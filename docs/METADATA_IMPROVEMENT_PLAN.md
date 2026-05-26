# 元数据功能改进 — 任务执行清单

> 按实际执行顺序排列，每个任务独立可交付。后一个任务依赖前一个的完成。
>
> 复杂度标记：S = 半天内，M = 1-2 天，L = 2-4 天，XL = 8-12 天
>
> **整体估算**：Step 1–10 合计约 **30–38 个工作日**（≈ 6–8 周）。其中 Phase 1B 后端持久化（Step 4–7）约 14–18 天，是关键路径；Step 6 双层架构 + 冲突合并独占 8–12 天。
>
> **配套文档**：每个 Step 末尾的"关键约束"是不可妥协的语义保证。完整决策理由见 [`METADATA_DECISIONS.md`](./METADATA_DECISIONS.md)（M1–M30）。落地时若与代码冲突，以决策文档为准。

---

## 执行策略：先做垂直切片 PoC

在投入完整 30+ 天执行前，强烈建议先用 **1 周** 跑通一个垂直切片 PoC，验证关键技术假设：

1. **Step 4 简化版**：单表 + RLS（含 [M26] 冗余 user_id），不做 trigger、不做 pg_cron
2. **Step 5 简化版**：仅 GET + PUT 两个路由，PG function 实现（[M20]）
3. **Step 6 简化版**：手动同步按钮 + 乐观锁，无字段级合并、无离线队列

**PoC 验收**：
- PG function 事务原子性可验证（用 `pg_terminate_backend` 强杀连接观察回滚）
- RLS 性能基线（[M29] 100 并发 PATCH < 1s p95）达标
- Edge Function 冷启动 + 业务逻辑 < 1.5s p95
- supabase-js client 与 PG function 错误码翻译跑通（409 / 422 / 500 各一次）

PoC 不达标时回头调整方案（如改 RLS 实现、拆 Edge Function、降级到 REST），比在 Step 6 才发现问题损失小一个数量级。

---

## Step 1：前端快速修复（无依赖）

两个独立小改动，零回归风险，立即可做。

### 任务 1.1 — ID 生成改用 `uuid()` 工具 `S`

**文件**：`src/lib/uuid.ts`（新建）、`src/stores/workbench.ts`

- 新建 `src/lib/uuid.ts`，导出 `uuid()`：优先 `crypto.randomUUID()`，降级到基于 `crypto.getRandomValues` 的 v4 UUID 实现（具体代码见 [M24]）
- 将 `createMetadataRecord()` 和 `createMetadataRevision()` 中的 `Math.random().toString(36).slice(2,8)` 替换为 `uuid()`
- 仓库内其他 ID 生成处（搜索 `Math.random().toString(36)`）一并替换，避免遗留

### 任务 1.2 — fieldName 唯一性校验 `S`

**文件**：`src/composables/useMetadataValidation.ts`、`MetadataPage.vue`

- `validateField` 的 `fieldName` 分支增加去重检查，传入所有 records + 当前 recordId
- 空字符串不参与唯一性校验（空值走必填校验）
- 重复时行内显示 "字段名已存在"，阻止保存

**验收**：`pnpm typecheck && pnpm lint && pnpm test` 通过

**关键约束**：
- [M14] `fieldName === ''` **不**参与唯一性校验（空值走必填分支），与 Step 4 的部分唯一索引 `where field_name <> ''` 保持前后端一致。
- [M24] UUID 生成必须走 `src/lib/uuid.ts` 的 `uuid()` 工具，**禁止**直接调 `crypto.randomUUID()`（HTTPS 限制 + Safari < 15.4 不支持）。

---

## Step 2：Store 拆分 `M`

后续所有任务的基础。从 workbench.ts 中提取元数据代码为独立 store。

### 任务 2.1 — 提取 `src/stores/metadata.ts`

- 将 workbench.ts 中 ~280 行元数据类型、factory 函数、actions 全部搬出
- MetadataPage.vue 改用 `useMetadataStore()`
- export.ts 类型导入改为从新 store
- localStorage key `sqldev:workbench:metadata` 不变

### 任务 2.2 — 内部数据结构优化

在新 store 中：内部用 `Map<string, MetadataRecord>` + `recordOrder: string[]` 管理，单条更新从 O(n) 降为 O(1)。对外暴露 computed 有序数组，模板层无感知。

**localStorage payload 加 `schemaVersion`（[M25]）**：

```jsonc
{
  "schemaVersion": 2,
  "records": [...],
  "recordOrder": [...],
  "_writerTabId": "...",
  "_lastWrittenAt": "..."
}
```

读取逻辑：
- 缺 `schemaVersion` → 视为 v1（旧 `order: string` 格式），执行下面的一次性迁移
- `schemaVersion === 2` → 直接使用
- `schemaVersion > 2` → 拒绝读取，提示用户"本地数据由更新版本写入"（避免回滚版本时丢字段）

**`order: string` → `displayOrder: number` 类型迁移**（v1 → v2 升级）：
- 现有 `MetadataRecord.order` 是字符串类型（`"1"`, `"2"`, …），新 store 改为 `displayOrder: number`（为 fractional indexing 做准备）。
- `getMetadataCache()` 加载旧数据时，对每条 record 执行 `displayOrder = Number(record.order) || index + 1`（兼容 NaN / 空值）。
- 序列化到 localStorage 时直接写 `displayOrder: number`，不再保留 `order` 字段。
- 首次加载完成后自动触发一次 `persistMetadataCache()` 将旧格式覆盖为新格式（一次性迁移）。迁移函数命名为 `migrateV1ToV2()`，未来加 v2 → v3 时按链式 migrator 拼接。

**dirtyFields 追踪（[M21] PATCH 字段级 diff 的前提）**：
- 每条 record 内部维护 `dirtyFields: Set<keyof MetadataRecord>`（不持久化到 localStorage，仅运行时）
- 用户改字段时 `dirtyFields.add(fieldName)`，保存成功后 `dirtyFields.clear()`
- Step 5 的 API 层从 `dirtyFields` 读取本次实际改动字段构造 PATCH payload

**fractional indexing 计算职责**（[M3] 实施细节）：
- 拖动排序 / 新增 / 批量插入时，store action 计算 `displayOrder = (prevRecord.displayOrder + nextRecord.displayOrder) / 2`（首条用 `next - 1`，末条用 `prev + 1`）。
- 计算后立即触发本地写入；服务端写入由 Step 5/6 的同步逻辑接管。
- store 检测到 `Math.abs(next - prev) < 1e-6` 时**不本地兜底**，直接走"调用 rebalance 路由"分支（Step 5 提供）。

**验收**：功能与重构前完全一致，增删改查、排序、导出均正常

**关键约束**：
- localStorage key `sqldev:workbench:metadata` **不变**，保证旧用户数据无缝过渡到新 store。
- [M25] localStorage payload 顶层 **必须** 包含 `schemaVersion: 2`；读取时按版本号分支处理，未来加字段不破坏向后兼容。
- 对外只暴露 `computed` 的有序数组，模板层不感知内部 `Map + recordOrder` 结构；内部数据结构变更不应导致模板回归。
- `dirtyFields` **仅运行时**（不持久化），刷新后重置为空——意味着刷新前未保存的"字段改动追踪"会丢失（用户感知是"刷新后保存会全量上传"，可接受）。

---

## Step 3：前端数据层加固 `M`

三个独立小任务，Step 2 完成后可并行做。

### 任务 3.1 — localStorage 容量监控

- 新建 `src/features/metadata/storageMonitor.ts`（纯函数）
- 遍历 `localStorage` 所有 key，按 UTF-16 编码（每字符 2 字节）计算已用字节：`Object.keys(localStorage).reduce((sum, k) => sum + (k.length + localStorage.getItem(k)!.length) * 2, 0)`
- 以 **5MB**（5 × 1024 × 1024 字节）为**保守**配额上限：Safari 默认即 5MB，Chrome/Edge/Firefox 通常更大（~10MB）但不同版本浮动。取最严苛值保证跨浏览器一致提醒。
- 按比例计算：60% 警告、80% 危险
- 警告文案明确"基于保守估算"，避免在 Chrome 用户 3MB 时被吓到：`"本地数据已使用约 60%（基于保守估算，实际配额可能更大）。建议清理或同步到云端。"`
- 可选：单独计算 `metadata` key 占用字节，在元数据页面显示占比
- 页面顶部显示可关闭的警告横幅

### 任务 3.2 — 多标签页冲突检测

- 新建 `src/composables/useTabId.ts`：生成并持久化到 `sessionStorage` 的标签页唯一 id（`crypto.randomUUID()`），**在本 Step 提前引入**，供后续 Step 6 的 `X-Client-Tab-Id` 请求头复用
- 新建 `src/composables/useStorageSync.ts`，监听 `storage` 事件，通过 storage value 中嵌入的 `_writerTabId` 字段排除自身写入
- 横幅文案明确风险："数据已在其他标签页更新。刷新会丢弃未保存修改。"
- 提供两个按钮：「刷新加载」「先导出当前数据」

### 任务 3.3 — 空状态引导

- 新建 `src/features/metadata/sampleData.ts`（3-5 条示例记录）
- 空状态时用 StatePanel 显示："新增第一条记录" + "加载示例数据"

**验收**：容量警告、标签页冲突、空状态三个场景手动验证

**关键约束**：
- [M6] 容量阈值**禁止**使用 `navigator.storage.estimate()`（该 API 监控的是 IndexedDB/CacheStorage 配额，不含 localStorage）。必须遍历 `localStorage` 所有 key 按 UTF-16 字符编码手动计算已用字节，以 5MB 为假设配额上限计算比例。
- [M10] 多标签页冲突横幅**必须**提供"先导出当前数据"按钮，避免用户点刷新后丢失未保存工作。
- `useStorageSync` 必须排除"本 tabId 自己触发的 storage 事件"——通过 `useTabId` 提供的标签页 id（本 Step 引入）与 storage value 中的 `_writerTabId` 比对实现，不依赖 Step 6。

---

## Step 4：后端 — 数据库设计 `M`

### 任务 4.0 — 部署前置检查 `S`

**这是 Step 4 启动前必做的环境确认，不要写 migration 前先跳过。**

- 确认 pg_cron 可用性（[M27]）：自托管环境执行 `CREATE EXTENSION IF NOT EXISTS pg_cron;`；Supabase Cloud 确认项目 ≥ Pro tier 并在 Dashboard 启用 pg_cron extension
- 若 pg_cron 不可用：在 Step 4.1 改用 Edge Function + Scheduled Trigger 替代 pg_cron 调度（每天调一次清理 function）
- 现有 `supabase/functions/cleanup/` function 已存在（仓库 `supabase/functions/` 目录可见），需先阅读其职责，决定是合并还是新建 metadata 专属清理 function

### 任务 4.1 — Migration 文件

新建 `supabase/migrations/202605xxNNNN_create_metadata_tables.sql`，包含 3 张表：

**`metadata_workspaces`**：
- UUID PK、`user_id` FK、`name`、`version`（乐观锁）、`last_writer_tab_id text`（最近写入的标签页 id，用于 409 冲突分流）、`deleted_at`（软删）、`seed_from_local_at`（迁移标记）
- RLS：own-row CRUD（`auth.uid() = user_id`，过滤 `deleted_at is null`）

**`metadata_records`**：
- UUID PK、`workspace_id` FK、**`user_id uuid not null`**（[M26] 冗余列，trigger 自动同步）
- `display_order numeric`（fractional indexing）、`updated_at timestamptz not null default now()`（[M21] 字段级乐观锁）
- 业务字段：`zh_name`、`field_name`、`attr_type`、`length`、`standard_code`、`business_desc`
- 预留字段：`enum_values jsonb`、`is_primary_key`、`is_indexed`、`is_required`、`foreign_key jsonb`
- 部分唯一索引：`(workspace_id, field_name) where field_name <> ''`
- **复合索引**：`(user_id, workspace_id, id)` 覆盖 RLS + 主键访问路径
- RLS：**直接** `auth.uid() = user_id`（[M26]），**禁止**子查询 JOIN workspace 表
- BEFORE INSERT trigger `sync_user_id_on_records` 从 `metadata_workspaces.user_id` 同步到 `metadata_records.user_id`
- BEFORE UPDATE trigger 自动 `updated_at = now()`

**`metadata_revisions`**：
- UUID PK、`record_id` FK（ON DELETE SET NULL）+ `record_id_snapshot uuid`（删除前备份）
- `workspace_id` FK、**`user_id uuid not null`**（[M26] 同样冗余）
- `version`、`revision_note`、`author`、`type`、`snapshot jsonb`
- RLS：**直接** `auth.uid() = user_id`，仅 SELECT + INSERT（审计不可变）
- `(record_id, created_at desc, id desc)` 复合索引（[M28] 支持 revisions cursor 分页）
- `(workspace_id, created_at desc, id desc)` 复合索引（全工作区时间线）
- `created_at` 索引（pg_cron 清理用）

附带 pg_cron 任务：清理 7 天前软删的 workspace + 清理超期 snapshot。

### 任务 4.2 — PostgreSQL function 封装事务（[M20]）

新建 `supabase/migrations/202605xxNNNN_create_metadata_functions.sql`，定义三个 plpgsql function：

| Function | 参数 | 行为 |
|----------|------|------|
| `metadata_apply_put(p_workspace_id uuid, p_payload jsonb, p_expected_version int, p_tab_id text) returns jsonb` | 整存：upsert + diff delete + insert revisions + bump version | 事务原子 |
| `metadata_apply_patch(p_workspace_id uuid, p_payload jsonb, p_expected_version int, p_tab_id text) returns jsonb` | 增量：字段级 merge + diff delete + insert revisions + bump version | 事务原子 |
| `metadata_rebalance(p_workspace_id uuid, p_expected_version int, p_tab_id text) returns jsonb` | 重排 display_order = row_number() | 事务原子 |

要求：
- 函数入口 `SELECT version FROM metadata_workspaces WHERE id = p_workspace_id FOR UPDATE`，乐观锁不通过时 `RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'version_conflict', DETAIL = jsonb_build_object(...)`
- `SECURITY INVOKER`（不是 DEFINER），让 RLS 生效
- 函数内统一写 `operation_logs`（不在 Edge Function 端写）
- snapshot 填充责任在函数内完成（[Step 5 关键约束]），前端 payload 不传 snapshot

**验收**：`supabase db reset` 成功，`supabase gen types typescript` 重新生成类型文件，`select * from cron.job` 显示两个调度已注册

**关键约束**：
- [M1] migration 文件名格式 `202605xxNNNN_*.sql`（12 位数字无下划线），顺延仓库最新一条 `202605180007_*`。
- [M2] `metadata_revisions.record_id` **必须** `ON DELETE SET NULL`（**禁止** `cascade`），并冗余 `record_id_snapshot uuid not null` + `field_name_snapshot text` 用于历史追溯。这是审计不可篡改的硬保证。
- [M3] `display_order numeric not null`（**禁止** `integer`），用 fractional indexing。
- [M9] pg_cron 清理超期 snapshot 的 schedule 见决策文档（每月 1 号 03:00 UTC）。
- [M12] `foreign_key jsonb` 字段结构在 column comment 中预定义（`{refTable, refField, onDelete, displayLabel?}`），避免 Phase 10.2 时再加 migration。
- [M13] `supabase gen types typescript > src/types/supabase.ts` 是本 Step **硬交付物**，未生成视为 Step 4 未完成。
- [M14] 部分唯一索引 `where field_name <> ''`，允许空字符串重复。
- [M15] `metadata_workspaces` 必须有 `deleted_at` 字段；所有读取路径必须过滤 `deleted_at is null`（无论 RLS 还是 API 层）。
- [M20] 核心写入逻辑必须封装为 PG function，Edge Function 不直接拼 SQL。
- [M21] `metadata_records.updated_at` 是 record 级乐观锁字段，trigger 自动维护。
- [M26] `metadata_records` / `metadata_revisions` 必须冗余 `user_id`，RLS policy 直接比对 `auth.uid()` 不 JOIN。
- [M27] 部署前必须确认 pg_cron 可用（自托管 + Cloud Pro），或预先准备 Scheduled Trigger 兜底方案。
- [M28] revisions 必须建 `(record_id, created_at desc, id desc)` 与 `(workspace_id, created_at desc, id desc)` 两个复合索引。

**回滚预案**：准备一份 down migration（`drop function ...; drop table metadata_revisions, metadata_records, metadata_workspaces cascade`）。生产环境出现严重问题时前端可降级回 localStorage-only 模式（Step 6 之前的状态）。

---

## Step 5：后端 — Edge Function 最小闭环 `M`

### 任务 5.1 — Edge Function `metadata`

新建 `supabase/functions/metadata/`，文件：`index.ts`、`handler.ts`、`validator.ts`、`config.toml`。

最小闭环实现 **5 个**核心路由：

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/metadata/workspaces` | 列出用户工作区 |
| `GET` | `/metadata/workspaces/:id` | 获取完整数据（records + 每条 record 最近 3 条 revisions；更多 revisions 通过 Step 7 的分页路由按需加载） |
| `PUT` | `/metadata/workspaces/:id` | 整存：upsert records + diff 删除 + insert revisions + 乐观锁 |
| `PATCH` | `/metadata/workspaces/:id/records` | 增量：`{ upserts, deletes, revisions, expectedVersion }` |
| `POST` | `/metadata/workspaces/:id/rebalance` | display_order 精度耗尽时整 workspace 重排（事务内重新等距分配 `1.0, 2.0, …`），受乐观锁保护 |

> **rebalance 并发保护**：rebalance 路由同样需要 `expectedVersion` 参数并在事务内 `SELECT version FOR UPDATE` 校验。若两个标签页同时检测到精度耗尽并调用 rebalance，先到者成功执行并 bump version，后到者收到 409。后到者收到 409 后**不应重试 rebalance**（先到者已完成重排），而应 fetch 最新数据后重试原始写入操作。

> **为什么 PATCH 与 rebalance 都放进最小闭环**：[M8] 要求日常编辑走 PATCH（避免 PUT 整存性能炸）；[M3] 的 fractional indexing 在 ~50 次连续中点插入后会精度耗尽，前端必须能调用 rebalance 修复，否则 Step 6 上线后用户会卡死。其它扩展路由（POST/DELETE/import/revisions/restore/migrate）仍留到 Step 7。

写入策略（PUT 与 PATCH 共用核心逻辑）：upsert records（按 id 匹配）+ diff 删除不在提交列表中的 records + insert 新 revisions。**不用** DELETE ALL + INSERT ALL，避免破坏修订的 record_id 外键。

写入器返回 `422 PrecisionExhausted` 时，前端必须自动调用 rebalance 后重试一次（重试仍失败则进入 error 状态）。

复用 `_shared/`：auth、cors、response、operation-logger、rate-limit。

**前置修改**：
- `_shared/operation-logger.ts` 的 `ALLOWED_OPERATIONS` 白名单需新增 `metadata_save`、`metadata_patch`、`metadata_rebalance` 三个操作名，否则运行时写入日志会被拒绝。
- **[M23]** `_shared/cors.ts` 的 `Access-Control-Allow-Headers` 响应头必须包含 `X-Client-Tab-Id`。同时检查现有头列表是否已包含 `Authorization`、`Content-Type`、`X-Client-Info`（supabase-js 默认带），缺哪个补哪个。**这是 Step 5 上线前的硬前提，遗漏会导致前端所有写请求 CORS 失败**。

**调用方式（[M20]）**：Edge Function 的 PUT / PATCH / rebalance handler **不直接拼 SQL**，统一调 `supabase.rpc('metadata_apply_put' | 'metadata_apply_patch' | 'metadata_rebalance', { p_workspace_id, p_payload, p_expected_version, p_tab_id })`。捕获 PG 抛出的 `P0001` ERRCODE 翻译为 409；`P0002`（自定义码）翻译为 422 PrecisionExhausted。

### 任务 5.2 — 前端 API 层

新建 `src/api/metadata.ts`，用 `edgeFn` 封装上述 5 个路由：`listWorkspaces`、`getWorkspace`、`saveWorkspace`（PUT）、`patchWorkspaceRecords`（PATCH）、`rebalanceWorkspace`（POST rebalance）。

**PATCH 字段级 payload 结构（[M21]）**：

```ts
type PatchRequest = {
  creates: MetadataRecord[];                                              // 新增（全字段）
  upserts: Array<{
    recordId: string;
    changedFields: Partial<MetadataRecord>;                               // 只包含 dirty 字段
    expectedRecordUpdatedAt: string;                                      // record 级乐观锁
  }>;
  deletes: string[];                                                      // 仅 id
  revisions: Array<{ recordId: string; type: 'create' | 'update' | 'delete' | 'correction'; revisionNote?: string; corrects?: string }>;
  expectedVersion: number;                                                // workspace 级乐观锁
};
```

前端 store 从每条 record 的 `dirtyFields: Set` 取出本次实际改动字段构造 `changedFields`。**禁止**把整条 record 全字段塞入 `changedFields`，否则字段级合并失效。

**Case 转换约定 [⑪]**：snake_case ↔ camelCase 转换**统一在本 API 层完成**。store / UI / composables 全程使用 camelCase；Edge Function / DB / migration 全程使用 snake_case。除本文件外其它任何位置出现混用视为 bug。**注意**：此约定仅适用于 `src/api/metadata.ts`，不改动现有其他 API 模块（如 `sql-convert.ts`、`feedback.ts` 等仍保持各自现有风格）。

**验收**：`supabase functions serve metadata` 本地跑通 GET/PUT/PATCH/rebalance；RLS 验证用户隔离；并发场景 100 用户 PATCH 单字段 < 1s p95（[M29]）

**关键约束**：
- [M2] 写入器**禁止**手动 `DELETE FROM metadata_revisions WHERE record_id IN ...`。FK 是 `SET NULL`，会自动置空，手动删等于破坏审计。
- [M2] 写入器**禁止** `DELETE FROM metadata_records WHERE workspace_id = :id` 整表删；必须 upsert + diff。
- record 的新 id **由前端 UUID 生成**（`uuid()` 工具，对齐 Step 1.1 + [M24]），便于前端乐观渲染；服务端不重新分配 id。
- [M8] 日常编辑（Step 6 调用）走 PATCH；PUT 仅用于首次保存与导入（Step 7）。
- [M20] Edge Function handler 必须调 PG function，**禁止**直接 `supabase.from(...).upsert(...)` 拼多步逻辑。
- [M21] PATCH 必须传字段级 `changedFields`，每条 upsert 必须带 `expectedRecordUpdatedAt`。
- [M23] CORS 响应头 `Access-Control-Allow-Headers` 必须包含 `X-Client-Tab-Id`。
- 乐观锁：PUT/PATCH 入口 PG function 内 `SELECT version, last_writer_tab_id FROM metadata_workspaces WHERE id = ... FOR UPDATE` 比对 `expectedVersion`，不一致 `RAISE EXCEPTION USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('currentVersion', ..., 'currentData', ..., 'lastWriterTabId', ...)`。写入成功时更新 `version = version + 1` 和 `last_writer_tab_id = p_tab_id`。
- 所有读取路径**必须**过滤 `deleted_at is null`（[M15]）。
- **snapshot 填充责任** [③]：`revisions.snapshot` 由 PG function 在事务内填充，前端 payload **不传** snapshot 字段：
  - `create` / `update`：upsert 完成后 `SELECT` 取最终 record 全字段写入 snapshot；
  - `delete`：先 `SELECT INTO` 拿到完整 row，再 DELETE，最后将暂存 row 作为 snapshot；
  - `correction`：前端 body 必须携带 `corrects: revisionId`，函数内从该 revision 拷贝 snapshot 后再覆盖业务字段。
- **fractional indexing 落地分工** [②]：display_order 由**前端 store 计算**（Step 2.2 已定义）；服务端 PG function 校验范围（`> 0`、相邻 record 间距 ≥ 1e-6），精度耗尽 `RAISE EXCEPTION USING ERRCODE = 'P0002'`（翻译为 422 PrecisionExhausted）。
- **operation_logs** [⑤]：PG function 内事务提交前写一条 `operation_logs`（不在 Edge Function 端写，否则可能与业务数据不一致），操作名分别为 `metadata_save`、`metadata_patch`、`metadata_rebalance`，载荷 `{workspaceId, upsertCount, deleteCount, revisionCount, version}`。
- **rate-limit** [⑨]：复用 `_shared/rate-limit.ts`，三个路由分别限速 `PATCH: 60/min/user`、`PUT: 10/min/user`、`POST rebalance: 5/min/user`。GET 路由不限。**批量操作（Step 8.2）必须合并为单次 PATCH**，不要循环发起 200 次 PATCH 触发限速。

**Step 5 关键验证 case**：
1. RLS：用户 A 拿不到用户 B 的 workspace（含 records、revisions 两表都通过 user_id 列直接验证，[M26]）；
2. PATCH 删除一条 record 后，`select * from metadata_revisions where record_id_snapshot = :id` 仍能取到完整修订，且 `record_id IS NULL`、`snapshot` 非空；
3. 同一 record 同时被两个标签页 PATCH，后到者收到 409 + `{ currentVersion, currentData, lastWriterTabId }`；前端通过比对 `lastWriterTabId` 判定冲突来源；
4. **字段级合并验证**（[M21]）：tab A 改 record X 的 `zhName`、tab B 改同一 record 的 `length`，两边各自 PATCH，因 `changedFields` 键不相交，**两次 PATCH 都应成功**（后到者基于 record 级 `expectedRecordUpdatedAt` 失败时由前端自动 fetch + 重组 PATCH 重试一次）；
5. **同字段并发**：tab A、tab B 同时改 `zhName`，后到者 record 级乐观锁失败 → 进入冲突 UI；
6. **性能基线** [④] [M29]：
   - PUT 500 records workspace 端到端 < **2s p95**（单用户，首次保存/导入路径）
   - PATCH 单字段修改 < **500ms p95**（单用户，日常路径）
   - PATCH 单字段并发 100 用户 < **1s p95**（[M29] 并发基线）
   - PATCH 批量 20 条变更 < **1s p95**
   - POST rebalance 500 records < **1.5s p95**
7. fractional indexing：连续 60 次在同一相邻位置插入新 record，第 ~50 次后写入器返回 422，前端自动 rebalance 后重试成功；
8. **rebalance 并发**：两个标签页同时调用 rebalance，先到者成功（version bump），后到者收到 409 后 fetch 最新数据并重试原始写入（不重试 rebalance）；
9. operation_logs：每次写入路由后均产生一条对应操作名的日志记录（由 PG function 在事务内写）；
10. **PG function 事务原子性**（[M20]）：在 function 执行中途用 `pg_terminate_backend` 强杀，所有变更回滚（records、revisions、operation_logs、workspace.version 都未改）；
11. **CORS preflight**（[M23]）：从 https 域名以 `X-Client-Tab-Id` 头发请求，OPTIONS preflight 返回的 `Access-Control-Allow-Headers` 必须包含该头名。

---

## Step 6：后端 — Store 双层架构

**拆分策略**：原 Step 6（XL，8–12 天）拆为两阶段交付，降低风险：

- **Step 6a — 必做**（约 3–4 天，L）：手动同步 + 乐观锁 + 跨设备冲突提示。覆盖单用户多设备的核心 sync 场景。
- **Step 6b — 按需**（约 5–7 天，L）：自动后台同步 + 多标签页字段级合并 + 离线队列重放。如果业务侧确认元数据主要是"单用户单设备低频编辑"场景，6b 可以延期至有真实需求时再做。

下文先描述完整目标态（6a + 6b 合并视图），并在每个子任务前标注归属。

### 任务 6.1 — Store 集成 Server-first 模式 `6a + 6b`

修改 `src/stores/metadata.ts`，新增：

- State（**6a 必做**）：
  - `currentWorkspaceId: Ref<string | null>`
  - `serverVersion: Ref<number>`（workspace 级乐观锁版本号）
  - `serverRecordUpdatedAt: Ref<Map<string, string>>`（每条 record 的 updated_at，[M21] record 级乐观锁用）
  - `syncStatus: Ref<'synced' | 'local-only' | 'syncing' | 'offline' | 'conflict' | 'error'>`
  - `isOnline: Ref<boolean>`（监听 `online`/`offline` 事件维护）
  - `tabId: string`（sessionStorage 持久化的标签页唯一 id，[M4] 用，由 `useTabId` 提供）
- State（**6b 必做**）：
  - `knownTabIds: Ref<Set<string>>`（通过 `useStorageSync` 收集的本机同源标签页 id 集合）
- 编辑时仍写 localStorage（保证响应速度）+ 更新 `dirtyFields`（[M21] 用）
- 手动点击"同步到云端"或页面切走时 push 到 Supabase（**6a 仅手动同步**；**6b 加自动后台同步**）
- 加载时先还原 localStorage（即时渲染），后台 fetch 服务端版本
- 离线时只写 localStorage（`syncStatus = 'offline'`），联网后**6a 提示用户手动同步**；**6b 自动重放**（见任务 6.5）
- **冲突处理 6a**：PATCH/PUT 收到 409 → 一律进入 `syncStatus = 'conflict'`，让用户选择"覆盖远程/加载远程"。简单且确定。
- **冲突处理 6b（字段级合并）** [M21]：
  - workspace 级 409：响应体携带 `lastWriterTabId`（服务端从上次成功写入的 `X-Client-Tab-Id` 请求头记录）+ `currentData`
  - 若 `lastWriterTabId ∈ knownTabIds` → 多标签页冲突：fetch 最新 records 后，按 `changedFields` 键集合判断
    - 本地 dirty 字段集 ∩ 远程已变字段集 == ∅ → 自动合并，重新发起 PATCH
    - 交集非空 → 升级为 `syncStatus = 'conflict'`，UI 高亮冲突字段
  - 否则视为跨设备冲突，直接进入 `syncStatus = 'conflict'`
  - record 级 409（`expectedRecordUpdatedAt` 不一致）：同样按 changedFields 判断字段级冲突

### 任务 6.2 — 同步状态 UI `6a`

MetadataPage.vue 工具栏新增状态指示：

| 状态 | 显示 |
|------|------|
| synced | 绿点 "已同步" |
| local-only | 黄点 "仅本地" |
| syncing | 旋转 "同步中" |
| offline | 灰点 "离线" |
| conflict | 红点 "版本冲突" + 操作按钮 |
| error | 红点 "同步失败" + 重试 |

### 任务 6.3 — localStorage → Supabase 数据迁移 `6a`

首次登录且 Supabase 无工作区、但 localStorage 有数据时：
- 调 `POST /metadata/workspaces/migrate` 走服务端单事务创建 workspace + 批量导入
- 函数内写入 `seed_from_local_at` 作为幂等标记，防止重复迁移
- Toast："本地数据已迁移到云端"

### 任务 6.4 — 修订不可变性 + 登出清理 `6a`

- 数据库层：revisions 只有 SELECT + INSERT RLS
- 前端"编辑修订"改为"创建修正修订"（`type: 'correction'`）
- 保存时 PG function（[M20]）自动捕获 record snapshot
- **登出清理**（独立验收点）：
  - 在 `src/stores/auth.ts` 注册一个 `onLogout` 事件总线（如简单的 `EventTarget` 或基于 nanoevents）
  - `metadata.ts` 在 `setup()` 时订阅 `onLogout` 事件并调用 `$reset()`
  - **避免**原方案的"动态 import 避免循环依赖"做法（code smell）
  - auth store 暴露 `subscribeLogout(cb)` API，所有需要清理的 store 显式订阅

### 任务 6.5 — 离线队列重放 `6b`（[M22]）

实现 `src/features/metadata/offlineReplay.ts`：

- `isOnline` 从 false 转 true 时触发
- fetch 服务端最新 workspace（拿 `version` + 所有 record `updated_at`）
- 与本地 store 做 record 级 diff，构造 **一个** PATCH payload（含所有本地 creates / upserts / deletes）
- PATCH 中插入一条 `type: 'bulk_offline_replay'` 的 revision，`revisionNote` 携带摘要（操作数、最早/最晚时间戳、影响 record ids）
- 重放成功 → `syncStatus = 'synced'`；失败（409）→ 进入 `conflict` 流程

**验收**：
- **6a**：乐观锁、跨设备冲突 UI、数据迁移幂等、修订不可删改、登出清理
- **6b**：6a 全部 + 字段级合并、离线重放、knownTabIds 收集

**关键约束**：
- [M4] 多标签页 vs 跨设备区分通过 409 响应体中的 `lastWriterTabId`（服务端记录的上次写入标签页 id）+ `useStorageSync` 收集的本机 tabId 集合协同判定。`useTabId`（Step 3.2 已引入）提供标签页 id，请求时通过 `X-Client-Tab-Id` 头传递给服务端。
- [M5] undo/redo 执行后**强制** `syncStatus = 'local-only'` 并在 UI 提示"已撤销，云端仍是旧版本"，**同时暂停自动同步定时器 5 秒**（仅 6b 有自动同步定时器；6a 阶段此约束退化为"undo 后保持 local-only"）。
- [M7] 数据迁移幂等以**服务端 `seed_from_local_at`** 为权威标记；前端 `localStorage.migrated` 仅快路径优化。前端**必须**收到 2xx 后才写 migrated 标记。
- [M8] 日常编辑走 PATCH，**不要**因为方便而 PUT 整存。
- [M15] DELETE 工作区是软删（API 层透传），前端 7 天内提供恢复入口。
- [M21] 字段级合并依赖 `dirtyFields`（Step 2.2 定义）。store 不维护 `dirtyFields` 时 6b 的合并能力无效。
- [M22] 离线重放合并为单次 PATCH + 摘要 revision，不按序逐条回放。
- 登出清理：用 `subscribeLogout()` 事件总线，**禁止**动态 import 反向调用。**此条独立成一个验收点，不可遗漏**。

**Step 6 关键验证 case**：
1. **多标签页同字段并发（6b）**：两个标签页同时改 record A 的 `zhName` → 后者字段级合并失败 → 进入冲突 UI；
2. **多标签页不同字段并发（6b）**：A 改 record A 的 zhName，B 改同一 record 的 length → 自动合并成功（changedFields 键不相交），无 409 提示；
3. **跨设备并发（6a + 6b）**：A 设备改 record，B 设备同时改同一 record → B 弹出"覆盖/加载"冲突 UI；
4. **迁移幂等（6a）**：清前端 `migrated` 后再次进入页面，服务端不重复创建 workspace；
5. **修订不可删（6a）**：从前端尝试 update/delete metadata_revisions 应被 RLS 拒绝（用 Supabase JS client 直连验证）；
6. **登出清理（6a）**：登出后切到登录页再回来，新用户看不到上一个用户的 metadata 缓存；
7. **离线重放（6b）**：断网编辑 10 条 records，恢复在线后生成一条 PATCH + bulk_offline_replay revision，重放成功；
8. **离线重放冲突（6b）**：断网编辑期间云端被其他设备改了 → 重放时 409 → 进入冲突流程。

---

## Step 7：扩展 Edge Function 路由 `M`

在 Step 5 最小闭环（GET×2 + PUT + PATCH + rebalance）基础上补充：

| Method | Path | 说明 |
|--------|------|------|
| `POST` | `/metadata/workspaces` | 新建工作区 |
| `DELETE` | `/metadata/workspaces/:id` | 软删工作区（写 `deleted_at`，不直接物理删） |
| `POST` | `/metadata/workspaces/:id/restore` | 7 天内恢复软删 |
| `POST` | `/metadata/workspaces/:id/import` | 服务端导入 |
| `POST` | `/metadata/workspaces/migrate` | localStorage 一次性迁移（Step 6.3 调用） |
| `GET` | `/metadata/workspaces/:id/revisions` | 修订时间线（**复合 cursor 分页**：`?record_id=&after=<base64(created_at|id)>&limit=50`，默认按 `created_at desc, id desc`，[M28]） |

前端 API 层补齐方法：`createWorkspace`、`deleteWorkspace`、`restoreWorkspace`、`importToWorkspace`、`migrateFromLocal`、`getRevisionTimeline({ recordId?, after?: string, limit? })`。`after` 是不透明字符串，UI 层不解读。

**验收**：全部路由跑通，API 层补齐对应方法

**关键约束**：
- [M15] DELETE 仅写 `deleted_at = now()`，**禁止**物理删除（pg_cron 在 Step 4 已配置 7 天后清理）。
- `restore` 路由需校验 `deleted_at IS NOT NULL AND deleted_at > now() - interval '7 days'`，超期视为已彻底删除。
- `migrate` 路由内整事务执行 workspace + records + revisions 写入（由 PG function 完成，[M20]），写入末尾 `UPDATE workspaces SET seed_from_local_at = now()`，事务失败整体回滚（[M7]）。
- [M28] revisions cursor 必须为复合 cursor `(created_at desc, id desc)` 的 base64 编码；服务端解码后查询 `where (created_at, id) < ($created_at, $id)`。仅基于 UUID id 的 cursor 在同毫秒并发时会丢数据。

---

## Step 8：核心功能补齐 `L`

**依赖说明** [⑥]：
- 任务 8.2 / 8.3 / 8.4 仅依赖 Step 2 完成，三者可并行。
- **任务 8.1（撤销/重做）依赖 Step 6 完成**，因 [M5] 要求 undo/redo 触发 store 的 `syncStatus = 'local-only'` + 自动同步暂停，行为定义在 Step 6.1。在 Step 6 上线前不要做 8.1。

### 任务 8.1 — 撤销/重做

- 新建 `src/features/metadata/undoRedo.ts`（**diff-based** 快照栈，深度 20，[M30]）
- 新建 `src/composables/useUndoRedo.ts`（响应式包装）
- Store 每次变更前 push **diff entry**（`{ type: 'update' | 'create' | 'delete' | 'batch', recordId, before?, after?, changedFields? }`），**不**克隆整个 store state
- 批量操作（任务 8.2）折叠为一个 `batch` entry，undo 时按逆序应用子 entry
- undo/redo 只影响本地，不触发同步
- 工具栏添加撤销/重做按钮
- 仅内存驻留，刷新清空

### 任务 8.2 — 批量操作

- 新建 `src/composables/useRowSelection.ts`
- 表格首列加 checkbox，选中后浮动操作栏：批量删除 + 批量改类型
- 一次批量操作 = 一个 undo 快照

### 任务 8.3 — CSV/JSON 导入

- 新建 `src/features/metadata/import.ts`（parseCSV、parseJSON、validateImportRecords、mergeRecords）
- 新建 `src/composables/useFileImport.ts`
- 新建 `MetadataImportModal.vue`（BaseModal：文件选择、预览、校验、合并策略）
- 合并策略：替换全部 / 追加 / 按字段名合并

### 任务 8.4 — 表头排序 + 类型筛选

- 新建 `src/composables/useTableSort.ts`
- 表头 zhName、fieldName、attrType 可点击排序
- 搜索栏旁加 attrType 筛选下拉（复用 FormSelect）

**验收**：各功能手动验证 + 纯逻辑模块编写测试

**关键约束**：
- [M11] Undo 栈**仅驻留内存**（不写 localStorage、不同步服务端），刷新即清空；最大深度 **20**；切换 workspace 时 `clear()` 防止跨 workspace 误用。
- [M30] Undo 栈用 **diff-based** entry（单 entry < 1KB），**禁止**克隆整个 store state（500 records × 20 深度会占 500MB 量级内存）。批量操作折叠为一个 `batch` entry。
- [M5] undo/redo 后由 Step 6 的 store 触发 `local-only` 状态与自动同步暂停（本任务只调用，行为定义在 Step 6）。
- 批量操作（任务 8.2）= **一个** undo 快照，保证 ctrl+z 一次性回滚整个批量动作。
- CSV/JSON 导入合并策略落地后，必须走 `validateImportRecords` 全量校验通过才能写入；空 fieldName 行可导入但参与 [M14] 的空值豁免规则。
- **导入与 fractional indexing 衔接** [⑩]：用户上传文件无 `displayOrder` 字段，导入器按以下策略生成：
  - **替换全部**：按数组顺序生成 `1.0, 2.0, 3.0, …`
  - **追加**：取当前最大 `displayOrder + 1` 后顺延
  - **按字段名合并**：existing record 的 `displayOrder` 保持不变；新增 record 走"追加"规则
- 表头排序（任务 8.4）是**纯前端 sort**，不改 `display_order`；用户拖动排序才修改 `display_order`（计算职责见 Step 2.2 / Step 5）。

---

## Step 9：UI/UX 优化 `M`

### 任务 9.1 — 表格列可收缩

- 工具栏"列设置"下拉，可隐藏 length、standardCode
- `< 1440px` 默认隐藏
- 用 CSS class toggle，不影响连接线

### 任务 9.2 — 移动端卡片视图

- 新建 `src/composables/useBreakpoint.ts`
- 新建 `MetadataCardView.vue`
- `< 768px` 切换为卡片视图

### 任务 9.3 — 修订面板时间线

- 修订数 > 3 时切换为垂直时间线（竖线 + 圆点）
- 修订类型用不同颜色标记（create/update/delete/correction）
- 修订数 ≤ 3 保持 pill 标签

### 任务 9.4 — 键盘快捷键

- 新建 `src/composables/useTableKeyboard.ts`
- Tab/Shift+Tab 切换单元格，Enter 提交，Escape 取消
- Ctrl+Z / Ctrl+Shift+Z 撤销重做（依赖 8.1）

**关键约束**：
- 任务 9.1 列隐藏**必须**用 `visibility: hidden`（保留 DOM 占位）或 `width: 0; overflow: hidden`，**禁止** `display: none` 与 `v-if`——`useConnectorLines` 基于 DOM `getBoundingClientRect()` 计算，DOM 被移除或 rect 归零会导致连接线错位。如需彻底回收宽度，需在 toggle 后手动触发 connector 重算钩子。
- 任务 9.2 卡片视图切换通过 `<768px` 媒体查询触发，编辑能力与表格视图完全对等（同一 store、同一 validation）。
- 任务 9.4 键盘事件**仅在** MetadataPage 激活时监听，组件卸载必须 `removeEventListener`；Ctrl+Z 在输入框聚焦时不应触发全局 undo（仅触发输入框原生 undo）。

---

## Step 10：高级功能（按需做）`L`

优先级从高到低排列，每个独立可发布。

### 任务 10.1 — 枚举值管理

attrType 为 `enum` 时可编辑枚举值列表。DB 已预留 `enum_values jsonb`。新建 `EnumEditorModal.vue`。

### 任务 10.2 — 字段关系标记

PK/FK/索引/必填标记。DB 已预留 `is_primary_key`、`is_indexed`、`is_required`、`foreign_key`。fieldName 旁显示图标徽标。

### 任务 10.3 — 版本对比 Diff

新建 `src/features/metadata/diff.ts` + `DiffModal.vue`。利用 revision.snapshot 做双栏对比。旧修订无快照时显示"不可用"。

### 任务 10.4 — 修订更正（替代删除）

用户不能删除修订（审计不可变）。需要"撤回"时创建 `type: 'correction'` 修订。

**关键约束**：
- 任务 10.1 `enum_values jsonb` 结构遵循 [M12 / 决策文档] 预定义：`[{ "value": string, "label"?: string }]`。Edge Function validator **必须**拒绝其它形态（如纯字符串数组）。
- 任务 10.2 字段关系所有 PK/FK/索引/必填字段在 Step 4 已经预留（`is_primary_key`、`is_indexed`、`is_required`、`foreign_key`），本任务**不需要** migration。
- 任务 10.2 `foreign_key jsonb` 写入必须符合 [M12] 预定义 schema；validator 必须校验该结构。
- 任务 10.3 Diff 在 revision 无 snapshot 时（即 Step 6.4 前的旧数据 或 [M9] 已清理的超期数据）显示"快照不可用"，**禁止**报错。
- 任务 10.4 `type: 'correction'` 修订与原修订共享 `record_id_snapshot`，UI 时间线需将 correction 紧邻其更正的修订显示；服务端写入 correction 时按 Step 5 关键约束的 snapshot 规则填充。

---

## 通用验收标准

每个 Step 完成后执行：

```bash
pnpm typecheck && pnpm lint && pnpm check:css-colors && pnpm check:utf8 && pnpm test
```

性能基线（500 条记录工作区，**热启动**测量——排除 Edge Function 冷启动延迟；所有阈值为 p95，[M29]）：

| 场景 | 基线 | 测量条件 |
|------|------|---------|
| 页面加载 | < 1s | 单用户 |
| 单条编辑响应 | < 50ms | 单用户，本地（无网络） |
| **PUT 整存**（首次/导入）| < 2s p95 | 单用户 |
| **PATCH 单字段** | < 500ms p95 | 单用户 |
| **PATCH 单字段（并发）** | < 1s p95 | **100 并发用户**，Step 5 之后必测 |
| **PATCH 批量 20 条** | < 1s p95 | 单用户 |
| **POST rebalance** | < 1.5s p95 | 单用户 |
| localStorage 写入 | < 150ms | 单用户 |

并发基线脚本使用 [k6](https://k6.io/) 或同类工具，放 `tests/perf/metadata.k6.js`。单用户基线脚本放 `tests/perf/metadata.bench.mjs`。

> **Edge Function 冷启动说明**：Supabase Edge Function（Deno Deploy）冷启动通常在 200–500ms。上述基线以热启动为前提。首次请求的端到端延迟 = 冷启动 + 业务逻辑，可能超过基线值。建议：(1) 性能测试脚本先发一个预热请求再采集数据；(2) 若冷启动严重影响用户体验，后续可考虑 keep-alive 定时心跳（如每 4 分钟发一次轻量 GET）。

任一项不达标视为该 Step 未完成。基线脚本：单用户 `tests/perf/metadata.bench.mjs`，并发 `tests/perf/metadata.k6.js`。

---

## 自动化测试策略

每个 Step 除手动验证外，必须交付对应的自动化测试。测试文件放在 `tests/` 目录下，命名与模块对应。

| Step | 必须交付的测试 | 文件 |
|------|---------------|------|
| Step 1 | `uuid()` 兜底覆盖率（mock 掉 `crypto.randomUUID` 验证 fallback 路径）、`fieldName` 唯一性校验（含空值豁免）| `tests/metadata-validation.mjs` |
| Step 2 | fractional indexing 计算（中点、首尾、精度耗尽检测）、`order` string→number 旧数据兼容、`schemaVersion` 版本分支（缺、=2、>2）、`dirtyFields` 追踪 | `tests/metadata-store.mjs` |
| Step 3 | localStorage 字节计算精度、storage 事件 tabId 过滤 | `tests/metadata-storage.mjs` |
| Step 5 | Edge Function 集成测试：PG function 事务原子性（[M20] 中途强杀回滚）、upsert + diff + revision 生成、乐观锁 409、record 级乐观锁、字段级合并、rebalance、RLS 隔离（含 [M26] user_id 列）、CORS preflight 含 `X-Client-Tab-Id` | `tests/metadata-api.mjs` + `tests/perf/metadata.k6.js` |
| Step 6 | syncStatus 状态机转换（6 种状态全覆盖）、迁移幂等性、冲突分流（多标签页 vs 跨设备）、字段级合并自动 vs 冲突 UI 升级、离线重放（[M22]）、登出事件总线触发 reset | `tests/metadata-sync.mjs` |
| Step 7 | revisions 复合 cursor 分页同毫秒边界（[M28]）、软删 7 天恢复窗口 | `tests/metadata-revisions.mjs` |
| Step 8 | undo/redo diff-based 栈（[M30] 内存占用、深度 20 溢出、切 workspace 清空、batch 逆序）、CSV/JSON 导入校验、批量操作回滚 | `tests/metadata-features.mjs` |

"手动验证"仅作为自动化测试的补充，不能替代。

---

## 文件总览

```
新建后端文件：
  supabase/migrations/202605xxNNNN_create_metadata_tables.sql
  supabase/migrations/202605xxNNNN_create_metadata_functions.sql   ← [M20] PG function 包装事务
  supabase/functions/metadata/{index,handler,validator}.ts + config.toml

新建前端文件：
  src/lib/uuid.ts                                                  ← [M24] UUID 工具兜底
  src/stores/metadata.ts
  src/api/metadata.ts
  src/features/metadata/{storageMonitor,undoRedo,import,diff,sampleData,offlineReplay}.ts
                                                                    └─ offlineReplay [M22] 6b 阶段
  src/composables/{useTabId,useStorageSync,useUndoRedo,useRowSelection,useFileImport,
                    useTableSort,useBreakpoint,useTableKeyboard}.ts
  src/components/.../modals/{MetadataImportModal,EnumEditorModal,DiffModal}.vue
  src/components/.../MetadataCardView.vue

主要修改文件（按 Step 分解）：
  src/stores/workbench.ts                 Step 2 删除元数据代码
  src/composables/useMetadataValidation.ts Step 1.2 加 fieldName 唯一性
  src/features/metadata/export.ts          Step 2 类型导入改为新 store
  supabase/functions/_shared/cors.ts       Step 5 加 X-Client-Tab-Id 到 Access-Control-Allow-Headers [M23]
  supabase/functions/_shared/operation-logger.ts Step 5 ALLOWED_OPERATIONS 加 3 个操作名
  src/stores/auth.ts                       Step 6.4 加 subscribeLogout 事件总线（替代动态 import 反向调用）
  src/components/.../pages/MetadataPage.vue：
    Step 1.2  接入唯一性校验 props
    Step 3    顶部加容量警告 / 多标签页冲突横幅
    Step 3.3  空状态接入 StatePanel + 示例数据
    Step 6.2  工具栏加同步状态指示 + "同步到云端"按钮
    Step 7    "新建/删除/恢复工作区"入口
    Step 8.1  工具栏加 undo/redo 按钮
    Step 8.2  首列加 checkbox + 浮动批量操作栏
    Step 8.3  工具栏加"导入"按钮
    Step 8.4  表头排序 + attrType 筛选下拉
    Step 9.1  工具栏加"列设置"
    Step 9.2  <768px 切换 MetadataCardView
    Step 9.3  修订面板时间线
```
