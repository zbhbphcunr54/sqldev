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

**`order: string` → `displayOrder: number` 类型迁移**：
- 现有 `MetadataRecord.order` 是字符串类型（`"1"`, `"2"`, …），新 store 改为 `displayOrder: number`（为 fractional indexing 做准备）。
- `getMetadataCache()` 加载旧数据时，对每条 record 执行 `displayOrder = Number(record.order) || index + 1`（兼容 NaN / 空值）。
- 序列化到 localStorage 时直接写 `displayOrder: number`，不再保留 `order` 字段。
- 首次加载完成后自动触发一次 `persistMetadataCache()` 将旧格式覆盖为新格式（一次性迁移）。

**fractional indexing 计算职责**（[M3] 实施细节）：
- 拖动排序 / 新增 / 批量插入时，store action 计算 `displayOrder = (prevRecord.displayOrder + nextRecord.displayOrder) / 2`（首条用 `next - 1`，末条用 `prev + 1`）。
- 计算后立即触发本地写入；服务端写入由 Step 5/6 的同步逻辑接管。
- store 检测到 `Math.abs(next - prev) < 1e-6` 时**不本地兜底**，直接走"调用 rebalance 路由"分支（Step 5 提供）。

**验收**：功能与重构前完全一致，增删改查、排序、导出均正常

**关键约束**：
- localStorage key `sqldev:workbench:metadata` **不变**，保证旧用户数据无缝过渡到新 store。
- 对外只暴露 `computed` 的有序数组，模板层不感知内部 `Map + recordOrder` 结构；内部数据结构变更不应导致模板回归。

---

## Step 3：前端数据层加固 `M`

三个独立小任务，Step 2 完成后可并行做。

### 任务 3.1 — localStorage 容量监控

- 新建 `src/features/metadata/storageMonitor.ts`（纯函数）
- 遍历 `localStorage` 所有 key，按 UTF-16 编码（每字符 2 字节）计算已用字节：`Object.keys(localStorage).reduce((sum, k) => sum + (k.length + localStorage.getItem(k)!.length) * 2, 0)`
- 以 5MB（5 × 1024 × 1024 字节）为假设配额上限（主流浏览器的默认 localStorage 限额），按比例计算：60% 警告、80% 危险
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

### 任务 4.1 — Migration 文件

新建 `supabase/migrations/202605xxNNNN_create_metadata_tables.sql`，包含 3 张表：

**`metadata_workspaces`**：
- UUID PK、`user_id` FK、`name`、`version`（乐观锁）、`last_writer_tab_id text`（最近写入的标签页 id，用于 409 冲突分流）、`deleted_at`（软删）、`seed_from_local_at`（迁移标记）
- RLS：own-row CRUD（`auth.uid() = user_id`，过滤 `deleted_at is null`）

**`metadata_records`**：
- UUID PK、`workspace_id` FK、`display_order numeric`（fractional indexing）
- 业务字段：`zh_name`、`field_name`、`attr_type`、`length`、`standard_code`、`business_desc`
- 预留字段：`enum_values jsonb`、`is_primary_key`、`is_indexed`、`is_required`、`foreign_key jsonb`
- 部分唯一索引：`(workspace_id, field_name) where field_name <> ''`
- RLS：通过 workspace 的 user_id 关联

**`metadata_revisions`**：
- UUID PK、`record_id` FK（ON DELETE SET NULL）+ `record_id_snapshot uuid`（删除前备份）
- `workspace_id` FK、`version`、`revision_note`、`author`、`type`、`snapshot jsonb`
- RLS：仅 SELECT + INSERT（审计不可变）
- `record_id` 索引 + `created_at` 索引（清理用）

附带 pg_cron 任务：清理 7 天前软删的 workspace + 清理超期 snapshot。

**验收**：`supabase db reset` 成功，`supabase gen types typescript` 重新生成类型文件

**关键约束**：
- [M1] migration 文件名格式 `202605xxNNNN_*.sql`（12 位数字无下划线），顺延仓库最新一条 `202605180007_*`。
- [M2] `metadata_revisions.record_id` **必须** `ON DELETE SET NULL`（**禁止** `cascade`），并冗余 `record_id_snapshot uuid not null` + `field_name_snapshot text` 用于历史追溯。这是审计不可篡改的硬保证。
- [M3] `display_order numeric not null`（**禁止** `integer`），用 fractional indexing。
- [M9] pg_cron 清理超期 snapshot 的 schedule 见决策文档（每月 1 号 03:00 UTC）。
- [M12] `foreign_key jsonb` 字段结构在 column comment 中预定义（`{refTable, refField, onDelete, displayLabel?}`），避免 Phase 10.2 时再加 migration。
- [M13] `supabase gen types typescript > src/types/supabase.ts` 是本 Step **硬交付物**，未生成视为 Step 4 未完成。
- [M14] 部分唯一索引 `where field_name <> ''`，允许空字符串重复。
- [M15] `metadata_workspaces` 必须有 `deleted_at` 字段；所有读取路径必须过滤 `deleted_at is null`（无论 RLS 还是 API 层）。

**回滚预案**：准备一份 down migration（`drop table metadata_revisions, metadata_records, metadata_workspaces cascade`）。生产环境出现严重问题时前端可降级回 localStorage-only 模式（Step 6 之前的状态）。

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

**前置修改**：`_shared/operation-logger.ts` 的 `ALLOWED_OPERATIONS` 白名单需新增 `metadata_save`、`metadata_patch`、`metadata_rebalance` 三个操作名，否则运行时写入日志会被拒绝。

### 任务 5.2 — 前端 API 层

新建 `src/api/metadata.ts`，用 `edgeFn` 封装上述 5 个路由：`listWorkspaces`、`getWorkspace`、`saveWorkspace`（PUT）、`patchWorkspaceRecords`（PATCH）、`rebalanceWorkspace`（POST rebalance）。

**Case 转换约定 [⑪]**：snake_case ↔ camelCase 转换**统一在本 API 层完成**。store / UI / composables 全程使用 camelCase；Edge Function / DB / migration 全程使用 snake_case。除本文件外其它任何位置出现混用视为 bug。**注意**：此约定仅适用于 `src/api/metadata.ts`，不改动现有其他 API 模块（如 `sql-convert.ts`、`feedback.ts` 等仍保持各自现有风格）。

**验收**：`supabase functions serve metadata` 本地跑通 GET/PUT/PATCH/rebalance；RLS 验证用户隔离

**关键约束**：
- [M2] 写入器**禁止**手动 `DELETE FROM metadata_revisions WHERE record_id IN ...`。FK 是 `SET NULL`，会自动置空，手动删等于破坏审计。
- [M2] 写入器**禁止** `DELETE FROM metadata_records WHERE workspace_id = :id` 整表删；必须 upsert + diff。
- record 的新 id **由前端 UUID 生成**（`crypto.randomUUID()`，对齐 Step 1.1），便于前端乐观渲染；服务端不重新分配 id。
- [M8] 日常编辑（Step 6 调用）走 PATCH；PUT 仅用于首次保存与导入（Step 7）。
- 乐观锁：PUT/PATCH 入口都必须 `SELECT version, last_writer_tab_id FOR UPDATE` 比对 `expectedVersion`，不一致时返回 409 + `{ currentVersion, currentData, lastWriterTabId }`。写入成功时更新 `version = version + 1` 和 `last_writer_tab_id = 请求头 X-Client-Tab-Id`。
- 所有读取路径**必须**过滤 `deleted_at is null`（[M15]）。
- **snapshot 填充责任** [③]：`revisions.snapshot` 由 Edge Function 在写入事务内填充，前端 payload **不传** snapshot 字段：
  - `create` / `update`：upsert 完成后 `SELECT` 取最终 record 全字段写入 snapshot；
  - `delete`：先 `SELECT INTO` 拿到完整 row，再 DELETE，最后将暂存 row 作为 snapshot；
  - `correction`：前端 body 必须携带 `corrects: revisionId`，服务端从该 revision 拷贝 snapshot 后再覆盖业务字段。
- **fractional indexing 落地分工** [②]：display_order 由**前端 store 计算**（Step 2.2 已定义）；服务端只做范围校验（`> 0`、相邻 record 间距 ≥ 1e-6），精度耗尽返回 `422 PrecisionExhausted`，由专用 `POST rebalance` 路由整 workspace 重排。
- **operation_logs** [⑤]：每次 PUT/PATCH/rebalance 在事务提交后写一条 `operation_logs`，操作名分别为 `metadata_save`、`metadata_patch`、`metadata_rebalance`，载荷 `{workspaceId, upsertCount, deleteCount, revisionCount, version}`；审计与性能监控依赖此日志。
- **rate-limit** [⑨]：复用 `_shared/rate-limit.ts`，三个路由分别限速 `PATCH: 60/min/user`、`PUT: 10/min/user`、`POST rebalance: 5/min/user`。GET 路由不限。

**Step 5 关键验证 case**：
1. RLS：用户 A 拿不到用户 B 的 workspace；
2. PATCH 删除一条 record 后，`select * from metadata_revisions where record_id_snapshot = :id` 仍能取到完整修订，且 `record_id IS NULL`、`snapshot` 非空；
3. 同一 record 同时被两个标签页 PATCH，后到者收到 409 + `{ currentVersion, currentData, lastWriterTabId }`；前端通过比对 `lastWriterTabId` 判定冲突来源；
4. **性能基线** [④]：
   - PUT 500 records workspace 端到端 < **2s**（首次保存/导入路径）
   - PATCH 单字段修改 < **500ms**（日常路径）
   - PATCH 批量 20 条变更 < **1s**
   - POST rebalance 500 records < **1.5s**
5. fractional indexing：连续 60 次在同一相邻位置插入新 record，第 ~50 次后写入器返回 422，前端自动 rebalance 后重试成功；
6. **rebalance 并发**：两个标签页同时调用 rebalance，先到者成功（version bump），后到者收到 409 后 fetch 最新数据并重试原始写入（不重试 rebalance）；
7. operation_logs：每次写入路由后均产生一条对应操作名的日志记录。

---

## Step 6：后端 — Store 双层架构 `XL`

### 任务 6.1 — Store 集成 Server-first 模式

修改 `src/stores/metadata.ts`，新增：

- State：
  - `currentWorkspaceId: Ref<string | null>`
  - `serverVersion: Ref<number>`（乐观锁版本号）
  - `syncStatus: Ref<'synced' | 'local-only' | 'syncing' | 'offline' | 'conflict' | 'error'>` — 6 种状态与任务 6.2 UI 表一一对应
  - `isOnline: Ref<boolean>`（监听 `online`/`offline` 事件维护）
  - `tabId: string`（sessionStorage 持久化的标签页唯一 id，[M4] 用）
- 编辑时仍写 localStorage（保证响应速度）
- 手动点击"同步到云端"或页面切走时 push 到 Supabase
- 加载时先还原 localStorage（即时渲染），后台 fetch 服务端版本
- 离线时只写 localStorage（`syncStatus = 'offline'`），联网后自动推送
- **冲突处理（统一入口）** [①]：PATCH/PUT 收到 409 时，响应体携带 `lastWriterTabId`（服务端从上次成功写入的 `X-Client-Tab-Id` 请求头中记录）。store 判定逻辑：
  - 若 `lastWriterTabId` 与本机任一已知 tabId 匹配（通过 `useStorageSync` 的 storage 事件收集同源标签页 id 集合）→ 视为多标签页冲突，自动 `fetchFromServer` + record 级 `updated_at` 合并；仅在同字段同时编辑时升级为冲突 UI（`syncStatus = 'conflict'`）。
  - 否则视为跨设备冲突，直接进入 `syncStatus = 'conflict'`，让用户选择"覆盖远程/加载远程"。
- **不再依赖时间窗口猜测**——冲突来源由服务端返回的 `lastWriterTabId` 确定性判断。

### 任务 6.2 — 同步状态 UI

MetadataPage.vue 工具栏新增状态指示：

| 状态 | 显示 |
|------|------|
| synced | 绿点 "已同步" |
| local-only | 黄点 "仅本地" |
| syncing | 旋转 "同步中" |
| offline | 灰点 "离线" |
| conflict | 红点 "版本冲突" + 操作按钮 |
| error | 红点 "同步失败" + 重试 |

### 任务 6.3 — localStorage → Supabase 数据迁移

首次登录且 Supabase 无工作区、但 localStorage 有数据时：
- 服务端单事务创建 workspace + 批量导入
- 写入 `seed_from_local_at` 作为幂等标记，防止重复迁移
- Toast："本地数据已迁移到云端"

### 任务 6.4 — 修订不可变性

- 数据库层：revisions 只有 SELECT + INSERT RLS
- 前端"编辑修订"改为"创建修正修订"（`type: 'correction'`）
- 保存时 Edge Function 自动捕获 record snapshot
- 登出清理：`resetSensitiveClientState()` 增加 metadata store reset

**验收**：乐观锁、离线降级、数据迁移幂等、修订不可删改

**关键约束**：
- [M4] 多标签页 vs 跨设备区分通过 409 响应体中的 `lastWriterTabId`（服务端记录的上次写入标签页 id）+ `useStorageSync` 收集的本机 tabId 集合协同判定。`useTabId`（Step 3.2 已引入）提供标签页 id，请求时通过 `X-Client-Tab-Id` 头传递给服务端。
- [M5] undo/redo 执行后**强制** `syncStatus = 'local-only'` 并在 UI 提示"已撤销，云端仍是旧版本"，**同时暂停自动同步定时器 5 秒**，避免误覆盖远程已 push 版本。
- [M7] 数据迁移幂等以**服务端 `seed_from_local_at`** 为权威标记；前端 `localStorage.migrated` 仅快路径优化。前端**必须**收到 2xx 后才写 migrated 标记。
- [M8] 日常编辑走 PATCH，**不要**因为方便而 PUT 整存。
- [M15] DELETE 工作区是软删（API 层透传），前端 7 天内提供恢复入口。
- 登出清理：在 `auth.ts` 的 `resetSensitiveClientState()` 中调用 `useMetadataStore().$reset()`（动态 import 避免循环依赖）。**此条独立成一个验收点，不可遗漏**。

**Step 6 关键验证 case**：
1. **多标签页同字段并发**：两个标签页同时改 record A 的 `zhName` → 后者自动合并失败 → 进入冲突 UI；
2. **多标签页不同字段并发**：A 改 record A，B 改 record B → 自动合并成功，无 409 提示；
3. **跨设备并发**：A 设备改 record，B 设备同时改同一 record → B 弹出"覆盖/加载"冲突 UI；
4. **迁移幂等**：清前端 `migrated` 后再次进入页面，服务端不重复创建 workspace；
5. **修订不可删**：从前端尝试 update/delete metadata_revisions 应被 RLS 拒绝（用 Supabase JS client 直连验证）；
6. **登出清理**：登出后切到登录页再回来，新用户看不到上一个用户的 metadata 缓存。

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
| `GET` | `/metadata/workspaces/:id/revisions` | 修订时间线（cursor 分页：`?record_id=&after=<revision_id>&limit=50`，默认按 `created_at desc`） |

前端 API 层补齐方法：`createWorkspace`、`deleteWorkspace`、`restoreWorkspace`、`importToWorkspace`、`migrateFromLocal`、`getRevisionTimeline({ recordId?, after?, limit? })`。

**验收**：全部路由跑通，API 层补齐对应方法

**关键约束**：
- [M15] DELETE 仅写 `deleted_at = now()`，**禁止**物理删除（pg_cron 在 Step 4 已配置 7 天后清理）。
- `restore` 路由需校验 `deleted_at IS NOT NULL AND deleted_at > now() - interval '7 days'`，超期视为已彻底删除。
- `migrate` 路由内整事务执行 workspace + records + revisions 写入，写入末尾 `UPDATE workspaces SET seed_from_local_at = now()`，事务失败整体回滚（[M7]）。

---

## Step 8：核心功能补齐 `L`

**依赖说明** [⑥]：
- 任务 8.2 / 8.3 / 8.4 仅依赖 Step 2 完成，三者可并行。
- **任务 8.1（撤销/重做）依赖 Step 6 完成**，因 [M5] 要求 undo/redo 触发 store 的 `syncStatus = 'local-only'` + 自动同步暂停，行为定义在 Step 6.1。在 Step 6 上线前不要做 8.1。

### 任务 8.1 — 撤销/重做

- 新建 `src/features/metadata/undoRedo.ts`（纯逻辑快照栈，深度 20）
- 新建 `src/composables/useUndoRedo.ts`（响应式包装）
- Store 每次变更前 push 快照；undo/redo 只影响本地，不触发同步
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

性能基线（500 条记录工作区，**热启动**测量——排除 Edge Function 冷启动延迟）：
- 页面加载 < 1s
- 单条编辑响应 < 50ms
- **PUT 整存（首次/导入）< 2s**
- **PATCH 单字段 < 500ms / PATCH 批量 20 条 < 1s**（日常路径，Step 5 之后必测）
- POST rebalance < 1.5s（Step 5 之后必测）
- localStorage 写入 < 150ms

> **Edge Function 冷启动说明**：Supabase Edge Function（Deno Deploy）冷启动通常在 200–500ms。上述基线以热启动为前提。首次请求的端到端延迟 = 冷启动 + 业务逻辑，可能超过基线值。建议：(1) 性能测试脚本先发一个预热请求再采集数据；(2) 若冷启动严重影响用户体验，后续可考虑 keep-alive 定时心跳（如每 4 分钟发一次轻量 GET）。

任一项不达标视为该 Step 未完成。基线脚本建议放 `tests/perf/metadata.bench.mjs`。

---

## 自动化测试策略

每个 Step 除手动验证外，必须交付对应的自动化测试。测试文件放在 `tests/` 目录下，命名与模块对应。

| Step | 必须交付的测试 | 文件 |
|------|---------------|------|
| Step 1 | `crypto.randomUUID()` 不碰撞、`fieldName` 唯一性校验（含空值豁免） | `tests/metadata-validation.mjs` |
| Step 2 | fractional indexing 计算（中点、首尾、精度耗尽检测）、`order` string→number 旧数据兼容 | `tests/metadata-store.mjs` |
| Step 3 | localStorage 字节计算精度、storage 事件 tabId 过滤 | `tests/metadata-storage.mjs` |
| Step 5 | Edge Function 集成测试：upsert + diff + revision 生成、乐观锁 409、rebalance、RLS 隔离 | `tests/metadata-api.mjs` |
| Step 6 | syncStatus 状态机转换（6 种状态全覆盖）、迁移幂等性、冲突分流（多标签页 vs 跨设备） | `tests/metadata-sync.mjs` |
| Step 8 | undo/redo 快照栈（深度 20 溢出、切 workspace 清空）、CSV/JSON 导入校验、批量操作回滚 | `tests/metadata-features.mjs` |

"手动验证"仅作为自动化测试的补充，不能替代。

---

## 文件总览

```
新建后端文件：
  supabase/migrations/202605xxNNNN_create_metadata_tables.sql
  supabase/functions/metadata/{index,handler,validator}.ts + config.toml

新建前端文件：
  src/stores/metadata.ts
  src/api/metadata.ts
  src/features/metadata/{storageMonitor,undoRedo,import,diff,sampleData}.ts
  src/composables/{useTabId,useStorageSync,useUndoRedo,useRowSelection,useFileImport,
                    useTableSort,useBreakpoint,useTableKeyboard}.ts
  src/components/.../modals/{MetadataImportModal,EnumEditorModal,DiffModal}.vue
  src/components/.../MetadataCardView.vue

主要修改文件（按 Step 分解）：
  src/stores/workbench.ts                 Step 2 删除元数据代码
  src/composables/useMetadataValidation.ts Step 1.2 加 fieldName 唯一性
  src/features/metadata/export.ts          Step 2 类型导入改为新 store
  src/stores/auth.ts                       Step 6.4 resetSensitiveClientState 加 metadata reset
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
