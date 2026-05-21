# AGENTS.md

本文件是仓库级 AI 协作短规则入口，适用于 Codex 以及其他 AI Coding Agent。

长文规范见 `docs/AI_DEV.md`。  
当前实现背景、阶段性事实和历史变更见 `docs/CONTEXT_FULL.md`。  
脚本与校验入口以 `package.json` 为准。

## 1. 每次任务默认遵守

1. 前端统一使用 Vue 3 + `<script setup lang="ts">` + Composition API。
2. TypeScript 严格模式下工作，避免 `any`，优先 `unknown` + 类型守卫。
3. 所有源码、文档、脚本、配置文件默认使用 UTF-8 编码，提交前通过 `pnpm check:utf8`。
4. 网络请求统一走 `src/api/http.ts` 或其上层 API 封装，禁止页面散写复杂 `fetch`。
5. 敏感逻辑、AI 请求、第三方密钥、服务端权限操作必须走 Supabase Edge Functions。
6. 浏览器侧禁止暴露 `service_role`，前端环境变量只使用 `VITE_*`。
7. RLS 默认开启，新增表必须有策略；migration 后必须重新生成数据库类型。
8. 纯逻辑放 `src/features/`，Vue 响应式逻辑放 `src/composables/`，API 封装放 `src/api/`。
9. 状态按作用域归属：跨页面状态进 store，单页面业务流状态优先放页面内 composable。
10. 需要“切页后返回仍保留”的页面状态，必须明确 `KeepAlive` 或持久化策略；外层 `RouterView` / `key` 不能误伤缓存。
11. 错误处理必须结构化，禁止空 `catch {}`，用户提示统一走 `error-map`。
12. 新 UI 不允许大面积硬编码颜色，优先 Tailwind 语义类和 `tokens.css` 中的 token。
13. 所有重要改动都要验证；完整门禁入口是 `pnpm verify`。
14. 如果规范与代码冲突：长期规则看 `docs/AI_DEV.md`，当前事实看代码与 `docs/CONTEXT_FULL.md`。

## 2. 完成任务后的固定输出

每次任务完成后，至少说明：

1. 改了哪些文件，目的是什么。
2. 做了哪些验证，结果是什么。
3. 是否需要部署、执行 migration、更新配置或补充文档。

如果需要部署：

- 必须给出部署步骤。
- 如果本次未实际执行部署，要明确写“未执行部署，仅提供步骤”。

如果变更属于阶段性实现、架构演进或会影响后续判断：

- 需要评估是否同步更新 `docs/CONTEXT_FULL.md`。

## 3. 常用命令

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm check:utf8
pnpm test
pnpm test:unit
pnpm test:smoke
pnpm verify
```

## 4. 遇到以下场景时，必须回看长文规范

- 改动数据库、RLS、migration
- 改动 Edge Function、鉴权、CORS、AI 配置
- 改动状态缓存、页面生命周期、KeepAlive
- 改动设计系统、主题、Token、复杂交互
- 需要定义新的工程约束或新增长期规范
