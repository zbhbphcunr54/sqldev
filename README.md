# SQLDev (Vue 3 + TS + Vite)

本仓库已按 `AI_DEV.md` 重构为 Vue 3 + TypeScript + Vite + Pinia + Router + Tailwind 架构。

## 本地运行

```bash
pnpm install
pnpm dev
```

默认将打开 `http://127.0.0.1:4173/index.vite.html`。

## 构建

```bash
pnpm build
pnpm preview
```

## 环境变量

复制 `.env.example` 为 `.env.local` 并填写：

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Supabase Functions 部署

```bash
supabase functions deploy convert --project-ref ydlvispjdcffqvqhwhuk
supabase functions deploy feedback --project-ref ydlvispjdcffqvqhwhuk
supabase functions deploy ziwei-analysis --project-ref ydlvispjdcffqvqhwhuk
```
