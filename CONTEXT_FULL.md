# SQDev Collaboration Context (Canonical)

Last updated: 2026-04-15

## Identity And Role
- Assistant identity for this project: `top full-stack engineer + aesthetic design expert`.
- Communication style: direct execution, high ownership, practical and production-oriented.

## Collaboration Rules (User Preference)
- Default behavior: execute directly, do not ask for confirmation on routine implementation details.
- Git workflow rule: **always commit locally first, then push to remote**.
- When design and interaction choices are obvious from prior direction, continue without extra questioning.

## Product/UI Direction (Locked)
- Home page and Workbench are two separate interfaces.
- Follow uploaded design references:
  - `C:\Users\zhengpeng\Downloads\splash-redesign.html`
  - `C:\Users\zhengpeng\Downloads\workbench-redesign_8d00caf9.html`
- Sidebar interaction preference:
  - hover to expand
  - click feature item to navigate
  - leaving sidebar area auto-collapses
  - no extra hamburger button

## Auth And Convert Architecture (Current Stable Path)
- Current production-stable strategy:
  - gateway `verify_jwt = false`
  - server-side token validation inside function by calling `GET /auth/v1/user` with bearer token
- Reason: with gateway `verify_jwt = true`, requests were blocked pre-runtime (`401` + `execution_id = null`) in this environment.
- Current healthy signal:
  - `POST /functions/v1/convert = 200`
  - `execution_id` is present
  - deployed version advanced (verified at `v45`)

## Security Hardening Applied
- CORS is env-configurable:
  - `CORS_PRIMARY_ORIGIN`
  - `CORS_ALLOWED_ORIGINS` (comma-separated)
  - `ALLOW_LOCALHOST_ORIGIN` (`1/true/yes` only for dev)
- Rate limiting added in `convert`:
  - key: `userId + IP`
  - defaults:
    - `CONVERT_RATE_LIMIT_MAX_REQUESTS = 20`
    - `CONVERT_RATE_LIMIT_WINDOW_MS = 60000`
    - `CONVERT_RATE_LIMIT_TRACK_MAX = 2000`
  - on throttle: `429` + `Retry-After`

## Key Files
- `supabase/functions/convert/index.ts`
- `supabase/config.toml`
- `supabase/functions/convert/config.toml`
- `supabase/SECURITY-CHECKLIST.md`
- `auth.js`
- `app.js`
- `index.html`

## Recent Key Commits
- `fd758f5` chore(cors): make allowed origins fully env-configurable
- `d4d16d2` security(convert): harden cors and add per-user rate limiting
- `a08af4c` fix(auth): validate user token in function while disabling gateway jwt gate
- `44072f4` docs(context): save current project state snapshot

## Operational Notes
- For Supabase function runtime env vars, use `supabase secrets set ... --project-ref <ref>`.
- Keep `service_role` out of frontend at all times.
- Keep RLS enabled for any future business tables.
