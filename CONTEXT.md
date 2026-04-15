# 项目上下文快照（2026-04-15）

## 当前结论
- `convert` 已恢复稳定：线上日志为 `POST 200`，且 `execution_id` 非空（已验证到 deployment `v45`）。
- `verify_jwt=true` 会在网关前置阶段触发 `401`（`execution_id=null`），因此当前采用稳定方案：
  - 网关 `verify_jwt=false`
  - 函数内使用 `Authorization` bearer token 调用 `/auth/v1/user` 做服务端鉴权

## 关键安全策略（已落地）
- CORS 改为环境变量可配置：
  - `CORS_PRIMARY_ORIGIN`
  - `CORS_ALLOWED_ORIGINS`（逗号分隔）
  - `ALLOW_LOCALHOST_ORIGIN`（仅开发时开启）
- `convert` 增加按 `userId + IP` 的速率限制：
  - `CONVERT_RATE_LIMIT_MAX_REQUESTS`（默认 20）
  - `CONVERT_RATE_LIMIT_WINDOW_MS`（默认 60000）
  - `CONVERT_RATE_LIMIT_TRACK_MAX`（默认 2000）
- 超限返回 `429`，并附带 `Retry-After`。

## 最近关键提交
- `fd758f5` chore(cors): make allowed origins fully env-configurable
- `d4d16d2` security(convert): harden cors and add per-user rate limiting
- `a08af4c` fix(auth): validate user token in function while disabling gateway jwt gate
- `84a0116` chore(cache): bump auth script version
- `9fe60a9` fix(auth): force bearer header and root function jwt config
- `b280397` fix(auth): remove convert function manual token gate

## 当前部署/运维建议
1. 生产环境保持 `verify_jwt=false`（当前平台行为下更稳定）。
2. 在 Supabase 函数环境变量里配置 CORS 与限流参数。
3. 本地改动已累计在 `main` 分支，推送前确认一次日志为 `POST 200`。

## 关联文件
- `supabase/functions/convert/index.ts`
- `supabase/config.toml`
- `supabase/functions/convert/config.toml`
- `supabase/SECURITY-CHECKLIST.md`
- `auth.js`
- `index.html`
