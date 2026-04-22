# SQDev Collaboration Context (Canonical)

Last updated: 2026-04-15

## Identity And Role
- Assistant identity for this project: `top full-stack engineer + aesthetic design expert`.
- Communication style: direct execution, high ownership, practical and production-oriented.

## Collaboration Rules (User Preference)
- Default behavior: execute directly, do not ask for confirmation on routine implementation details.
- Git workflow rule: **always commit locally first, then push to remote**.
- When design and interaction choices are obvious from prior direction, continue without extra questioning.
- Context update cadence: save context to `CONTEXT_FULL.md` once per day at **17:00** (instead of updating on every change).

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

## Refresh Performance Rule (New)
- If user was last in workbench, browser refresh should directly restore workbench view.
- Do not replay splash poster animations on workbench refresh.
- Startup should fast-path app bootstrap when restoring workbench.
- Bootstrap now uses dependency-aware parallel loading (instead of full serial chain).
- Splash startup delays heavy app warmup to reduce first-screen contention.
- Theme is now resolved in earliest startup script to avoid dark/light flash on refresh.
- Chinese font (`Noto Sans SC`) moved to primary font link to avoid async font swap jitter.

## Feedback Feature (New)
- Added a unified "提建议" entry on both interfaces:
  - global side floating feedback FAB (desktop) + compact floating button (mobile)
- FAB visual style updated to mainstream side capsule pattern:
  - compact default state
  - expands on hover/focus
  - subtle status pulse dot and refined light/dark styling
  - explicitly pinned visible in both splash(home) and workbench scenes
- Added a shared feedback modal with:
  - suggestion category
  - content textarea with live character counter
  - optional contact field
  - submit status feedback + toast
- Submission strategy:
  - online submit now targets Edge Function `feedback` (authenticated path + direct endpoint path)
  - function writes to `public.feedback_entries` via service-role key
  - CORS / localhost policy follows the same env controls used by `convert`
  - has per-user-or-anon + IP rate limiting in function runtime
  - if endpoint is unavailable, auto-saves draft to `localStorage` (`sqldev_feedback_queue`)
  - client-side error diagnostics now surface likely cause (`not deployed` / `CORS` / `table write failed` / `network`) instead of only generic failure
  - logged-in submit path now has resilient fallback: if `authApi.invokeFunction('feedback')` throws, client still retries direct endpoint submit
- New global API for internal integration:
  - `window.openFeedbackModal(source)`

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
- `startup-view.js`
- `supabase/functions/convert/index.ts`
- `supabase/functions/feedback/index.ts`
- `supabase/feedback-schema.sql`
- `supabase/config.toml`
- `supabase/functions/convert/config.toml`
- `supabase/SECURITY-CHECKLIST.md`
- `auth.js`
- `app.js`
- `splash.js`
- `bootstrap.js`
- `feedback.js`
- `index.html`
- `style.css`

## Recent Key Commits
- `fd758f5` chore(cors): make allowed origins fully env-configurable
- `d4d16d2` security(convert): harden cors and add per-user rate limiting
- `a08af4c` fix(auth): validate user token in function while disabling gateway jwt gate
- `44072f4` docs(context): save current project state snapshot

## Operational Notes
- For Supabase function runtime env vars, use `supabase secrets set ... --project-ref <ref>`.
- Keep `service_role` out of frontend at all times.
- Keep RLS enabled for any future business tables.

## New Feature: Test Tools (ID/USCC)
- Added a new collapsible sidebar group: `测试小工具`
  - child menu: `证件号码生成工具`
  - clicking child switches `activePage` to `idTool`
- Added new workbench page `idTool` with tab switch:
  - `身份证号码生成 / 校验`
  - `统一社会信用代码生成 / 校验`
- Frontend-only algorithms implemented in `app.js`:
  - ID card generation + validation (GB 11643-1999, weighted mod-11 checksum)
  - USCC generation + validation (GB 32100-2015 charset/weights/check digit)
  - copy generated results to clipboard
- Added administrative-region loader reuse for tool page:
  - province/city/county联动 and region-code existence checks
  - load error retry action in UI
- Updated keyboard primary-action guard:
  - `Ctrl/Cmd + Enter` now only triggers conversion on `ddl/func/proc` pages
- Updated CSP `connect-src` in `index.html` to allow external region data mirrors:
  - `cdn.jsdelivr.net`
  - `fastly.jsdelivr.net`
  - `raw.githubusercontent.com`

## UI Tuning: Feedback Button (Ora100 style)
- Reworked left-side feedback entry to match ora100 homepage style:
  - fixed left-center vertical rail
  - rounded-right edge with `border-left: none`
  - low-opacity default, full-opacity on hover/open
  - subtle horizontal expand on hover
  - icon rotated 90° + label vertical layout
  - desktop shows label, mobile keeps icon-only compact mode
- Updated both dark/light theme shadows and hover color to consistent Oracle red accent.

## 2026-04-15: ID Tool Local Data + Two-Card Redesign
- Replaced online region loading path with local file:
  - `app.js` now loads `./行政区划代码_2024.json` only.
  - Removed online fallback fetch logic from runtime path.
- Region parsing now uses nested tree data structure from local JSON:
  - `province -> cityList -> areaList`.
- Updated ID tool page layout to a new two-card design:
  - Card 1: 身份证号码生成 + 校验
  - Card 2: 统一社会信用代码生成 + 校验
  - Desktop two-column split, mobile single-column stacked.
- Removed old tab-switch template/styles for the ID tool page to simplify maintenance.
- Refined ID sequence generation logic:
  - sequence range `001-999`
  - gender parity enforced on the 17th digit (male odd / female even)
  - keeps checksum calculation unchanged (GB 11643-1999).
- Tightened CSP `connect-src` by removing now-unused region data CDN domains.

## 2026-04-15: Unified Scrollbar Theme
- Unified site-wide scrollbars to match workbench editor style.
- Added scrollbar design tokens in `style.css`:
  - `--scrollbar-size`, `--scrollbar-radius`
  - `--scrollbar-track`, `--scrollbar-thumb`, `--scrollbar-thumb-hover`, `--scrollbar-thumb-border`
- Applied consistent scrollbar styling globally (`*`) and aligned `textarea` + `CodeMirror` + panel-specific scroll areas to the same token set.
- Removed hidden scrollbar rule on `.main-content` so scrollbars follow the unified visual style.

## 2026-04-15: ID Tool UX + Performance + Feedback Visibility
- ID card birth date input was redesigned from native `type="date"` to custom year/month/day selectors:
  - avoids browser-native calendar popup inconsistency and improves visual consistency.
- Improved light-theme readability for ID tool result messages:
  - success/error/info text and backgrounds now use higher-contrast light palette.
- Auth modal password eye icon duplication fixed:
  - explicitly hides browser-native password reveal controls (`::-ms-reveal` / `::-ms-clear`) and keeps only custom toggle.
- Feedback floating button visibility fixed on splash:
  - raised `.feedback-fab` z-index above splash poster layer so homepage can always see/click it.
- USCC tool extended to support both:
  - unified 18-digit social credit code
  - legacy three-certificate mode (工商注册号 / 组织机构代码 / 税务登记号)
  - validation now recognizes unified code, org code, and legacy 15-digit code formats.
- Conversion speed optimizations:
  - added frontend rules payload cache (rebuild only when rules revision changes)
  - added in-memory conversion result cache (same input+direction+rules version returns instantly)
  - auth token retrieval now short-circuits when in-memory token is still valid (avoids redundant `getSession` on each convert)
  - logout flow made optimistic (UI clears immediately, remote signout finishes in background with timeout fallback).

## 2026-04-15: Splash Font Stability + DOB Alignment
- Reduced splash large-title refresh jitter:
  - switched `.sp-hero-title` / `.sp-title` to stable local CJK/system font stack to avoid late webfont swap on refresh.
- Refined ID tool birth-date layout alignment:
  - replaced nested year/month/day sub-labels with clean single-line selectors (`年/月/日` in option text),
  - updated date-grid CSS so the birth-date row aligns with neighboring fields.

## 2026-04-15: Region Data First-Load Warmup (Near-Perceived Instant)
- Added idle-time warmup for administrative-region data in `app.js`:
  - schedule background `ensureRegionDataLoaded(false)` via `requestIdleCallback` (fallback `setTimeout`),
  - skip warmup on `saveData` / 2G-like connections to avoid harming constrained networks.
- Added in-flight promise de-duplication for region loading:
  - repeated calls now reuse `regionLoadPromise`, avoiding duplicate fetch/parse work during first interaction burst.
- Added cleanup on unmount:
  - cancels pending idle warmup callback/timer.
- Added resource hint in `index.html`:
  - `<link rel="prefetch" href="region_codes_2024.json" as="fetch"/>`
  - helps browser fetch region JSON earlier so first entry into ID tool is closer to no-wait.

## 2026-04-15: ID Tool Feedback + Workbench Return Home
- ID tool button feedback improved:
  - copy buttons now switch label from `复制` to `已复制` for a short duration after successful clipboard write.
  - verify buttons now switch label from `校验` to `已校验` for a short duration after each verify action.
- Repeated verify UX improved:
  - when the same input is verified repeatedly with the same outcome, result now shows a friendly reminder:
    - `已重新校验，结果与上次一致：...`
- Clipboard helper unified:
  - `clipboardWrite()` now returns `Promise<boolean>` so feature buttons can react to success/failure reliably.
- Added workbench header entry to return to splash homepage:
  - new `返回首页` button in header right action area.
  - wired to `goSplashHome()` in `app.js`, which delegates to `window.splashApi.showHome()` and falls back safely if unavailable.

## 2026-04-15: New Test Tool Page - 紫微斗数命盘
- Added a new submenu under `测试工具`:
  - existing: `证件号码生成`
  - new: `紫微斗数命盘` (`activePage='ziweiTool'`)
- Added a dedicated `ziweiTool` page in `index.html`:
  - 公历/农历切换输入
  - 农历闰月可用性判断与控制
  - 出生时分（24h, minute precision）+ 性别
  - action buttons: `排盘` / `复制命盘文本` / `导出命盘图片`
- Implemented frontend-only Zi Wei chart engine in `app.js`:
  - Gregorian↔Lunar conversion (1900-2100) via `Intl Chinese Calendar` + cache + leap-month handling
  - 子时(23:00)换日处理
  - 命宫/身宫计算
  - 十二宫安宫（命宫起逆时针）
  - 宫干起法（五虎遁）+ 命宫干支取局（纳音→五行局）
  - 紫微星定位（按日数/局数算法）
  - 紫微系 + 天府系主星布置
  - 辅曜/杂曜：左辅右弼、文昌文曲、魁钺、禄存羊陀、火铃、天空地劫、天马、红鸾天喜、天刑天姚
  - 四化标注（禄/权/科/忌）
  - 主星庙旺利平陷标记
  - 大限（顺逆 + 十年区间）与小限（按年支/性别方向）
  - 命盘文本汇总构建与复制
  - 命盘图片导出（动态加载 `html2canvas`）
- Added Zi Wei board UI + theme styles in `style.css`:
  - 4×4 方盘 grid (`grid-template-areas`) with center info block
  - 命宫/身宫视觉高亮
  - 主星/辅星/杂曜/四化标签颜色区分
  - dark/light theme variants + responsive adaptation
- Updated test-tools submenu expand capacity:
  - `.nav-submenu.open` max-height adjusted for two submenu items.

## 2026-04-15: ZiWei Chart Upgrade (Benchmark against Wenmo-style chart)
- Compared current ZiWei output against user-provided reference screenshot (`文墨天机基础版`) and identified main gaps:
  - palace-level info density too low (missing inline `流年/小限` sequences and `十二长生` feel)
  - center panel missing compact `四化总览`
  - missing bottom strip timeline for `大限/流年`
  - directional board hints missing
- Implemented enhancement pass in `app.js` + `index.html` + `style.css`:
  - Added palace metadata:
    - `流年序列` / `小限序列` per palace (`+12` progression display)
    - `十二长生` label per palace (based on element-cycle mapping)
  - Added center compact summary:
    - `输入历法` + `大限方向`
    - `四化总览` chip group (`禄/权/科/忌`)
  - Added bottom timeline bars:
    - row 1: `大限` 10段总览（range + 宫位）
    - row 2: `流年` 10年总览（year + 干支 + age）
  - Added board orientation labels:
    - `正南方 / 正西方 / 正北方 / 正东方`
  - Increased visual information hierarchy in palace cells:
    - age-sequence header lines
    - stronger main/assist/misc color separation
    - palace footer shows `长生 + 大限 + 地支`
- Kept all logic frontend-only and compatible with existing image export / text-copy flow.

## 2026-04-15: ZiWei Pro Upgrade (Professional Tooling Pass)
- Upgraded ZiWei module toward “professional-grade workflow” in `app.js` + `index.html` + `style.css`:
  - Added `命例名称` input for case identification.
  - Added `专业模式` switch to control advanced panels.
- Added interactive palace focus:
  - clicking any palace now sets focus state (`ziweiFocusBranch`)
  - focused palace rendered with clear active outline.
- Added professional detail panel (宫位详情):
  - displays focused palace `主星/辅星/杂曜/十二长生/大限/流年序列/小限序列`.
- Added generated analysis panel (摘要解盘):
  - auto-builds structured summary sections from key palaces (命宫/官禄/财帛/夫妻/迁移/疾厄 + 四化提示).
- Added local case history (命例历史):
  - auto-save latest 30 generated charts to localStorage
  - supports `载入` / `删除` / `清空`
  - history item includes timestamp and compact summary (年干支/五行局/命宫).
  - loading history re-runs chart generation without duplicate history insertion.
- Added history time formatter and exposed required methods/refs in Vue return:
  - `loadZiweiHistory`, `removeZiweiHistory`, `clearZiweiHistory`, `formatZiweiHistoryTime`.
- UI additions for pro workflow:
  - pro panels grid under timeline
  - dedicated history card style
  - light/dark theme adaptation for all newly-added pro components.

## 2026-04-16: ZiWei Phase-2 (三方四正 + 飞化追踪 + 流派切换)
- Added multi-school switch for ZiWei:
  - `传统四化` / `飞星四化` (`ziweiSchool`).
  - switching school triggers silent re-chart (no duplicate history).
- Implemented 三方四正 linkage:
  - computed branch set for focused palace (`本宫 + 对宫 + 三方`).
  - linked palaces are highlighted; focused palace remains strongest highlight.
  - pro detail panel shows 三方四正 chips.
- Implemented 飞化落宫追踪:
  - new track builder for both schools:
    - traditional: 生年四化 track
    - flying: 宫干飞化 tracks across 12 palaces
  - each track includes tag/star/source/target palace text.
  - added pro “飞化落宫追踪” panel with scoped list (focus palace prioritized).
  - palace cards now show `飞出/飞入` counters in flying mode.
- Enhanced chart model:
  - `chart.huaTracks`
  - per-cell `outgoingHuaCount` / `incomingHuaCount`
  - center now includes `schoolLabel`.
- Export text content upgraded:
  - includes flow school and 飞化追踪 lines in copied text output.
- Added missing Vue exports for all new pro states:
  - `ziweiSchool`, `ziweiSchoolLabel`, `ziweiSifangBranches`, `ziweiSifangCells`,
  - `ziweiFocusTracks`, `ziweiFocusTrackCount`.

## 2026-04-16: ZiWei Summary Upgrade (Professional Narrative Level)
- Upgraded `app.js::_zwBuildAnalysisPro(chart)` from short bullet-style hints to long-form professional narrative output.
- Added a new first section `命盘总论`:
  - auto-summarizes `出生年份 + 阴阳男女 + 农历信息 + 五行局 + 命主/身主 + 身宫落点`
  - includes current-year age and active `大限` position.
- Expanded all analysis sections into deeper, deterministic interpretation blocks:
  - `核心性格与命格基调`
  - `事业财运解析`
  - `感情婚姻与合作关系`
  - `健康与节奏管理`
  - `{当年}流年与四化焦点`
- Added dynamic evidence-chain extraction from盘面:
  - current active `大限` by age-range matching
  - current `流年落宫` by age → `liuNianSeries` mapping
  - star and四化 feature checks (`hasStar / hasAnyStar / hasHuaTag`) to generate targeted interpretation text.
- Retained existing UI contract (`title/text/metrics/evidence/explain/suggestions/risks`) so the detailed panel works without template changes.

## 2026-04-16: ZiWei Readability Upgrade (白话 + 专业双层)
- Added a user-friendly plain-language layer for each analysis section in `app.js::_zwBuildAnalysisPro(chart)`:
  - new field: `plain` (array of short, easy-to-read conclusions)
  - covers all sections: `命盘总论 / 核心性格 / 事业财运 / 感情关系 / 健康节奏 / 流年四化`
- Kept professional layer unchanged:
  - existing `evidence / explain / suggestions / risks` blocks remain for advanced users.
- Updated `index.html` summary detail panel:
  - inserted new block `先看这个（白话版）` before `依据` and `专业解读`.
- Updated `style.css`:
  - added dedicated visual style for `.ziwei-analysis-detail-block-plain`
  - added light-theme variant for readability consistency.

## 2026-04-16: ZiWei High-Priority Accuracy Upgrade
- Fixed age boundary logic in analysis:
  - replaced `currentYear - birthYear` rough age with exact birthday-aware age calculation
  - now subtracts one year when current date is before birthday.
- Added configurable clock correction pipeline in ZiWei input:
  - new options:
    - `校时模式`: `标准时间` / `真太阳时（经度+时差方程）`
    - `时区` (UTC, supports half-hour offsets)
    - `出生地经度`
  - true-solar mode applies minute correction:
    - `修正分钟 = (经度 - 时区中央经线) * 4`
  - corrected time is used for 时辰判定 and 子时换日流程.
- Added configurable rule switches for previously hard-coded methods:
  - `小限起法`:
    - `年支起小限（传统）`
    - `命宫起小限（简化）`
  - `流年起法`:
    - `年支顺排（默认）`
    - `随大限顺逆`
- Persisted all above new parameters into命例历史:
  - history save/load now includes `clockMode/timezoneOffset/longitude/xiaoXianRule/liuNianRule`.
- Added chart-center and text-export transparency fields:
  - shows clock mode, correction detail, small-limit rule, annual rule, and original input time for auditability.

## 2026-04-16: LiuNian Rule Chain Consistency Fix
- Fixed inconsistency between:
  - palace-level `流年序列`
  - bottom `流年总览` timeline.
- Added `app.js::_zwFindLiuNianBranchByAge(...)` and upgraded `_zwBuildLiuNianTimeline(...)`:
  - timeline now receives `liuNianFirstAgeMap + palaceNameByBranch`
  - each yearly item now includes resolved `branch/palaceName`, aligned with selected `流年起法`.
- Updated ZiWei timeline UI in `index.html`:
  - bottom `流年` row now displays:
    - `年份 + 干支 + 年龄 + 落宫`
- Updated text export in `app.js::_zwBuildChartText(chart)`:
  - `流年总览` lines now include branch/palace when available.

## 2026-04-16: True-Solar Correction Upgrade (EoT)
- Upgraded `真太阳时` from longitude-only rough correction to:
  - `总修正 = 经度修正 + 时差方程(EoT)`
- Implementation changes in `app.js`:
  - added `_zwGetDayOfYear(...)`
  - added `_zwComputeEquationOfTimeMinutes(...)`
  - enhanced `_zwApplyClockCorrection(...)` to return:
    - `correctionMinutes`
    - `longitudeCorrectionMinutes`
    - `equationOfTimeMinutes`
- Updated labels and hints:
  - `真太阳时（经度+时差方程）`
  - UI hint now explicitly explains EoT participation.
- Updated transparency outputs:
  - center panel + text export now include correction breakdown:
    - longitude component
    - equation-of-time component
  - status success message now reports total corrected minutes with decimal precision.

## 2026-04-16: ZiWei UI V3 (First Visual Pass)
- Added a dedicated V3 spec document:
  - `ZIWEI_UI_V3.md`
  - includes color semantics, hierarchy, interaction, responsive rules, and acceptance criteria.
- ZiWei input panel upgraded with explicit user flow chips:
  - `填写出生信息 -> 点击排盘 -> 先看白话摘要 -> 再看专业细解`.
- Introduced advanced settings collapse for expert options:
  - `高级参数（校时 / 起法）` now default-collapsed
  - shows compact summary line for current advanced config
  - auto-expands when selecting true-solar mode.
- Visual hierarchy tuning:
  - strengthened chart as primary visual focus
  - adjusted chart split ratio to favor image board panel
  - refined panel shadows/borders to reduce side-panel competition.
- Added new styling blocks in `style.css`:
  - `.ziwei-flow*`
  - `.ziwei-advanced-toggle*`
  - light-theme variants for both.

## 2026-04-16: ZiWei AI Personalization (Rule + AI Dual Layer)
- Added a new Supabase Edge Function: `supabase/functions/ziwei-analysis/index.ts`
  - Auth via Supabase `/auth/v1/user` bearer validation
  - CORS controlled by existing env set:
    - `CORS_PRIMARY_ORIGIN`
    - `CORS_ALLOWED_ORIGINS`
    - `ALLOW_LOCALHOST_ORIGIN`
  - Built-in rate limit (userId + IP) with envs:
    - `ZIWEI_AI_RATE_LIMIT_MAX_REQUESTS` (default 6)
    - `ZIWEI_AI_RATE_LIMIT_WINDOW_MS` (default 60000)
    - `ZIWEI_AI_RATE_LIMIT_TRACK_MAX` (default 2000)
  - AI provider envs:
    - `ZIWEI_AI_API_KEY` (or fallback `OPENAI_API_KEY`)
    - `ZIWEI_AI_MODEL` (default `gpt-4.1-mini`)
    - `ZIWEI_AI_BASE_URL` (default `https://api.openai.com/v1`)
    - `ZIWEI_AI_TIMEOUT_MS` (default 20000)
    - `ZIWEI_AI_MAX_CHART_CHARS` (default 24000)
- Registered function in `supabase/config.toml`:
  - `[functions.ziwei-analysis]`
  - `verify_jwt = false` (token is verified in-function via auth endpoint, same pattern as convert/feedback)
- Frontend integration (`app.js`, `index.html`, `style.css`):
  - Added `AI 深度解盘` action button on ZiWei panel
  - Added auto-trigger after successful chart generation (silent background fetch)
  - Added AI result card in professional area: overview, section breakdown, yearly focus, next actions
  - Added local in-memory cache keyed by chart signature to reduce repeated latency/cost
  - Kept deterministic rule-based summary as baseline; AI now provides personalization layer on top

## 2026-04-16: ZiWei AI Endpoint Robustness Fix
- Fixed duplicated path issue for Kimi-compatible endpoints:
  - previous behavior always appended `/chat/completions`, which could generate
    `/v1/chat/completions/chat/completions` when base URL already included the full path.
- Updated `supabase/functions/ziwei-analysis/index.ts`:
  - introduced `buildAiEndpoint(raw)` to normalize endpoint:
    - if base ends with `/chat/completions` => use as-is
    - if base ends with `/v1` => append `/chat/completions`
    - otherwise append `/v1/chat/completions`
- Result: supports both styles safely:
  - `https://api.moonshot.cn/v1`
  - `https://api.moonshot.cn/v1/chat/completions`

## 2026-04-17: Workbench Per-Page URL Routing
- Added URL routing for each main workbench view (hash-path based):
  - `#/workbench/ddl`
  - `#/workbench/function`
  - `#/workbench/procedure`
  - `#/workbench/id-tool`
  - `#/workbench/ziwei`
  - `#/workbench/rules`
  - `#/workbench/body-rules`
- Updated `app.js`:
  - introduced route <-> page mapping and normalization helpers
  - `setPage(...)` now updates browser URL via `history.pushState`
  - startup now reads URL route to set initial `activePage`
  - added `popstate` + `hashchange` listeners to support back/forward navigation
  - route can force splash/workbench view switching when needed.
- Updated startup behavior in `startup-view.js`:
  - startup view now prioritizes explicit URL route (`/workbench...` or `#/workbench...`)
    over `sqldev_last_view`.
- Updated `splash.js`:
  - entering workbench now ensures a canonical workbench route hash exists
  - returning splash now syncs URL to `#/splash`.
- Cache/version updates:
  - bumped `bootstrap.js` `ASSET_VERSION` to `20260417a` so new `app.js` is fetched
  - updated `index.html` script versions for `startup-view.js`, `splash.js`, `bootstrap.js`.

## 2026-04-17: Startup View Rule Adjustment
- Fixed splash refresh behavior:
  - removed `startup-view.js` fallback that auto-entered workbench from `localStorage.sqldev_last_view`.
  - startup selection now only follows explicit URL route:
    - workbench route => start in workbench
    - otherwise => start in splash.
- Updated `index.html` startup script cache version:
  - `startup-view.js?v=20260417b`.

## 2026-04-17: Splash Refresh Jump-to-DDL Fix (Auth Event Gate)
- Root cause:
  - `auth.js` fired `auth:login-success` during session restore (`INITIAL_SESSION`) on page load.
  - `splash.js` listens to `auth:login-success` and auto-enters workbench, so splash refresh jumped to DDL.
- Fix:
  - in `auth.js`, `auth:login-success` is now dispatched only for explicit `SIGNED_IN` events.
  - keeps normal post-login auto-enter behavior, but prevents refresh/session-restore from forcing workbench.
- Cache update:
  - bumped `index.html` auth script to `auth.js?v=20260417b`.

## 2026-04-17: Splash Login CTA Visibility + Hero Title Polish
- Homepage top-right auth CTA adjusted:
  - in `auth.js::updatePosterCta()`, splash button is no longer hidden after login
  - label now changes by state:
    - logged out: `注册 / 登录`
    - logged in: `进入工作台`.
- Homepage hero title visual refinement:
  - reduced heavy weight and size of `跨数据库 SQL 翻译`
  - updated typography to softer hierarchy:
    - `font-weight` from 700 -> 500
    - smaller max size and tighter letter spacing tuning
    - lighter accent gradient and subtle text shadow.
- Cache/version bumps in `index.html`:
  - `style.css?v=20260417m`
  - `auth.js?v=20260417c`.

## 2026-04-17: Splash Font Jitter Fix on Refresh
- Fixed visible font jump (large/small flicker) on splash refresh:
  - set splash page to local-font-first rendering:
    - `style.css`: `.sp-page` now uses local system Chinese font stack
    - `.sp-nav-logo-text` and `.sp-hero-title` switched to inherit local stack
  - changed Google Fonts loading behavior from `display=swap` to `display=optional`
    to avoid late forced font replacement on first paint.
- Cache/version update:
  - `index.html`: `style.css?v=20260417n`.

## 2026-04-20: ZiWei UI V3 Redesign (Three-Column, Light/Dark Matched)
- Implemented a new ZiWei page layout to match provided reference HTML and preview images:
  - left panel: actions + birth input flow + advanced params (collapsible)
  - center panel: board-focused chart canvas + timeline
  - right panel: AI analysis panel with sticky visual hierarchy.
- Kept existing core chart-generation algorithm and data model unchanged (`ziweiChart`, `ziweiAnalysis`, `ziweiAiResult`), focusing on UI/interaction reuse.
- Added a dedicated AI copy action:
  - new function `copyZiweiAnalysisText()` in `app.js`
  - copies structured AI解读 text (overview/sections/year focus), falls back to active summary analysis when AI data is unavailable.
  - added button-state feedback label `ziweiAiCopyButtonLabel` and timer lifecycle cleanup.
- Updated assets/versioning to avoid stale cache mismatch:
  - `bootstrap.js` `ASSET_VERSION` -> `20260420a`
  - `index.html`:
    - `style.css?v=20260420a`
    - `bootstrap.js?v=20260420a`
- Notes:
  - legacy ZiWei template block is temporarily disabled in `index.html` (`v-if="false && ...`) while new V3 template is active, to keep rollback-safe migration during this round.

## 2026-04-21: ZiWei QA/Board Alignment Refinement (Reference HTML Follow-up)
- QA panel interaction updated (right AI column):
  - moved `问 AI 命盘问题` input block above AI interpretation content.
  - after clicking QA send, UI now clears existing AI interpretation content first, then renders the new QA answer.
  - loading copy kept as `AI思考中...`.
- Board visual density reduced (center column):
  - narrowed overall board dominance by adjusting 3-column proportions and center panel spacing.
  - reduced palace min-height and tightened board shell padding for improved at-a-glance readability.
  - constrained image panel width with centered layout to avoid over-expansion on wide screens.
- Center card content aligned closer to reference `ziwei-chart (3).html`:
  - center info now follows reference-style key fields (姓名/阴阳/五行局/历法/真太阳时/钟表时间/农历/命主/身主/命宫/身宫/五行).
  - added `naYinLabel` to chart center model (`app.js`) and rendered as `五行`.
  - pillar display changed to dual-row textual style (节气四柱 / 非节气四柱) with aggregated text lines.
- Palace card content normalized toward reference rhythm:
  - removed in-card `命宫/身宫` badges from main palace content area.
  - kept top age line as `流年 + 小限` primary line; retained footer for长生/大限/地支.
- Files touched in this round:
  - `app.js` (center fields/computed exports, QA send clear behavior, payload extension)
  - `index.html` (QA block order + center/palace content structure)
  - `style.css` (layout proportion tuning + board/center typography and spacing refinement)

## 2026-04-21: ZiWei AI Request Guard + Thinking Duration + Share Poster Mode
- AI deep analysis interaction hardening:
  - deep-analysis button now calls `requestZiweiAiAnalysis()` (removed forced cache bypass).
  - added in-flight single-flight guard (`_ziweiAiInFlightPromise`) to prevent repeated click bursts from creating parallel AI requests.
  - deep-analysis request payload switched to compact builder (`_zwBuildAiPayloadCompact`) to reduce request body size and improve response speed.
- Thinking duration:
  - added `ziweiAiLastDurationMs` and `ziweiAiDurationText` (`X分YY秒`) for post-analysis timing display.
  - duration now updates after AI response completes (and on error path for diagnostics).
  - duration label rendered in right AI panel header area.
- ZiWei palace content alignment:
  - palace `流年` block expanded to multi-line metadata (流年/小限 + 大限/长生 + 流年序列), and related visual spacing tightened.
- Share poster feature:
  - added `generateZiweiSharePoster()` + modal preview UI + download action.
  - poster generation uses existing html2canvas path and auto-copies share URL.
  - added `ziwei_share` link mode (`?ziwei_share=1#/workbench/ziwei`), intended for shared access entry.
- Share-link constrained interface:
  - introduced `ziweiShareMode` route flag parsing.
  - when share mode is active, app normalizes route/page access to `ziweiTool` and applies shell-level UI lock style (hide sidebar/header/footer, keep ZiWei-only canvas view).
- Files touched in this round:
  - `app.js`
  - `index.html`
  - `style.css`

## 2026-04-21: ZiWei 1:1 Palace Rows + Center Layout + AI Resource Fallback + Premium Share Poster
- [2026-04-22 update] Completed AI 429 cooldown guard wiring:
  - `index.html`: AI deep-analysis buttons now disable with `ziweiAiRequestBlocked`.
  - `index.html`: AI QA send button now disables with `ziweiAiRequestBlocked`.
  - `app.js`: exported `ziweiAiRequestBlocked` for template binding.
  - `app.js`: clears `_ziweiAiCooldownTimer` inside main `onUnmounted`.
  - Validation: `node --check app.js` passed.

## 2026-04-22: Security + Performance Hardening Batch
- P0 ZiWei permission chain:
  - removed frontend hardcoded whitelist assignment in `supabase-config.js`.
  - added server-side email whitelist enforcement in `supabase/functions/ziwei-analysis/index.ts` via `ZIWEI_ALLOWED_EMAILS`.
- P0 error desensitization:
  - `convert` now returns normalized backend error codes (no raw internal message passthrough).
  - `ziwei-analysis` upstream AI failures are mapped to safe error codes, removing raw upstream body leakage.
  - `feedback` no longer returns storage backend detail text to client on insert failure.
  - frontend `app.js` maps backend error codes to user-friendly messages for convert/AI flows.
- P0 convert payload protection:
  - added `Content-Length` guard, JSON-depth guard, request-size estimation guard, and `rules` payload size guard in `supabase/functions/convert/index.ts`.
  - env knobs: `CONVERT_MAX_REQUEST_BYTES`, `CONVERT_MAX_RULES_BYTES`, `CONVERT_MAX_JSON_DEPTH`.
- P1 rate-limit store upgrade:
  - `convert`, `ziwei-analysis`, `feedback` now use Deno KV (persistent window counters) when available, with memory fallback.
  - env knobs: `CONVERT_RATE_LIMIT_STORE`, `ZIWEI_AI_RATE_LIMIT_STORE`, `FEEDBACK_RATE_LIMIT_STORE`.
- P1 first-screen speed:
  - removed homepage prefetch of `region_codes_2024.json`.
  - moved `supabase.js`/`supabase-config`/`auth.js`/`feedback.js` out of static critical path.
  - bootstrap supports lazy auth-stack loading (`window.__loadSqldevAuthNow`) and intent-based preload.
  - conversion/AI/feedback entry points can trigger lazy auth-stack load when needed.
- P1 feedback local draft privacy:
  - local draft persistence now stores minimal fields only (`category`, `content`, `source`, `scene`), excluding `userId`/`userEmail`.
- P1 frontend cleanup:
  - removed `_legacySubmitZiweiAiQuestionOne`, `_legacySubmitZiweiAiQuestionTwo`, `_zwLegacyRequestZiweiAiAnalysis`, `_zwLegacyRequestZiweiAiAnalysisV2`.
- P2 cache-busting strategy:
  - removed `?v=` query-string cache keys.
  - switched entry/static references to hash-suffixed filenames (`*.20260422a.*`) in `index.html` and `bootstrap.js`.
- 命盘宫位内容节奏对齐增强（向参考 HTML 靠拢）：
  - active ZiWei V3 模板中，宫位卡片改为“流年/小限一行 + 主星/辅星/杂曜三行”的固定阅读节奏。
  - 主星、辅星、杂曜三行都加入空状态占位（`--`），避免缺星时行高塌陷。
  - 引入 `ziwei-star-tag` / `ziwei-star-placeholder` 样式，增强三行视觉一致性。
- 命盘中央信息区布局优化：
  - 保留核心字段顺序并增加顶部元信息行（当前年/年龄）。
  - 四柱区改为“节气四柱 / 非节气四柱”双列，并拆分为“天干行 + 地支行”显示。
  - 新增并导出计算属性：
    - `ziweiJieqiPillarStemText`
    - `ziweiJieqiPillarBranchText`
    - `ziweiNonJieqiPillarStemText`
    - `ziweiNonJieqiPillarBranchText`
- AI 深度解盘稳定性修复（compute resources 报错）：
  - 统一生效的 `requestZiweiAiAnalysis` 为单版本逻辑（通过后置重定义覆盖 legacy 版本）。
  - 保持单飞请求（防重复点击并发）。
  - 首次请求使用 compact payload；当出现 `compute resources / out of memory / resource exhausted` 类错误时自动降载为 lite payload 重试。
  - 重试仍保持 `style: 'pro'`，并继续回写“思考耗时”。
- 分享海报重做为“功能优势型”海报：
  - 不再截取命盘图片。
  - 生成高质感深色渐变海报（标题、卖点卡片、体验入口、品牌文案）。
  - 仍保留分享链接复制与下载动作。
- 亮色主题可读性补强：
  - 宫内流年行、星曜文本、亮度文本、占位文本与四柱分行文本在 light 主题下提升对比度。
- 代码结构修整：
  - 避免历史逻辑继续覆盖：旧版 submit/request/share 函数标记为 legacy 名称，新逻辑使用原函数名输出到模板绑定。
## 2026-04-22: P2 构建形态切换（源码无 hash，dist 输出 hash）
- 目标调整：
  - 将“根目录直接维护 `*.20260422a.*` 副本”改为“源码保持无 hash，构建到 `dist/` 时再生成 hash 文件”。
- 前端入口回归源码名：
  - `index.html` 改回引用 `startup-view.js`、`style.css`、`splash.js`、`bootstrap.js`（不带版本后缀）。
- 引导器适配 manifest：
  - `bootstrap.js` 去除固定 `ASSET_HASH` 拼接逻辑。
  - 新增 `window.__SQDEV_ASSET_MANIFEST` 支持：构建产物中由 manifest 决定 `app/auth/feedback/rules/samples/supabase-config` 等真实 hash 文件名。
- 新增构建脚本：
  - `scripts/build-dist.mjs`
  - 功能：
    - 复制项目静态资源到 `dist/`
    - 为目标资源生成内容 hash 文件名（sha256 前 10 位）
    - 重写 `dist/index.html` 入口引用为 hash 文件
    - 注入 `window.__SQDEV_ASSET_MANIFEST` 供 `bootstrap.js` 动态加载使用
- 仓库清理：
  - 删除根目录旧版 `*.20260422a.*` 文件（10 个）。
  - `.gitignore` 新增 `dist/`，避免构建产物误提交。
