# AI 开发规则镜像

本文件用于在 `docs/` 中固定项目开发约束，来源于仓库根目录 [AI_DEV.md](/d:/codextest/sqldev/AI_DEV.md)。

## 执行摘要

- 前端基线：Vue 3 + TypeScript + Vite + Vue Router + Pinia + TailwindCSS。
- Supabase 查询必须走类型化客户端（`Database` 泛型）。
- 业务请求必须统一封装在 `src/api`，页面不得散写复杂请求。
- 路由守卫按登录态保护受限页面。
- UI 必须覆盖 `loading / empty / error / success` 四态。
- 样式优先使用 Design Token（`src/styles/tokens.css`）。

## 目录映射（本次重构）

```txt
src/
  api/
  composables/
  lib/
  pages/
  router/
  stores/
  styles/
  types/
```

## 注意事项

- 前端禁止使用 `service_role` key。
- 敏感逻辑继续放在 `supabase/functions/*`。
- 若新增数据库表，请同步更新 `src/types/supabase.ts`（建议由 Supabase CLI 自动生成）。
