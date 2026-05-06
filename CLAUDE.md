# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                  # Vite dev server (default port 4173, configurable via VITE_DEV_PORT)
pnpm build                # vue-tsc --noEmit + vite build
pnpm typecheck            # vue-tsc --noEmit
pnpm lint                 # ESLint on src/**/*.{ts,vue}
pnpm check:utf8           # UTF-8 encoding validation
pnpm check:css-colors     # Hardcoded CSS color baseline check
pnpm test                 # Node .mjs test runner (28 suites via tests/run-all.mjs)
pnpm test:unit            # Vitest (tests/unit/*.test.ts)
pnpm test:smoke           # Smoke test (tests/smoke.mjs)
pnpm verify               # Full gate: typecheck + lint + utf8 + css-colors + test + test:unit
```

Run a single test: `node ./tests/<test-name>.mjs` or `pnpm test:<name>` (e.g. `pnpm test:ddl`).

## Architecture

**Stack**: Vue 3 (Composition API only) + TypeScript strict + Vite 6 + Pinia + Vue Router 4 (hash mode for GitHub Pages) + TailwindCSS 3 + Supabase (Auth / PostgreSQL / Edge Functions on Deno).

**Routing** (`src/router/index.ts`): Hash-based SPA. Layouts chosen by route `meta.layout`: `workbench`, `auth`, `default`. Auth-required routes use `meta.requiresAuth`.

**State** (Pinia setup stores in `src/stores/`): `auth` (session + Supabase Auth), `app` (theme), `workbench` (active page, DB pickers, DDL/func/proc I/O, convert action), `ai`, `rules`, `ziwei-history`, `operation-logs`.

**API layer**: `src/api/http.ts` exports `edgeFn` with `.get()/.post()/.patch()/.del()`. All Edge Function calls go through this. `src/lib/edge.ts` defines `ApiError` and `invokeEdgeFunction` (legacy). Token refresh is handled in `src/lib/edge.ts`.

**Features** (`src/features/`): Pure logic modules with no Vue/DOM dependencies. Each has an `index.ts` barrel. Key modules: `ddl/` (parse → constraint → postprocess → type-map → output → orchestrate), `routines/` (function/procedure parse + generate), `navigation/` (route parsing + workbench state), `ziwei/` (compute engine + AI utils + history), `rules/`, `preferences/`, `id-tools/`, `browser/`, `ai/`, `app-config/`.

**Edge Functions** (`supabase/functions/`): 11 functions on Deno runtime. Shared utilities in `_shared/` (auth, cors, rate-limit, response, request, crypto, ai-resolver). All use `verify_jwt = false` with internal Bearer token validation. Key functions: `convert`, `feedback`, `ziwei-analysis`, `ai-config`, `app-config`.

**Styling**: Dual system — Tailwind semantic classes in `<template>` (e.g. `bg-panel`, `text-brand-500`), CSS variables in `<style>` (e.g. `var(--color-border)`). Tokens defined in `src/styles/tokens.css` with `[data-theme="dark"]` override. No hardcoded hex colors in new code.

**Auth**: Supabase Auth (email/password + OTP). Client at `src/lib/supabase.ts`. Auth store uses `initPromise` serialization. Router guard at `src/router/guards.ts`. Auth modal is a global overlay on `App.vue`.

## Critical Rules

- **Always** `<script setup lang="ts">` with Composition API. No Options API, no Vuex.
- **TypeScript strict**: `noUnusedLocals`, `noUnusedParameters`, ESLint `no-explicit-any: error`.
- **`ref` preferred** over `reactive`; never destructure reactive objects (loses reactivity).
- **Error handling**: `Result<T, E>` in `src/features/`, `ApiError` with snake_case `code` in `src/api/`. Error messages centralized in `src/utils/error-map.ts`. No empty `catch {}`, no string error returns.
- **Feature placement**: Pure logic → `src/features/`, Vue reactive logic → `src/composables/`, API wrappers → `src/api/`, pages → `src/pages/`, reusable UI → `src/components/`.
- **Supabase types**: `src/types/database.types.ts` is auto-generated (`supabase gen types typescript --local`). Never hand-edit.
- **Environment variables**: Frontend only `import.meta.env.VITE_*`. No `process.env` in client. No `service_role` key in frontend.
- **Edge Functions**: Deno runtime only (no Node.js APIs). AI requests must go through Edge Functions, never direct from client.
- **RLS**: All tables must have RLS enabled with policies. Table and column comments required in migrations.
- **Code size**: Functions ≤80 lines, Vue `<script>` ≤150 lines. Extract composables or sub-components when exceeding.
- **Configurable values**: Never hardcode values that may change. Use env vars, Supabase Secrets, or backend config tables.
- **CSS**: No hardcoded colors in new code. Use Tailwind tokens or CSS variables. New components must support light/dark themes.
- **Commit format**: `type(scope): description` — types: feat/fix/refactor/chore/docs/test/security/perf/style/ci/build/revert.

## Full Specification

The authoritative development spec is `docs/AI_DEV.md` (27 sections). Project state and changelog in `docs/CONTEXT_FULL.md`. When in doubt, defer to `AI_DEV.md`.
