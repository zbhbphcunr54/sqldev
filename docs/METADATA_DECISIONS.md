# 元数据功能改进 — 决策记录

> 本文档是 `METADATA_IMPROVEMENT_PLAN.md`（执行清单）的姊妹篇。
> 清单负责"做什么"，本文档负责"为什么这样做"。
> 每条决策对应一个不可妥协的语义保证，落地时若与代码冲突，**以本文档为准**。

## 索引

| ID | 决策 | 实施位置（Step） |
|----|------|-----------------|
| [M1](#m1) | Migration 文件名 `YYYYMMDDNNNN_` 12 位数字 | Step 4 |
| [M2](#m2) | 写入用 upsert + diff；revisions FK 是 SET NULL | Step 4, 5 |
| [M3](#m3) | `display_order` 用 `numeric` fractional indexing | Step 4 |
| [M4](#m4) | 多标签页 vs 跨设备：tab id + storage 事件协同 | Step 6 |
| [M5](#m5) | Undo 后强制 `local-only` + 暂停自动同步 5s | Step 8.1 |
| [M6](#m6) | localStorage 阈值用配额比例（不硬编码字节） | Step 3.1 |
| [M7](#m7) | 数据迁移由服务端 `seed_from_local_at` 保证幂等 | Step 6.3 |
| [M8](#m8) | 日常编辑必须走 PATCH，PUT 仅首次/导入 | Step 5, 7 |
| [M9](#m9) | snapshot 由 pg_cron 清理 12 月以上 | Step 4 |
| [M10](#m10) | 跨标签页冲突横幅必须提供"先导出"按钮 | Step 3.2 |
| [M11](#m11) | Undo 栈仅内存、深度 20、刷新清空 | Step 8.1 |
| [M12](#m12) | `foreign_key` 与 `enum_values` jsonb 结构在 migration comment 预定义 | Step 4, 10.1, 10.2 |
| [M13](#m13) | `supabase gen types typescript` 是 Step 4 的硬交付 | Step 4 |
| [M14](#m14) | `fieldName === ''` 不参与唯一性校验 | Step 1.2, 4 |
| [M15](#m15) | workspace 软删 + pg_cron 7 天物理清理 | Step 4, 7 |
| [M16](#m16) | 同步状态 `offline` 与 `local-only` 独立 | Step 6.2 |
| [M17](#m17) | 每个 Step 必须交付对应自动化测试 | 全部 |
| [M18](#m18) | rebalance 受乐观锁保护，409 时不重试 rebalance | Step 5 |
| [M19](#m19) | revisions 时间线必须支持 cursor 分页 | Step 7 |
| [M20](#m20) | 核心写入逻辑必须用 PostgreSQL function 封装事务 | Step 4, 5 |
| [M21](#m21) | PATCH 必须传字段级 `changedFields`，不传整条 record | Step 5, 6 |
| [M22](#m22) | 离线队列重放合并为单个 PATCH + 摘要 revision | Step 6 |
| [M23](#m23) | CORS `Access-Control-Allow-Headers` 必须包含 `X-Client-Tab-Id` | Step 5 |
| [M24](#m24) | UUID 生成必须有 `crypto.randomUUID` 兜底 | Step 1.1, 2 |
| [M25](#m25) | localStorage payload 顶层必须带 `schemaVersion` | Step 2.2 |
| [M26](#m26) | `metadata_records` 冗余 `user_id` 列，RLS 不 JOIN workspace | Step 4 |
| [M27](#m27) | pg_cron 部署前置：自托管需 `CREATE EXTENSION`，Cloud 需 ≥ Pro | Step 4 |
| [M28](#m28) | Revisions cursor 必须为复合 cursor `(created_at desc, id desc)` | Step 7 |
| [M29](#m29) | 性能基线必须标注 p95 + 单用户/并发条件 | 全部 |
| [M30](#m30) | Undo 栈用 diff-based 而非完整快照 | Step 8.1 |

---

## <a id="m1"></a>M1 — Migration 命名

**决策**：使用 `202605xxNNNN_create_metadata_tables.sql` 格式，12 位数字无下划线，顺延仓库最新 `202605180007_*`。

**Why**：仓库现有约定如此（见 `supabase/migrations/`），早期方案中的 `YYYYMMDDNNNN_` 或纯 `NNNN_` 均为笔误。命名不一致会导致 migration 时序排错。

## <a id="m2"></a>M2 — 写入策略与 revisions FK

**决策**：服务端写入器**禁止** `DELETE FROM metadata_records WHERE workspace_id = :id`，必须用 `INSERT … ON CONFLICT (id) DO UPDATE` + `DELETE WHERE id = ANY(deletes)` 的 upsert + diff 模式。`metadata_revisions.record_id` 的外键策略为 `ON DELETE SET NULL`，并冗余 `record_id_snapshot uuid not null` + `field_name_snapshot text` 用于历史追溯。

**Why**：原方案的 "DELETE ALL + INSERT ALL" 会触发 cascade 删除全部修订，直接破坏方案标榜的"审计不可篡改"。SET NULL + 快照冗余既保留审计完整性，又允许 record 物理删除时 revision 仍可展示。

**落地约束**：写入器**不要**自己 `DELETE FROM revisions WHERE record_id IN ...`，FK 会自动置空，手动删等同破坏审计。

## <a id="m3"></a>M3 — display_order 用 fractional indexing

**决策**：`display_order numeric not null`（非 integer）。插入相邻两条之间取中点 `(prev + next) / 2`。精度耗尽（连续 ~50 次中点插入后 `next - prev < 1e-6`）时触发整 workspace rebalance（重新等距分配）。

**Why**：整数序号方案下任何 reorder 都要重写相邻多行，与 1A.2 "单条更新 O(1)" 目标矛盾。fractional indexing 是 Notion/Linear/Figma 标准做法。

**落地分工**：
- **前端 store**（Step 2.2）：拖动 / 新增 / 批量插入时计算 `(prev + next) / 2`；首条用 `next - 1`，末条用 `prev + 1`；不本地兜底精度耗尽。
- **服务端写入器**（Step 5）：校验范围（`> 0`、相邻间距 ≥ 1e-6），精度耗尽返回 `422 PrecisionExhausted` + rebalance hint。
- **rebalance 路由**（Step 5，`POST /workspaces/:id/rebalance`）：事务内 `UPDATE ... SET display_order = row_number()` 重新等距分配为 `1.0, 2.0, …`。
- **前端拦截器**：收到 422 时自动调 rebalance 后重试一次，仍失败进入 `error` 状态。
- **导入路径**（Step 8.3）：按合并策略生成 `displayOrder`，规则见任务 8.3 关键约束。

## <a id="m4"></a>M4 — 多标签页 vs 跨设备区分

**决策**：前端每个标签页生成唯一 `tabId`（sessionStorage，由 Step 3.2 的 `useTabId` 提供），请求头携带 `X-Client-Tab-Id`。服务端在每次成功写入时将该 tabId 记录到 `metadata_workspaces.last_writer_tab_id` 列。

收到 409 时，响应体携带 `lastWriterTabId`（上次成功写入的标签页 id），前端判定逻辑：
- 若 `lastWriterTabId` 与本机已知 tabId 集合匹配（通过 `useStorageSync` 的 storage 事件收集同源标签页 id）→ 视为多标签页冲突，触发 record 级 `updated_at` 自动合并。
- 否则视为跨设备冲突，弹"覆盖远程/加载远程" UI。

**Why**：原方案依赖"409 后 5 秒内是否有其他 tab 的 storage 事件"做概率性猜测——网络延迟抖动时容易误判（storage 事件先于 409 到达超过 5 秒 → 误判为跨设备冲突）。改用服务端返回的 `lastWriterTabId` 做确定性比对，消除时间窗口猜测的不可靠性。服务端仅做"记录 + 透传"，不承担判定职责，分层依然清晰。

## <a id="m5"></a>M5 — Undo 同步交互

**决策**：undo/redo 执行后**立即**将 `syncStatus` 置为 `local-only` 并在 UI 强提示："已撤销，云端仍是旧版本，请确认后同步"。自动同步定时器在 undo 后**暂停 5 秒**。

**Why**：避免以下故障：用户在标签页 A push 新版本 → 切到 B undo → B 的本地 version 是旧的 → 用户再 push → 409 → 用户选"覆盖远程" → 云端新版本被丢。强提示让用户察觉、暂停 5s 防止误触发自动同步。

## <a id="m6"></a>M6 — localStorage 容量阈值

**决策**：遍历 `localStorage` 所有 key，按 UTF-16 编码（每字符 2 字节）手动计算已用字节：`Object.keys(localStorage).reduce((sum, k) => sum + (k.length + localStorage.getItem(k)!.length) * 2, 0)`。以 5MB（5 × 1024 × 1024）为假设配额上限（主流浏览器默认限额），按比例计算：`>= 60%` 警告、`>= 80%` 危险。`metadata` key 字节数可单独计算并在元数据页面显示占比。

**Why**：`navigator.storage.estimate()` 返回的是 Storage API（IndexedDB、CacheStorage）的配额，**不包含 localStorage**——浏览器不暴露 localStorage 配额查询接口。早期方案误用了该 API。手动计算 + 5MB 假设上限是唯一可靠的方式。硬编码绝对字节阈值（如 3MB/4.5MB）在不同浏览器或多 key 共用时会失真，比例阈值更稳健。

## <a id="m7"></a>M7 — 数据迁移幂等

**决策**：localStorage → Supabase 迁移走服务端单事务端点 `POST /metadata/workspaces/migrate`：服务端先 `SELECT 1 FROM metadata_workspaces WHERE user_id = auth.uid() AND seed_from_local_at IS NOT NULL` 防重，成功后 `UPDATE workspaces SET seed_from_local_at = now()`。前端**收到 2xx 才写** `localStorage.migrated = true`。

**Why**：纯前端"导入后标 migrated"在中途失败时会双写不一致（部分数据上云、前端未标 → 重复迁移）。服务端 `seed_from_local_at` 是权威幂等键，前端标记仅快路径优化。

## <a id="m8"></a>M8 — PATCH 路由与日常编辑

**决策**：`PATCH /metadata/workspaces/:id/records` 接收 `{ upserts, deletes, revisions, expectedVersion }`，用于日常增量编辑。**PUT 仅用于首次保存与导入**。日常编辑禁止走 PUT 整存。

**Why**：500 条 record 工作区，每改一个字段都 PUT 整存 → 流量爆炸 + 写入放大。PATCH 路由不是"扩展功能"，是 Step 6 用户体验合格的硬前提。

## <a id="m9"></a>M9 — snapshot 表膨胀治理

**决策**：pg_cron 每月清理 12 个月以上 revision 的 `snapshot` 字段（置 NULL，保留 revision 元数据）：

```sql
select cron.schedule('metadata_revisions_snapshot_gc', '0 3 1 * *',
  $$ update metadata_revisions set snapshot = null
     where snapshot is not null and created_at < now() - interval '12 months'; $$);
```

**Why**：snapshot 是完整 record JSON，500 条 record × 10 次/条修订 = 5000 行快照膨胀。清理 snapshot 而非整条 revision，审计链不断。

## <a id="m10"></a>M10 — 跨标签页冲突横幅

**决策**：横幅文案明确风险："数据已在其他标签页更新。**刷新会丢弃本标签页未保存的修改。**" 提供两个按钮：「刷新加载远程」「先导出当前数据」。

**Why**：last-write-wins 策略下若不提示风险，用户直接点刷新会丢工作。导出按钮是兜底逃生通道。

## <a id="m11"></a>M11 — Undo 栈生命周期

**决策**：栈仅驻留内存（不写 localStorage、不与服务端同步），刷新即清空。最大深度 **20**（早期方案的 50 在 500 records × 20KB/snapshot × 50 = 10MB 内存占用过大）。切换 workspace 时 `clear()`。

**Why**：栈持久化会被误用为"跨刷新撤销"导致同步错乱；深度 20 平衡内存与用户期待。

## <a id="m12"></a>M12 — jsonb 字段结构预定义

**决策**：`metadata_records` 中两个 jsonb 字段在 migration column comment 中预定义结构，Edge Function validator **必须**按结构校验，拒绝非法形态：

`foreign_key`（Phase 10.2 用）：

```jsonc
{
  "refTable":     "string",                                  // 引用表名
  "refField":     "string",                                  // 引用字段名
  "onDelete":     "cascade" | "set null" | "restrict",
  "displayLabel": "string"                                   // 可选，UI 展示用
}
```

`enum_values`（Phase 10.1 用）：

```jsonc
[
  { "value": "string", "label": "string" }    // label 可选
]
```

**禁止**纯字符串数组（`["a", "b"]`）形态，需统一对象数组以便后续扩展（如颜色、disabled 标记）。

**Why**：两个字段都是 Phase 10 才会用到，但提前固定 schema 避免届时再加 migration 或 validator。Edge Function 在 Phase 1B 阶段就应该写好校验逻辑（即便业务上还不写值），后续直接生效。

## <a id="m13"></a>M13 — 类型生成是硬交付

**决策**：`supabase gen types typescript > src/types/supabase.ts` 是 **Step 4 的完成标准**，不是验证清单的可选项。Step 5 的前端 API 层依赖此类型文件，否则无法编译。

**Why**：实践中常被误当作"事后补一步"，导致 Step 5 卡壳。

## <a id="m14"></a>M14 — fieldName 空字符串豁免

**决策**：`field_name === ''` 时**不参与**唯一性校验（前端 + 后端一致）。后端用部分唯一索引 `where field_name <> ''` 实现，前端 `validateField` 在空值分支跳过去重检查。

**Why**：空 fieldName 是合法草稿状态；用户常在创建多条新行后逐一填名，期间多个空值并存属正常。

## <a id="m15"></a>M15 — workspace 软删

**决策**：`DELETE /metadata/workspaces/:id` 仅写 `deleted_at = now()`，由 pg_cron 每天扫描 7 天前的软删工作区物理删除。7 天内提供 `POST /metadata/workspaces/:id/restore` 路由恢复。

**Why**：cascade 删整个工作区不可逆，误操作代价过高。软删 + 7 天窗口是平衡 UX 与存储的标准做法。

## <a id="m16"></a>M16 — offline 与 local-only 区分

**决策**：`syncStatus` 包含独立的 `offline` 状态（灰点 "离线"），与 `local-only`（黄点 "仅本地"）含义不同：
- `offline`：`navigator.onLine === false`，不可点击同步，监听 `online` 事件自动尝试。
- `local-only`：有网但用户尚未点同步、或刚 undo/redo 后强制进入此状态。

**Why**：两者用户操作完全不同——离线时点同步徒劳，仅本地时点同步立即生效。混在一起会误导用户。

## <a id="m17"></a>M17 — 自动化测试是硬交付

**决策**：每个 Step 除手动验证外，必须交付对应的自动化测试（见计划文档"自动化测试策略"表）。测试文件放 `tests/` 目录，命名与模块对应。"手动验证"仅作为自动化测试的补充，不能替代。

**Why**：涉及离线同步、冲突合并、数据迁移幂等性等场景，单纯手动验证无法保证回归安全。特别是 syncStatus 状态机有 6 种状态 × 多种转换路径，手动覆盖不现实。fractional indexing 的边界（精度耗尽、首尾插入）也必须有自动化测试保证。

## <a id="m18"></a>M18 — rebalance 并发保护

**决策**：`POST /workspaces/:id/rebalance` 路由同样需要 `expectedVersion` 参数并在事务内 `SELECT version FOR UPDATE` 校验。先到者成功执行并 bump version，后到者收到 409。后到者收到 409 后**不应重试 rebalance**（先到者已完成重排），而应 fetch 最新数据后重试原始写入操作。

**Why**：若 rebalance 不受乐观锁保护，两个标签页同时检测到精度耗尽并调用 rebalance 时会产生竞态——两次等距重排可能交错执行，导致 display_order 不一致。且 rebalance 会 bump version，后续写入的 expectedVersion 会失效。统一纳入乐观锁体系最简单可靠。

## <a id="m19"></a>M19 — revisions 时间线 cursor 分页

**决策**：`GET /workspaces/:id/revisions` 支持 cursor 分页：`?record_id=<id>&after=<revision_id>&limit=50`，默认按 `created_at desc` 排序。`GET /workspaces/:id`（获取完整工作区）仅内联每条 record 最近 3 条 revisions，更多 revisions 通过分页路由按需加载。

**Why**：500 条 record × 平均 5 条 revision = 2500 条修订数据。一次性返回全部 revisions 的载荷过大（预估 500KB–1MB JSON），影响首次加载性能。内联最近 3 条满足 UI 即时展示需求（Step 9.3 时间线默认展示 ≤ 3 条用 pill 标签），超出部分通过"加载更多"按钮触发分页请求。

## <a id="m20"></a>M20 — Edge Function 写入必须用 PostgreSQL function 封装事务

**决策**：核心写入逻辑（upsert records + diff delete + insert revisions + version bump + last_writer_tab_id 更新）必须封装为 plpgsql function：

- `metadata_apply_put(p_workspace_id uuid, p_payload jsonb, p_expected_version int, p_tab_id text) returns jsonb`
- `metadata_apply_patch(p_workspace_id uuid, p_payload jsonb, p_expected_version int, p_tab_id text) returns jsonb`
- `metadata_rebalance(p_workspace_id uuid, p_expected_version int, p_tab_id text) returns jsonb`

函数内 `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE` 保证原子性；行锁 `SELECT version FROM metadata_workspaces WHERE id = p_workspace_id FOR UPDATE` 在函数入口取，乐观锁不通过时 `RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'version_conflict', DETAIL = jsonb_build_object(...)`。Edge Function 只做鉴权 + `supabase.rpc('metadata_apply_patch', { ... })`，捕获 ERRCODE 翻译为 409/422 HTTP 响应。

**Why**：Edge Function 默认 supabase-js client 走 REST 单条调用，多步操作之间无事务保护。原方案"upsert records + diff delete + insert revisions"三步若中途失败：
- diff 删除成功、revisions 写入失败 → 审计断链（违反 M2 承诺）
- version bump 成功、records upsert 失败 → 乐观锁状态错乱，后续所有请求 409

将整段逻辑下沉到 PG function 是唯一保证原子性的方式，同时享受 PG 内部的 SAVEPOINT/EXCEPTION 能力。Edge Function 退化为薄壳（鉴权 + 速率限制 + 响应翻译），单元测试也更易写（直接 `select metadata_apply_patch(...)`）。

**落地约束**：
- PG function 文件放 `supabase/migrations/202605xxNNNN_create_metadata_functions.sql`（与表 migration 同时或紧随其后）
- 函数 `SECURITY INVOKER`（不是 DEFINER），让 RLS 仍生效
- `_shared/operation-logger.ts` 的写入也在 function 内同事务完成（不要在 Edge Function 端写 logs，否则 logs 与业务数据可能不一致）

## <a id="m21"></a>M21 — PATCH 必须传字段级 changedFields

**决策**：`PATCH /metadata/workspaces/:id/records` 的 upsert payload 结构改为：

```ts
type PatchUpsert = {
  recordId: string;
  changedFields: Partial<MetadataRecord>;   // 只包含本次实际改动的字段
  expectedRecordUpdatedAt: string;           // ISO timestamp，record 级乐观锁
};
```

服务端 PG function（M20）逐字段 merge：`UPDATE metadata_records SET zh_name = COALESCE($changed->>'zhName', zh_name), ... WHERE id = ... AND updated_at = $expected`。`updated_at` 不一致返回 record 级冲突信息。

冲突合并判定（M4）基于 `changedFields` 的键集合：两个 tab 的 `changedFields` 键不相交 → 自动合并；相交 → 升级为冲突 UI。

**Why**：原方案 PATCH 的 upsert 是整条 record 全量字段，无法支持"A 改 zhName、B 改 length 自动合并"的承诺。任何一方的 upsert 都会用各自的本地 record 覆盖另一方刚改的字段，字段级合并形同虚设。

字段级 patch 还能：
- 减少传输体积（一次只传改动字段，500 records 工作区批改 1 个字段从 ~200KB 降到 < 1KB）
- 让 revisions 的 `snapshot` 仍按 PG function 内部 `SELECT` 后的最终全字段写入（M2 不动），但 `revision_note` 可以自动生成 `"updated: zhName, length"`

**落地约束**：
- 前端 store 必须按字段 dirty 追踪（如 `dirtyFields: Set<keyof MetadataRecord>`），保存时只把 dirty 字段塞入 `changedFields`
- 新建 record 走 `creates: MetadataRecord[]`（全字段），与 `upserts` 分开
- 删除走 `deletes: string[]`，不变

## <a id="m22"></a>M22 — 离线队列重放合并策略

**决策**：离线期间所有变更不入操作队列逐条回放，而是直接落 localStorage（与现状一致）。恢复在线时按以下流程同步：

1. fetch 服务端最新 workspace（拿到当前 version 与所有 record 当前状态）
2. 本地与服务端做 record 级 diff，生成 **一个** PATCH payload（含所有本地新增 / 修改 / 删除）
3. PATCH 中插入一条 `type: 'bulk_offline_replay'` 的 revision，`snapshot` 字段为 null，`revision_note` 携带摘要：`{ operationCount: 12, firstAt: '...', lastAt: '...', recordIds: [...] }`
4. 单次 PATCH 走 M20 的事务原子性保证

**Why**：按序逐条回放看似审计粒度更细，但实操有三个坑：
- 客户端必须为每个回放的 PATCH 推算 expectedVersion（自己 bump 自己），网络抖动重试时极易错乱
- 每个 PATCH 的乐观锁意味着只要中途有跨设备写入就全部失败、需要复杂 rollback
- 离线 50 个操作 → 50 次 Edge Function 调用 → 速率限制爆掉（M5 现有 PATCH 60/min/user）

合并 PATCH + 摘要 revision 在审计完整性与可执行性之间取平衡：审计层知道"这一刻有一批离线变更被回放"，业务层只需处理一个 409 冲突。

**落地约束**：
- 摘要 revision 的 `snapshot` 不存（节省空间），需要细粒度回溯时由 client log（如 Sentry breadcrumbs）补充
- 离线状态本身由 [M16] 的 `offline` syncStatus 标识，恢复在线时进入 `syncing` 后再进 `synced` 或 `conflict`

## <a id="m23"></a>M23 — CORS 必须包含 X-Client-Tab-Id

**决策**：`supabase/functions/_shared/cors.ts` 的 `Access-Control-Allow-Headers` 响应头**必须**包含 `X-Client-Tab-Id`。Step 5 的"前置修改"清单包含此项，与 operation-logger 白名单并列。

**Why**：M4 要求所有写请求携带 `X-Client-Tab-Id` 头。浏览器对自定义头会先发 OPTIONS preflight，若服务端响应的 `Access-Control-Allow-Headers` 不包含该头名，浏览器直接拒绝实际请求，前端会收到模糊的 CORS error 而非 409。

调试体感很差（看起来"请求没发出去"），且修复需要重新部署 _shared 模块。一定在 Step 5 上线前预先加上。

**落地约束**：
- 同时检查 `_shared/cors.ts` 现有头列表是否已包含 `Authorization`、`Content-Type`、`X-Client-Info`（supabase-js 默认带），缺哪个补哪个
- 若使用通配符 `*`，注意当 `credentials: 'include'` 时 `*` 无效，必须显式列名

## <a id="m24"></a>M24 — UUID 生成必须有兜底

**决策**：新建 `src/lib/uuid.ts`，导出 `uuid(): string`：

```ts
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC 4122 v4，基于 crypto.getRandomValues
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
```

Step 1.1 的"`Math.random` 替换为 `crypto.randomUUID`"**改为**"替换为 `uuid()` 工具函数"。

**Why**：`crypto.randomUUID()` 有两个兼容性陷阱：
- **仅在 secure context 可用**（HTTPS / localhost / 127.0.0.1）。项目若部署到 http://内网IP 直接 TypeError
- **Safari < 15.4** 不支持（2022 年 3 月前的版本）

`crypto.getRandomValues` 的覆盖率显著更广（所有现代浏览器 + 非 secure context 也可用）。封装为 `uuid()` 工具后所有调用点零成本切换，未来全面切到 native 也只需改一处。

## <a id="m25"></a>M25 — localStorage payload 必须带 schemaVersion

**决策**：localStorage key `sqldev:workbench:metadata` 的 value 顶层必须包含 `schemaVersion: number`。当前迁移到的版本为 **2**（对应 M3 的 `displayOrder: number` + 本次评审引入的所有字段结构）。

```jsonc
{
  "schemaVersion": 2,
  "records": [...],
  "recordOrder": [...],
  "_writerTabId": "...",
  "_lastWrittenAt": "..."
}
```

读取时：
- 缺 `schemaVersion` → 视为 v1（即旧 `order: string` 格式），走 Step 2.2 的一次性迁移
- `schemaVersion < 2` → 按链式 migrator 升级
- `schemaVersion > 2`（用户在新版本用过又回滚到旧版本）→ **拒绝读取**，提示用户"本地数据由更新版本写入，请升级应用或清除本地数据"

**Why**：原方案一次性把 `order: string` 升级到 `displayOrder: number` 后覆盖写回 localStorage，未来再加字段（如 `_offlineQueue`、字段级 `dirtyFields` 持久化）就无法识别"这是哪一版"。schemaVersion 是零成本未来保险。

`schemaVersion > 2` 的拒绝读取很关键：避免老版本应用读到带 `_offlineQueue` 的新格式后写回时丢失这个字段，造成离线数据丢失。

## <a id="m26"></a>M26 — metadata_records 冗余 user_id 优化 RLS

**决策**：`metadata_records` 表增加 `user_id uuid not null` 列；`metadata_revisions` 同样增加。Trigger 在 `BEFORE INSERT` 时从 `metadata_workspaces` 同步：

```sql
create trigger sync_user_id_on_records
  before insert on metadata_records
  for each row execute function copy_user_id_from_workspace();
```

RLS policy 直接 `auth.uid() = user_id`，**不走子查询 / JOIN**。索引：`(user_id, workspace_id, id)` 复合索引覆盖大部分查询路径。

**Why**：原方案"通过 workspace 的 user_id 关联"在 RLS policy 中写为：

```sql
create policy ... using (
  exists (select 1 from metadata_workspaces w
          where w.id = workspace_id and w.user_id = auth.uid())
);
```

PG planner 大部分时候能将其优化为 nested loop join，但：
- 每行都触发一次子查询执行（即便有 cache）
- 500 records × 100 并发 QPS 时性能可见劣化（实测可慢 5–10 倍）
- `metadata_revisions` 通过 record_id 再 JOIN 到 workspace 是两层间接，更慢

冗余 user_id 是 Supabase / Postgres 社区的标准 RLS 优化模式（参见 Supabase 官方 RLS 性能指南）。trigger 自动同步保证一致性，应用层无感知。

**落地约束**：
- Step 4 migration 同时建表、列、trigger、索引；不要拆成两个 migration
- 写入路径（M20 的 PG function）不需要显式传 user_id，trigger 自动填
- 测试用例覆盖"用户 A 把 record 改 workspace_id 到用户 B 的 workspace 是否会出现 user_id 不一致"——答案是 **不允许跨用户改 workspace_id**，PG function 显式拒绝

## <a id="m27"></a>M27 — pg_cron 部署前置条件

**决策**：M9（snapshot 清理）、M15（软删工作区清理）依赖 PostgreSQL `pg_cron` extension。部署 Step 4 前必须确认以下任一前置满足：

- **自托管 Supabase / 独立 Postgres**：执行 `CREATE EXTENSION IF NOT EXISTS pg_cron;`，并配置 `cron.database_name` 与 `shared_preload_libraries`
- **Supabase Cloud**：项目必须为 **Pro 及以上** tier（Free Tier 不开放 pg_cron），且在 Dashboard → Database → Extensions 中启用 pg_cron

若部署环境无法满足上述条件，必须改用 Edge Function + Vercel/Supabase Scheduled Triggers 实现定时清理（每天调一次清理 Edge Function）。这是 Step 4 的**先决条件检查**，未确认前不要写 migration。

**Why**：M9 / M15 的清理逻辑若跑不起来：
- snapshot 表 12 个月后开始无限膨胀（500 records × 5 revisions/月 × 12 月 = 30000 行）
- 软删工作区永不物理删除，违反用户的"删除权" GDPR 合规承诺
- 用户感知不到错误（功能正常），但运维侧出大问题

提前 1 周确认部署环境能省后期 20 小时排查时间。

**落地约束**：
- Step 4 验收清单第一项：截图 `select * from cron.job` 显示两个调度已注册
- 若选 Scheduled Trigger 兜底方案，需在 `supabase/functions/cleanup/` 下新建专门的清理 function（与现有 `cleanup` function 区分或合并，确认现有 `cleanup` function 的职责后决策）

## <a id="m28"></a>M28 — Revisions cursor 用复合 cursor

**决策**：`GET /workspaces/:id/revisions` 的 cursor 参数 `after` 改为**复合 cursor**：

```
?record_id=<id>&after=<base64(created_at_iso|revision_id)>&limit=50
```

服务端解码 cursor 后查询：

```sql
where (created_at, id) < ($created_at, $id)
order by created_at desc, id desc
limit $limit
```

响应体：

```jsonc
{
  "items": [...],
  "nextCursor": "MjAyNi0wNS0yNlQwOToyMDoxNS4xMjNafGFiYy0xMjM=",  // base64(created_at|id)
  "hasMore": true
}
```

**Why**：原方案 `after=<revision_id>` 单纯按 id 排序，但：
- 修订 id 是 UUID，**不是单调递增的**（v4 UUID 完全随机）
- 同毫秒插入两条 revision 时纯 id cursor 会跳过或重复（按 id 排序后 cursor 指向中间，分页边界处的 revision 可能被漏掉）

复合 cursor `(created_at, id)` 是标准做法：`created_at` 提供单调性，`id` 作为 tiebreaker 处理同毫秒情况。base64 编码避免 URL 中出现特殊字符（`|` 等）。

**落地约束**：
- 服务端必须建 `(record_id, created_at desc, id desc)` 索引支持该查询；建议同时建 `(workspace_id, created_at desc, id desc)` 用于全工作区时间线
- 前端 API 层 `getRevisionTimeline()` 入参签名 `{ recordId?, after?: string, limit?: number }`，`after` 是不透明 cursor 字符串，UI 层不解读

## <a id="m29"></a>M29 — 性能基线必须标注 p95 + 单用户/并发

**决策**：所有性能基线明确标注测量条件。修订原"通用验收标准"为：

| 场景 | 基线 | 测量条件 |
|------|------|---------|
| 页面加载（500 records）| < 1s | 单用户，热启动 |
| 单条编辑响应 | < 50ms | 单用户，本地（无网络） |
| PUT 整存 | < 2s p95 | 单用户 |
| PATCH 单字段 | < 500ms p95 | 单用户 |
| PATCH 单字段（并发）| < 1s p95 | **100 并发用户** |
| PATCH 批量 20 条 | < 1s p95 | 单用户 |
| POST rebalance | < 1.5s p95 | 单用户 |
| localStorage 写入 | < 150ms | 单用户 |

并发基线脚本使用 [k6](https://k6.io/) 或同类工具，放 `tests/perf/metadata.k6.js`。

**Why**：单用户 < 500ms 与多用户并发 < 500ms 是两件事。100 并发用户对同一张表的 PATCH 路径会触发：
- RLS policy 子查询的 cache miss（即便有 M26 的优化）
- 乐观锁的 `SELECT FOR UPDATE` 行锁排队
- Edge Function isolate 池上限

不测并发基线，等到生产上线被监控告警发现性能问题，回滚成本极高。

**落地约束**：
- 并发基线测试是 Step 5 的**硬验收点**，不能延后
- 测试环境必须接近生产（Supabase 同 tier、网络延迟可比）

## <a id="m30"></a>M30 — Undo 栈用 diff-based 而非完整快照

**决策**：Undo 栈每个 entry 不存完整 records 数组快照，而是存 diff：

```ts
type UndoEntry =
  | { type: 'update'; recordId: string; before: Partial<MetadataRecord>; after: Partial<MetadataRecord>; changedFields: (keyof MetadataRecord)[] }
  | { type: 'create'; record: MetadataRecord }
  | { type: 'delete'; record: MetadataRecord }
  | { type: 'batch'; entries: UndoEntry[] };   // 批量操作 (Step 8.2) 折叠为一个 batch entry
```

执行 undo 时按 diff 反向应用；执行 redo 时正向应用。栈深度 20 不变。切 workspace 时 `clear()`。

**Why**：M11 原本说"快照栈深度 50 内存占用过大（500 records × 20KB × 50 = 10MB）"——这个估算偏低（每条 record 全字段 + revisions 内联可能 50KB+），且深度 20 时仍要 500 × 50KB × 20 = **500MB** 量级。

diff-based 单 entry 平均 < 1KB（只存改动字段），深度 20 时栈占用 < 20KB。批量操作（Step 8.2 的批量改类型 200 条）折叠为一个 batch entry，仍是 < 200KB。

**落地约束**：
- `src/features/metadata/undoRedo.ts` 不能用"克隆整个 store state 入栈"的实现
- diff 计算用浅比较（`record-by-field`）即可，不需要深 diff
- batch entry 的 undo 必须按**逆序**应用子 entry（先恢复最后一个改动，最后恢复第一个），否则 ID 依赖关系会错
