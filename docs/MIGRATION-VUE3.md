# SQLDev 重构迁移说明（AI_DEV 对齐）

## 目标

将历史单文件页面重构为：

- Vue 3 Composition API
- TypeScript
- Vite
- Vue Router + Pinia
- Tailwind + Design Tokens
- Supabase 类型化客户端

## 已完成

1. 新建 `src/` 标准结构（api/lib/stores/composables/pages/router/types/styles）。
2. 统一请求入口 `src/api/http.ts`，页面不再散写 fetch。
3. 新建登录守卫和 Auth Store。
4. 新建 Splash / Workbench / Ziwei / Login / 404 页面。
5. 引入 `tokens.css` 和主题切换（light/dark/system）。
6. 新入口 `index.vite.html`，并由旧 `index.html` 重定向到新入口。

## 后续建议

1. 将旧 `app.js` 的细节能力按模块继续拆分迁移到 `src/`。
2. 用 Supabase CLI 重新生成 `src/types/supabase.ts`，替换当前占位结构。
3. 接入单元测试和 E2E，用于保障迁移期间功能一致性。
