# Supabase Security Checklist (RLS)

This project uses a browser-side Supabase anon key. That is expected for frontend apps.
Security must rely on proper Row Level Security (RLS) policies and restricted Edge Function behavior.

## Quick Audit

1. Open Supabase SQL Editor.
2. Run [`rls-audit.sql`](./rls-audit.sql).
3. Confirm:
   - no application table appears in the "RLS disabled" result
   - every table intended for client access has explicit policies
   - policy inventory matches your expected read/write scope
4. If result sets are empty, first check the baseline table list in the script output:
   - no user table means "nothing to audit yet" (normal for early projects)
   - tables may live outside `public` schema

## Deployment Guardrails

- Never expose `service_role` or any secret key in frontend code.
- Use only publishable/anon keys in browser config.
- Keep RLS enabled for all `public` schema app tables.
- Restrict privileged operations to Edge Functions and validate JWT user identity server-side.

## Notes For This Repo

- `supabase/functions/convert/index.ts` already validates user token before service use.
- Frontend `supabase-config.js` now refuses privileged keys if accidentally injected.
