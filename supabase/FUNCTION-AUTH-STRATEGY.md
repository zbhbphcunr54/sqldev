# Edge Function Auth Strategy

The Supabase gateway setting is `verify_jwt = false` for the three Edge
Functions in this repo. This is intentional for the current deployment because
the browser uses Supabase publishable/anon keys and the functions perform their
own session validation.

## convert

- Requires an `Authorization: Bearer <access_token>` header.
- Validates the token by calling `/auth/v1/user` with the public anon key.
- Applies rate limiting by `userId + IP`.
- Rejects invalid tokens before running the SQL conversion engine.

## feedback

- Allows anonymous feedback.
- If a bearer token is present, resolves the user with `/auth/v1/user`.
- Applies rate limiting by `userId or anon + IP`.
- Writes to `public.feedback_entries` using service-role credentials inside the
  function only. Direct client table access is denied by RLS.

## ziwei-analysis

- Requires an `Authorization: Bearer <access_token>` header.
- Validates the token by calling `/auth/v1/user`.
- Optionally checks `ZIWEI_ALLOWED_EMAILS` when configured.
- Applies rate limiting by `userId + IP`.
- Keeps AI provider keys server-side only.

## Operational Notes

- Keep `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` configured as
  Supabase secrets where required.
- Keep `CORS_PRIMARY_ORIGIN`, `CORS_ALLOWED_ORIGINS`, and
  `ALLOW_LOCALHOST_ORIGIN` explicit per environment.
- Revisit gateway `verify_jwt = true` only after confirming the deployed key
  type is compatible with Supabase Edge Function gateway JWT verification.
