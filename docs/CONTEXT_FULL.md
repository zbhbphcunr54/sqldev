# SQDev Collaboration Context (Canonical)

Last updated: 2026-04-15

## 2026-04-22: 问答下拉建议乱码修复
- 修复位置：紫微问答输入框的建议下拉列表（server config suggestions）。
- 问题：个别建议文案中出现“身体X健康”中间汉字乱码。
- 处理：在前端对建议项新增轻量归一化函数，仅针对该模式修复为“身体与健康”。
- 实现文件：
  - `app.js`
    - 新增 `normalizeZiweiQaSuggestionText(text)`
    - `loadZiweiAiServerConfig()` 中 suggestions 映射改为先走归一化再过滤。

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

## 2026-04-22: ZiWei 502 稳定性热修
- 重建 `supabase/functions/ziwei-analysis/index.ts`：移除旧的乱码/残留逻辑，统一请求处理链路。
- 增强 AI 返回解析兼容性：
  - 同时兼容字符串、数组、对象三种 `message.content` 形态。
  - 对可重试上游异常（5xx/408/504）自动重试 1 次。
  - 维持 JSON 优先解析，失败时再做文本结构化兜底，减少 `ai_response_invalid`。
- 细化错误状态码映射：
  - `ai_upstream_rate_limited -> 429`
  - `ai_request_timeout` / `ai_upstream_timeout -> 504`
  - 其他 `ai_* -> 502`
- 保留并确认安全链路：
  - Bearer token 通过 Supabase `/auth/v1/user` 校验
  - `ZIWEI_ALLOWED_EMAILS` 邮箱白名单
  - CORS 白名单 + localhost 开关
  - `userId + IP` 速率限制（`config` 模式不计入限流）
- 前端补充了 `ai_backend_not_configured` 的友好提示映射（`app.js`）。

## 2026-04-22: 按 AI_DEV.md 执行的架构重构（Vue3 + TS + Vite）
- 新增现代前端工程基线：
  - `package.json`（Vue3 / TS / Vite / Pinia / Router / Tailwind / ESLint / Prettier）
  - `vite.config.ts`、`tsconfig*.json`、`tailwind.config.ts`、`postcss.config.cjs`、`eslint.config.ts`、`prettier.config.cjs`
  - `.editorconfig` 统一 UTF-8 / 2 空格 / LF
- 新增规范目录结构：
  - `src/api`：统一封装 edge function 请求
  - `src/lib/supabase.ts`：`createClient<Database>()`
  - `src/stores`：`auth` + `app(theme)` Pinia
  - `src/composables`：`useAuth`、`useAsyncState`、`useZiweiTool`
  - `src/router/index.ts`：路由与登录守卫
  - `src/pages`：Splash / Login / Workbench / Ziwei / NotFound
  - `src/components`：Header / Sidebar / Feedback / StatePanel / Ziwei 子组件
  - `src/styles/tokens.css` + `src/styles/main.css`（Design Tokens + Tailwind 组件层）
  - `src/types/supabase.ts`：Database 类型定义入口
- 入口迁移策略：
  - 新增 `index.vite.html` 作为 Vite 主入口（`/src/main.ts`）。
  - 旧 `index.html` 增加重定向脚本到 `index.vite.html`，平滑切换。
- 文档与环境：
  - 新增 `.env.example`（仅 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）
  - 新增 `README.md`、`docs/AI-DEV-RULES.md`

## 2026-04-22: 构建校验进展（重构后）
- `pnpm typecheck`：通过。
- `pnpm lint`：已收敛到 `src` 范围并可执行通过（当前仅剩格式/属性顺序 warning，无 error）。
- `pnpm build`：在当前系统环境失败，错误为 `spawn EPERM`（Node 子进程执行被系统层拦截，不是 TS 类型错误）。
- 处理动作：
  - 增加 `eslint.config.mjs`，脚本改为显式使用该配置。
  - 新增 `vite.config.mjs`，构建脚本改为显式使用该配置。

## 2026-04-22: Build 报错修复（Tailwind placeholder）
- 修复 `src/styles/main.css` 中 Tailwind 不兼容写法：
  - `placeholder:text-subtle/70`
  - 改为 `placeholder:text-subtle placeholder:opacity-70`
- 说明：`text-subtle` 是基于 CSS 变量的自定义色，`/70` 透明度语法在该场景下会导致 PostCSS/Tailwind `@apply` 解析失败。

## 2026-04-22: Build 报错修复（Tailwind focus ring）
- 修复 `src/styles/main.css` 中 `@apply` 不兼容类：
  - `focus:ring-brand-500/20`
  - 改为 `focus:ring-brand-500 focus:ring-opacity-20`
- 说明：对基于 CSS 变量扩展的颜色，`/20` 透明度后缀在 `@apply` 下可能无法展开；拆分为颜色类 + opacity 类可兼容。

## 2026-04-22: 无用代码文件清理（sqldev）
- 已删除旧架构遗留前端文件（根目录）：
  - `app.js`
  - `auth.js`
  - `bootstrap.js`
  - `feedback.js`
  - `font-loader.js`
  - `rules.js`
  - `samples.js`
  - `splash.js`
  - `startup-view.js`
  - `style.css`
  - `supabase-config.js`
- 已删除旧构建/依赖目录：
  - `scripts/build-dist.mjs`
  - `vendor/*`
- 清理配置残留：
  - `eslint.config.mjs` 去掉 `vendor/**` ignore 项。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev build` 构建通过（Vite build 成功）。
  - 保留并恢复 `og-image.png` / `og-image.svg`，避免社交分享预览失效。

## 2026-04-22: 回滚主界面入口到原UI（按用户要求）
- 用户要求“重构项目但保持原有界面视觉”；已从历史提交 `14109b9` 恢复旧界面核心文件：
  - `index.html`
  - `app.js` / `auth.js` / `bootstrap.js` / `feedback.js` / `splash.js` / `startup-view.js`
  - `style.css` / `supabase-config.js`
  - `vendor/*`
- 调整 `vite.config.mjs`：
  - `server.open` 从 `/index.vite.html` 改为 `/`
  - `build.rollupOptions.input` 从 `index.vite.html` 改为 `index.html`
- 验证：
  - `pnpm.cmd -C d:\codextest\sqldev build` 可通过（存在 non-module script 提示，但不阻塞构建）。

## 2026-04-22: UI一致性约束（用户明确要求）
- 约束更新：后续改造以“代码重构优先、视觉保持一致”为原则。
  - 首页与主工作台以当前 `index.html + style.css + app.js` 呈现为视觉基线，不做破坏式改版。
  - 仅允许非破坏性美化（字体细节、间距、对齐、对比度、动效顺滑度），不得改变信息架构与主要交互路径。
- 为避免进入两套界面：
  - `index.vite.html` 增加强制回跳 `index.html` 的重定向兜底逻辑。

## 2026-04-22: legacy UI 目录重整（不改页面布局）
- 目标：保持现有页面视觉与交互不变，同时把历史脚本收敛进重构目录，避免根目录散落多文件。
- 完成项：
  - 旧 UI 运行文件迁移到 `src/legacy/`：
    - `app.js` / `auth.js` / `bootstrap.js` / `feedback.js`
    - `font-loader.js` / `rules.js` / `samples.js`
    - `splash.js` / `startup-view.js` / `style.css` / `supabase-config.js`
    - `vendor/*`
  - `index.html` 引用路径统一改为 `src/legacy/*`（仅路径变化，不改布局结构）。
  - `src/legacy/bootstrap.js` 增加 `LEGACY_BASE` + `toLegacyPath()`，统一脚本加载路径，避免迁移后懒加载失效。
  - 删除旧的 legacy 构建脚本：`src/legacy/scripts/build-dist.mjs`。
  - `index.vite.html` 重建为干净的重定向壳页（统一跳转 `index.html`，避免双入口视觉偏差）。
- 构建支持：
  - `vite.config.mjs` 新增 `copyLegacyAssetsPlugin`，在 build 阶段把 `src/legacy` 复制到 `dist/src/legacy`，保证生产包可运行。
- 验证：
  - `pnpm.cmd -C d:\codextest\sqldev build` 通过。
  - `dist/src/legacy` 已包含 legacy 运行所需全部文件。
  - `index.vite.html` 已重建为 UTF-8 正常重定向壳页（无乱码）。

## 2026-04-23: 修复 Vite source map 读取报错（supabase.js）
- 问题：`vite dev` 启动时读取 `src/legacy/vendor/supabase.js` 末尾的绝对 source map 路径 `/sm/*.map`，本地不存在导致 ENOENT 警告。
- 修复：移除该文件末尾 `//# sourceMappingURL=/sm/...` 注释，避免 Vite 继续尝试读取无效 map。
- 验证：`rg -n "sourceMappingURL" src/legacy/vendor` 无结果。

## 2026-04-23: 按 docs/AI_DEV.md 继续落地目录与质量规范
- 保持既有页面视觉与 legacy iframe 运行方式不变，先完成低风险工程结构治理：
  - 新增 `src/layouts/DefaultLayout.vue`、`src/layouts/AuthLayout.vue`，将应用壳层从 `App.vue` 中拆出。
  - 新增 `src/router/guards.ts`，路由守卫在 Pinia 注册后安装，避免 store 初始化时序问题。
  - 将页面整理为目录式路由页：`src/pages/splash/index.vue`、`src/pages/workbench/index.vue`、`src/pages/workbench/ziwei.vue`、`src/pages/auth/login.vue`、`src/pages/not-found.vue`。
  - 将组件整理为 `components/layout`、`components/common`、`components/business/*`。
- 类型与 API 边界治理：
  - 新增 `src/types/database.types.ts` 与 `src/types/index.ts`，`src/lib/supabase.ts` 统一从 `@/types` 引入 `Database`。
  - 旧 `src/types/supabase.ts` 因 Windows 文件系统拒绝删除，已改为兼容 re-export，避免双份类型定义。
  - `src/api/http.ts` 改为复用 `src/utils/error-map.ts`，统一 4xx/5xx 用户提示，并支持服务端返回 `code` 字段。
  - `src/composables/useAuth.ts` 补齐登录、验证码登录、重置密码方法，登录页改为通过 composable 使用认证能力，降低页面与 Pinia store 的耦合。
- 测试与入口治理：
  - smoke 测试主文件移动到 `tests/smoke.mjs`，`package.json` 的 `test:smoke` 指向 `tests/`。
  - `scripts/smoke.mjs` 保留为兼容入口，转发到 `tests/smoke.mjs`。
  - 删除过渡期入口 `index.vite.html`，避免双入口混淆。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev typecheck` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev test:smoke` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev check:utf8` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev build` 通过；仍有 legacy 非 module script 的 Vite 提示，属于当前兼容期已知提示，不阻塞构建。

## 2026-04-23: 绞杀者模式迁移 Batch 1 - SQL 文本处理
- 迁移目标：先抽离 legacy 中低风险、无 DOM 依赖的 SQL 文本处理逻辑，形成可测试的规范模块。
- 完成内容：
  - 新增 `src/features/sql/sql-format.ts`，提供 `splitSqlStatements()` 与 `formatSqlText()`。
  - 新增 `src/features/sql/index.ts` 作为 feature barrel。
  - 新增 `src/features/sql/legacy-bridge.ts`，通过 `window.SQLDEV_SQL_UTILS` 暴露给 legacy 代码。
  - `legacy.html` 增加 module bridge 加载。
  - `src/legacy/app.js` 中 `splitStatements()` 与 `formatSqlText()` 优先调用新 bridge，保留原逻辑作为兜底，降低迁移风险。
  - 新增 `tests/sql-format.mjs`，使用 TypeScript transpile + VM 对 SQL 切分/格式化逻辑做独立测试。
  - `package.json` 增加 `test:sql`，`test` 与 `verify` 纳入 SQL 单测。
  - `tests/smoke.mjs` 增加 SQL feature bridge 与 legacy 调用约束，防止回退。
- 审查结果：
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev test` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev typecheck` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev build` 通过；仍有 legacy 非 module script 的 Vite 已知提示，不阻塞构建。
- 下一步建议：继续抽离 `app.js` 中 `clipboardWrite/saveFile` 或 `convert error mapping` 这类纯工具逻辑，再逐步拆 SQL 转换 API 调用与证件工具算法。

## 2026-04-23: 绞杀者模式迁移 Batch 2 - convert 错误映射
- 迁移目标：抽离 `src/legacy/app.js` 内部的 `mapConvertErrorMessage()`，统一转换服务错误码到用户提示的逻辑。
- 完成内容：
  - 新增 `src/features/convert/error-map.ts`，提供类型化的 `mapConvertErrorMessage()`。
  - 新增 `src/features/convert/index.ts` 作为 feature barrel。
  - 新增 `src/features/convert/legacy-bridge.ts`，通过 `window.SQLDEV_CONVERT_UTILS` 暴露给 legacy。
  - `legacy.html` 增加 convert bridge module 加载。
  - `src/legacy/app.js` 中原 `mapConvertErrorMessage()` 优先调用新 bridge，旧逻辑保留为兜底。
  - 新增 `tests/convert-error-map.mjs`，覆盖 401、engine_init_failed、conversion_failed、未知 4xx/5xx 等场景。
  - `package.json` 增加 `test:convert`，`test` 与 `verify` 纳入 convert 错误映射测试。
  - `tests/smoke.mjs` 增加 convert feature bridge 与 legacy 调用约束，防止回退。
- 审查发现并修复：
  - 单测发现 `engine_init_failed + 503` 曾被泛化 503 规则误判为鉴权不可用；已调整为明确错误码优先，避免误导排查。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev test` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev typecheck` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev check:utf8` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev build` 通过；仍有 legacy 非 module script 的 Vite 已知提示，不阻塞构建。
- 注意事项：
  - 本轮误将 `legacy.html` 交给 Prettier 处理过一次，造成 HTML 空白格式膨胀；由于该文件当前是迁移后的新增文件，Git 中没有直接可还原基线。后续建议单独从历史 `index.html` 重建干净 `legacy.html`，只保留路径迁移和 bridge script 差异。

## 2026-04-23: 收尾 legacy.html 格式化膨胀并继续绞杀者模式 Batch 3
- 收尾事项：
  - 从 Git 中的旧首页 `HEAD:index.html` 重建 `legacy.html`，恢复紧凑格式与正常中文。
  - 移除 legacy 页面中的 `redirectToViteEntry`，避免 iframe 进入 legacy 后跳回 Vite 入口。
  - 仅补回 legacy 必要资源：`src/legacy/startup-view.js`、`runtime-config.js`、`src/legacy/style.css`、CodeMirror CSS、`splash.js`、`bootstrap.js`，以及已迁移 feature bridge。
  - `legacy.html` 从约 214KB 回落到约 157KB，构建产物也回落到约 156.9KB。
- Batch 3 迁移目标：抽离 `src/legacy/app.js` 中的复制与 SQL 下载工具。
- 完成内容：
  - 新增 `src/features/browser/file-actions.ts`，提供：
    - `copyTextToClipboard()`
    - `downloadSqlTextFile()`
    - `resolveSqlFileExtension()`
    - `buildSqlDownloadFileName()`
  - 新增 `src/features/browser/index.ts` 作为 feature barrel。
  - 新增 `src/features/browser/legacy-bridge.ts`，通过 `window.SQLDEV_BROWSER_UTILS` 暴露给 legacy。
  - `legacy.html` 增加 browser bridge module 加载。
  - `src/legacy/app.js` 中 `clipboardWrite()` 与 `saveFile()` 优先调用新 bridge，旧逻辑保留为兜底。
  - 新增 `tests/browser-file-actions.mjs`，覆盖 SQL 文件扩展名和下载文件名生成规则。
  - `package.json` 增加 `test:browser`，`test` 与 `verify` 纳入 browser 工具测试。
  - `tests/smoke.mjs` 增加 browser feature bridge 与 legacy 调用约束，防止回退。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev test` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev typecheck` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev check:utf8` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev build` 通过；仍有 legacy 非 module script 的 Vite 已知提示，不阻塞构建。

## 2026-04-24: 绞杀者模式迁移 Batch 4 - Ziwei AI、路由、历史、展示与规则持久化
- 迁移目标：继续从 `src/legacy/app.js` 中抽离纯逻辑与本地持久化边界，保持页面视觉与交互不变。
- 完成内容：
  - 新增 `src/features/ziwei/ai-utils.ts`：
    - `trimZiweiText()`
    - `buildZiweiAiPayload()`
    - `buildZiweiAiPayloadLegacyCompact()`
    - `buildZiweiAiPayloadCompact()`
    - `buildZiweiAiPayloadLite()`
    - `parseZiweiInvokeError()`
    - `isZiweiComputeResourceError()`
    - `isZiweiAiRateLimitError()`
    - `mapZiweiAiErrorMessage()`
  - 新增 `src/features/ziwei/legacy-bridge.ts`，通过 `window.SQLDEV_ZIWEI_AI_UTILS` 暴露给 legacy；`src/legacy/app.js` 中对应 AI 载荷构建、错误解析、限流判断和提示映射优先调用 bridge。
  - 新增 `src/features/navigation/legacy-route.ts` 与 `legacy-bridge.ts`，抽离 `normalizeRoutePath()`、`parseRouteInfoFromPath()`、`parseRouteInfoFromLocation()`、`buildWorkbenchHash()`；legacy 侧改为优先调用 `window.SQLDEV_ROUTE_UTILS`。
  - 新增 `src/features/ziwei/history.ts` 与 `history-legacy-bridge.ts`，抽离历史命例读取、写入、标签生成与记录构建；legacy 侧 `_zwLoadHistory/_zwSaveHistory/_zwBuildHistoryLabel/_zwPushHistory` 优先调用新模块。
  - 新增 `src/features/ziwei/presentation.ts` 与 `presentation-legacy-bridge.ts`，抽离：
    - `formatZiweiHistoryTime()`
    - `formatZiweiDurationText()`
    - `isLikelyMojibakeZh()`
    - `normalizeZiweiQaSuggestionText()`
    legacy 侧对应时间格式化与问答乱码修复逻辑优先调用 bridge。
  - 新增 `src/features/rules/persistence.ts` 与 `legacy-bridge.ts`，抽离 DDL/body 规则 localStorage 读写与 hydrate 逻辑；legacy 顶部的 `_persistRules()`、`_load*FromStorage()`、`_hydrateRules()` 优先调用 `window.SQLDEV_RULE_STORAGE_UTILS`。
  - `legacy.html` 新增 module bridge 加载：
    - `src/features/navigation/legacy-bridge.ts`
    - `src/features/ziwei/legacy-bridge.ts`
    - `src/features/ziwei/history-legacy-bridge.ts`
    - `src/features/ziwei/presentation-legacy-bridge.ts`
    - `src/features/rules/legacy-bridge.ts`
  - `src/features/ziwei/index.ts` 改为统一 re-export AI、history、presentation 相关 typed 能力。
- 测试与验证：
  - 新增测试：
    - `tests/ziwei-ai-utils.mjs`
    - `tests/navigation-route.mjs`
    - `tests/ziwei-history.mjs`
    - `tests/ziwei-presentation.mjs`
    - `tests/rules-persistence.mjs`
  - `tests/smoke.mjs` 增加对新的 feature bridge、legacy 优先委托、测试复用 loader 的约束检查。
  - `package.json` 新增：
    - `test:ziwei`
    - `test:navigation`
    - `test:ziwei-history`
    - `test:ziwei-presentation`
    - `test:rules`
    并纳入 `test` / `verify`。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev verify` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev build` 通过。
  - 构建仍保留 3 条 legacy 非 module script 的 Vite 提示（`startup-view.js` / `splash.js` / `bootstrap.js`），属于兼容期已知提示，不阻塞产物。
- 当前收敛状态：
  - `app.js` 中已被类型化 feature 模块接管的高价值纯逻辑包括：SQL 文本处理、convert 错误映射、浏览器复制/下载、证件工具算法、紫微 AI 载荷/错误处理、路由解析、紫微历史记录、紫微展示格式化、规则持久化。
  - 仍待后续继续绞杀的热点主要剩余：主题/文件编码偏好存储、证件/紫微部分算法主体、分享海报绘制、转换调用 orchestration 与更大段 DOM/UI 状态编排。

## 2026-04-24: 绞杀者模式迁移 Batch 5 - 偏好存储、分享海报配置、DDL 基础工具
- 迁移目标：继续压缩 `src/legacy/app.js`、`src/legacy/splash.js`、`src/legacy/startup-view.js` 中的散落本地偏好存储与硬编码展示配置，让 legacy 侧只保留 UI/流程编排。
- 完成内容：
  - 新增 `src/features/preferences/storage.ts` 与 `legacy-bridge.ts`：
    - `getThemePreference()` / `saveThemePreference()`
    - `getFileEncodingPreference()` / `saveFileEncodingPreference()`
    - `getSidebarCollapsedPreference()` / `saveSidebarCollapsedPreference()`
    - `getLastViewPreference()` / `saveLastViewPreference()`
  - `src/legacy/app.js` 中 `themeMode`、`fileEncoding`、`sidebarCollapsed`、`goSplashHome()` 的本地存储优先委托 `window.SQLDEV_PREFERENCE_UTILS`。
  - 新增 `src/legacy/preferences-runtime.js`，为 `startup-view.js` 与 `splash.js` 提供统一的启动期偏好帮助器 `window.__SQDEV_PREFERENCES__`。
  - `src/legacy/startup-view.js` 与 `src/legacy/splash.js` 改为优先复用 `window.__SQDEV_PREFERENCES__` 读取/写入主题与 last view，减少启动层重复逻辑。
  - `legacy.html` 在 `startup-view.js` 前加载 `src/legacy/preferences-runtime.js`，保证启动期 helper 可用。
  - 新增 `src/features/ziwei/share.ts` 与 `share-legacy-bridge.ts`：
    - `buildZiweiShareLink()`
    - `createZiweiSharePosterSpec()`
    将紫微分享海报的尺寸、背景渐变、光晕、功能卡片、标题/副标题/入口文案等从 `generateZiweiSharePoster()` 中抽离为纯数据配置。
  - `src/legacy/app.js` 的 `buildZiweiShareLink()` 与 `generateZiweiSharePoster()` 现在优先调用 `window.SQLDEV_ZIWEI_SHARE_UTILS`，Canvas 绘制仍保留在 legacy 侧。
  - 新增 `src/features/ddl/parser-utils.ts` 与 `legacy-bridge.ts`：
    - `createDdlTableModel()`
    - `createDdlColumnModel()`
    - `createDdlViewModel()`
    - `splitColumnDefinitions()`
    - `extractParenthesizedBody()`
    - `splitListValues()`
    - `padText()`
  - `src/legacy/app.js` 顶部的 `makeTable/makeColumn/makeView/splitColumnDefs/extractParenBody/splitListValues/pad` 已优先委托 `window.SQLDEV_DDL_UTILS`。
  - `legacy.html` 新增 module bridge：
    - `src/features/preferences/legacy-bridge.ts`
    - `src/features/ziwei/share-legacy-bridge.ts`
    - `src/features/ddl/legacy-bridge.ts`
- 测试与验证：
  - 新增测试：
    - `tests/preferences-storage.mjs`
    - `tests/ziwei-share.mjs`
    - `tests/ddl-parser-utils.mjs`
  - `tests/smoke.mjs` 补充上述 bridge 与 legacy 优先委托断言。
  - `package.json` 新增：
    - `test:preferences`
    - `test:ziwei-share`
    - `test:ddl`
    并纳入 `test` / `verify`。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev verify` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev build` 通过。
  - 构建提示现在包含 `preferences-runtime.js` 与其余 legacy 非 module script 的 Vite 已知提示，属于兼容期提示，不阻塞产物。
- 当前收敛状态补充：
  - 启动层、首页层、工作台层的主题/last view 偏好已不再各自手写一份存储实现。
  - 紫微分享海报已从“全部写死在 Canvas 函数里”收敛到“数据规格 + legacy 绘制执行”的结构。
  - DDL 解析主流程尚未整体迁出，但最上层 IR 工厂与列表/括号/列定义拆分工具已经抽离，为后续拆 Oracle/MySQL/PostgreSQL 解析器做准备。

## 2026-04-24: 绞杀者模式迁移 Batch 6 - DDL 列定义解析与测试加载器升级
- 迁移目标：继续从 `src/legacy/app.js` 的 DDL 解析器中抽离高复用、低 UI 耦合的列定义解析逻辑。
- 完成内容：
  - 新增 `src/features/ddl/column-parsers.ts`：
    - `parseOracleColumnDefinition()`
    - `parseMySqlColumnDefinition()`
    - `parsePostgresColumnDefinition()`
  - `src/features/ddl/legacy-bridge.ts` 扩展导出上述 3 个列解析能力。
  - `src/legacy/app.js` 中：
    - `parseOracleColumn()`
    - `parseMySQLColumn()`
    - `parsePGColumn()`
    现已优先调用 `window.SQLDEV_DDL_UTILS`。
  - 新增 `tests/ddl-column-parsers.mjs`，覆盖 Oracle identity/inline PK、MySQL unsigned/comment、PostgreSQL timestamp precision/nullable 等关键列解析场景。
  - `package.json` 新增 `test:ddl-columns`，并纳入 `test` / `verify`。
- 基础设施增强：
  - 升级 `tests/helpers/load-ts-module.mjs`，支持被测 TypeScript 模块中的相对本地依赖递归加载，不再只能测试“零 import”单文件模块。
  - 这使得后续 feature 拆分可以正常依赖同目录 typed 工具，而不需要为了测试再刻意扁平化。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev test:ddl-columns` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev verify` 通过。
- 当前收敛状态补充：
  - DDL 解析层已抽离的能力包括：IR 工厂、列定义切分/括号提取/列表拆分、三大数据库列定义解析。
  - 真正尚未大拆的主要仍是：`parseOracleDDL()` / `parseMySQLDDL()` / `parsePostgreSQLDDL()` 主流程本身，以及程序块/紫微更大段 orchestration 逻辑。

## 2026-04-24: 绞杀者模式迁移 Batch 7 - DDL 后处理与建表区段提取
- 迁移目标：继续压缩 `src/legacy/app.js` 中 Oracle / PostgreSQL DDL 解析主流程的重复后处理逻辑，以及三套建表解析中重复的“定位平衡括号体”流程。
- 完成内容：
  - 新增 `src/features/ddl/postprocess.ts`，抽离：
    - `applyOracleCommentStatements()`
    - `applyOracleIndexStatements()`
    - `applyOraclePrimaryKeyStatements()`
    - `applyOracleForeignKeyStatements()`
    - `applyPostgresCommentStatements()`
    - `applyPostgresIndexStatements()`
    - `applyPostgresForeignKeyStatements()`
    - `applyPostgresPartitionStatements()`
  - `src/features/ddl/index.ts` 与 `legacy-bridge.ts` 扩展导出上述 postprocess 能力，legacy 侧通过 `window.SQLDEV_DDL_UTILS` 优先委托。
  - `src/legacy/app.js` 中：
    - `parseOracleDDL()` 的 COMMENT / INDEX / ADD PRIMARY KEY / ADD FOREIGN KEY 后处理已优先走 typed bridge。
    - `parsePostgreSQLDDL()` 的 COMMENT / INDEX / ADD FOREIGN KEY / PARTITION OF 后处理已优先走 typed bridge。
  - 在 `src/features/ddl/parser-utils.ts` 新增 `extractCreateTableSections()`，统一抽离：
    - 定位 `CREATE TABLE (...)` 起始括号
    - 识别引号内 `)` 不应提前闭合
    - 返回 `body` 与尾部 `trailing` 选项串
  - `src/legacy/app.js` 中的 `parseOracleDDL()` / `parseMySQLDDL()` / `parsePostgreSQLDDL()` 现已优先调用 `window.SQLDEV_DDL_UTILS.extractCreateTableSections()`，本地旧循环保留为兜底。
  - `tests/ddl-parser-utils.mjs` 增加 `extractCreateTableSections()` 覆盖场景。
  - 新增 `tests/ddl-postprocess.mjs`，覆盖 Oracle / PostgreSQL comment/index/fk/partition 后处理场景。
  - `tests/smoke.mjs` 补充：
    - DDL postprocess typed module 断言
    - legacy 对 `applyOracleCommentStatements()` 与 `extractCreateTableSections()` 的优先委托断言
    - `test.html` 改为可选校验，兼容仓库当前已无该文件的状态
  - `package.json` 新增 `test:ddl-postprocess`，并纳入 `test` / `verify`。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev test:ddl-postprocess` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev test:ddl` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev test:smoke` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev verify` 通过。
- 当前收敛状态补充：
  - DDL 解析器中最重复、最基础的“列解析”“后处理”“建表 body 提取”已经进入 typed feature 层。
  - 剩余最值得继续绞杀的部分，开始集中到三套 `parse*DDL()` 主循环本体中的约束/分区/索引内联解析，以及生成器和更大段业务 orchestration。

## 2026-04-24: 绞杀者模式迁移 Batch 8 - DDL 表级约束解析
- 迁移目标：继续从三套 `parse*DDL()` 主循环中抽离重复的表级约束/索引定义匹配逻辑，减少 legacy 主循环内的正则分叉。
- 完成内容：
  - 新增 `src/features/ddl/table-constraint-parsers.ts`，抽离：
    - `parseOracleTableConstraintDefinition()`
    - `parseMySqlTableConstraintDefinition()`
    - `parsePostgresTableConstraintDefinition()`
  - `src/features/ddl/index.ts` 与 `legacy-bridge.ts` 扩展导出上述 typed 约束解析能力。
  - `src/legacy/app.js` 中：
    - `parseOracleDDL()` 的表级 PK / UNIQUE / FK / CHECK 分支已优先委托 typed bridge。
    - `parseMySQLDDL()` 的 PRIMARY KEY / UNIQUE KEY / INDEX / FK / CHECK 分支已优先委托 typed bridge。
    - `parsePostgreSQLDDL()` 的 PK / UNIQUE / FK / CHECK / EXCLUDE 分支已优先委托 typed bridge。
  - 新增 `tests/ddl-table-constraint-parsers.mjs`，覆盖 Oracle / MySQL / PostgreSQL 的主键、唯一键、外键与忽略类约束场景。
  - `tests/smoke.mjs` 补充 typed 模块存在性与 legacy 优先委托断言。
  - `package.json` 新增 `test:ddl-constraints`，并纳入 `test` / `verify`。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev test:ddl-constraints` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev verify` 通过。
- 当前收敛状态补充：
  - DDL 解析侧已完成“基础 IR / body 提取 / 列定义解析 / 表级约束解析 / 后处理”五层拆分。
  - 继续往下最适合绞杀的下一层，已逐渐转向 DDL 生成器中的规则匹配与默认值转换逻辑。

## 2026-04-24: 绞杀者模式迁移 Batch 9 - DDL 规则匹配与默认值转换
- 迁移目标：继续从 DDL 生成器侧抽离规则驱动类型匹配与跨数据库默认值转换逻辑，减少 `src/legacy/app.js` 中生成器依赖的基础算法。
- 完成内容：
  - 新增 `src/features/ddl/type-mapping.ts`，抽离：
    - `parseDdlRuleSource()`
    - `matchesDdlRuleSource()`
    - `applyDdlRuleTarget()`
    - `mapDdlTypeByRules()`
    - `convertDdlDefaultValue()`
  - `src/features/ddl/index.ts` 与 `legacy-bridge.ts` 扩展导出上述 type-mapping 能力。
  - `src/legacy/app.js` 中：
    - `_parseDdlSource()`
    - `_matchDdlSource()`
    - `_applyDdlTarget()`
    - `_mapTypeByRules()`
    - `convertDefault()`
    现已优先委托 `window.SQLDEV_DDL_UTILS`。
  - 新增 `tests/ddl-type-mapping.mjs`，覆盖规则 source 解析、precision/scale 匹配、target 模板投影与 Oracle/MySQL/PostgreSQL 默认值转换。
  - `tests/smoke.mjs` 补充 type-mapping typed 模块与 legacy 优先委托断言。
  - `package.json` 新增 `test:ddl-type-mapping`，并纳入 `test` / `verify`。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev test:ddl-type-mapping` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev verify` 通过。
- 当前收敛状态补充：
  - DDL 生成器依赖的基础算法已进一步拆出：规则 source/target 解析、命中判定、target 投影、默认值转换。
  - 接下来继续绞杀时，最适合推进的是三套 DDL 生成器中的行拼接与分区输出，以及更大段 legacy orchestration / DOM 状态流。

## 2026-04-24: 绞杀者模式迁移 Batch 10 - DDL 输出构造与视图生成
- 迁移目标：继续清理 DDL / View 生成器中重复的输出拼接逻辑，让 legacy 生成器更多只保留流程编排。
- 完成内容：
  - 新增 `src/features/ddl/output-builders.ts`，抽离：
    - `escapeDdlSqlLiteral()`
    - `buildOracleCommentLines()`
    - `buildPostgresCommentLines()`
    - `buildOracleIndexLines()`
    - `buildPostgresIndexLines()`
    - `buildOracleForeignKeyLines()`
    - `buildPostgresForeignKeyLines()`
    - `buildMySqlInlineConstraintLines()`
  - `src/features/ddl/index.ts` 与 `legacy-bridge.ts` 扩展导出上述 output builder 能力。
  - `src/legacy/app.js` 中：
    - Oracle 生成器的 comment / index / foreign key 语句已优先委托 typed builder。
    - MySQL 生成器的 PRIMARY KEY / UNIQUE KEY / INDEX / FOREIGN KEY 内联约束行已优先委托 typed builder。
    - PostgreSQL 生成器的 comment / index / foreign key 语句已优先委托 typed builder。
  - 新增 `tests/ddl-output-builders.mjs`，覆盖 SQL 字面量转义、Oracle/PostgreSQL 注释/索引/外键输出、MySQL 内联约束输出。
  - `tests/smoke.mjs` 补充 output builder typed 模块与 legacy 优先委托断言。
  - `package.json` 新增 `test:ddl-output`，并纳入 `test` / `verify`。
- 额外推进：
  - 新增 `src/features/ddl/view-generators.ts`，抽离：
    - `generateOracleViewStatements()`
    - `generateMySqlViewStatements()`
    - `generatePostgresViewStatements()`
    通过注入 query transformer callback 的方式保留与 legacy `transformViewQuery()` 的兼容。
  - `src/features/ddl/index.ts` 与 `legacy-bridge.ts` 扩展导出 view generator 能力。
  - `src/legacy/app.js` 中 `generateOracleViews()` / `generateMySQLViews()` / `generatePGViews()` 已在函数入口优先委托 typed 模块。
  - 新增 `tests/ddl-view-generators.mjs`，覆盖三种数据库视图生成输出。
  - `tests/smoke.mjs` 补充 DDL view generator 模块与 legacy 委托断言。
  - `package.json` 新增 `test:ddl-views`，并纳入 `test` / `verify`。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev test:ddl-output` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev test:ddl-views` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev verify` 通过。
- 当前收敛状态补充：
  - DDL / View 生成侧的基础拼接逻辑已明显收束进 typed feature 层。
  - 继续绞杀时，剩余更重的部分开始集中到分区输出主流程、`parseExtraDDL()`、`transformBody()` 与更大段 legacy 页面 orchestration。

## 2026-04-24: 绞杀者模式迁移 Batch 11 - Extra DDL 与视图解析
- 迁移目标：继续从 legacy 中抽离附加 DDL 解析/生成与视图解析逻辑，让 `convertDDL()` 周边依赖更多进入 typed feature 层。
- 完成内容：
  - 新增 `src/features/ddl/extra-ddl.ts`，抽离：
    - `createEmptyExtraDdlParseResult()`
    - `parseAlterColumnTypeDefinition()`
    - `parseAddColumnDefinition()`
    - `parseExtraDdlStatements()`
    - `convertExtraColumnType()`
    - `generateExtraDdlStatements()`
  - `src/features/ddl/index.ts` 与 `legacy-bridge.ts` 扩展导出 extra DDL 能力。
  - `src/legacy/app.js` 中：
    - `parseExtraDDL()`
    - `parseAlterColType()`
    - `parseAddCol()`
    - `convertExtraColType()`
    - `generateExtraDDL()`
    现已优先委托 `window.SQLDEV_DDL_UTILS`。
  - 新增 `tests/ddl-extra-ddl.mjs`，覆盖 sequence、alter column、add column、额外 DDL 输出生成。
  - `tests/smoke.mjs` 补充 extra DDL typed 模块与 legacy 委托断言。
  - `package.json` 新增 `test:ddl-extra`，并纳入 `test` / `verify`。
- 额外推进：
  - 新增 `src/features/ddl/view-parsing.ts`，抽离：
    - `parseViewStatements()`
    - `transformViewQueryText()`
  - `src/features/ddl/index.ts` 与 `legacy-bridge.ts` 扩展导出 view parsing 能力。
  - `src/legacy/app.js` 中 `parseViews()` 与 `transformViewQuery()` 已在函数入口优先委托 typed 模块。
  - 新增 `tests/ddl-view-parsing.mjs`，覆盖视图列别名、FORCE/OR REPLACE、CHECK OPTION、COMMENT ON VIEW 及 Oracle->PostgreSQL 的 `FROM DUAL` 去除逻辑。
  - `tests/smoke.mjs` 补充 DDL view parsing 模块与 legacy 委托断言。
  - `package.json` 新增 `test:ddl-view-parse`，并纳入 `test` / `verify`。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev test:ddl-extra` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev test:ddl-view-parse` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev verify` 通过。
- 当前收敛状态补充：
  - View 链路已覆盖“解析 + query 变换包装 + 生成”三层 typed 化。
  - Extra DDL 链路已覆盖“解析 + 类型转换包装 + 输出生成”三层 typed 化。
  - 当前最值得继续绞杀的重块开始集中到 `transformBody()`、`convertDDL()` 主 orchestration，以及更大段页面侧状态编排。

## 2026-04-24: 绞杀者模式迁移 Batch 12 - Body 规则引擎
- 迁移目标：从函数/存储过程翻译主链中抽离规则分类、参数类型映射与 body 规则变换，降低 `transformBody()` / `mapParamType()` 周边 legacy 厚度。
- 完成内容：
  - 新增 `src/features/rules/body-transform.ts`，抽离：
    - `getBodyRuleCategories()`
    - `mapParamTypeByRules()`
    - `transformBodyByRules()`
  - `src/features/rules/index.ts` 与 `legacy-bridge.ts` 扩展导出上述规则引擎能力。
  - `src/legacy/app.js` 中：
    - `mapParamType()`
    - `_getTypeCategories()`
    - `transformBody()`
    现已优先委托 `window.SQLDEV_RULE_STORAGE_UTILS`。
  - 新增 `tests/body-transform.mjs`，覆盖：
    - 库对分类解析
    - `%ROWTYPE` -> `RECORD`
    - 参数类型规则映射
    - body 规则顺序应用
    - 同库时保持原文不变
  - `tests/smoke.mjs` 补充 body rule transform 模块与 legacy 委托断言。
  - `package.json` 新增 `test:body-transform`，并纳入 `test` / `verify`。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev test:body-transform` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev verify` 通过。
- 当前收敛状态补充：
  - 函数/过程翻译链最上层依赖的 body rules 基础引擎已经 typed 化。
  - 继续绞杀时，最值得推进的主块开始更明确地收敛到 `convertDDL()` 主 orchestration、函数/过程解析器本体，以及页面层大段状态编排。

## 2026-04-24: 绞杀者模式迁移 Batch 13 - DDL 主转换编排
- 迁移目标：把 `convertDDL()` 的主 orchestration 从 legacy 中抽离出来，同时尽量复用现有 parser / generator，避免改动页面表现。
- 完成内容：
  - 新增 `src/features/ddl/conversion-orchestrator.ts`，抽离 `convertDdlOrchestrated()`。
  - 新的 orchestration 模块负责：
    - 输入校验
    - source/target db 合法性判断
    - tables / views / extra DDL 解析调用
    - table/view/extra 输出生成调用
    - 汇总 header 生成
    - 各阶段错误降级提示
  - 设计上不直接依赖 legacy 实现，而是通过依赖注入接收：
    - `parse*DDL`
    - `parseViews`
    - `parseExtraDDL`
    - `generate*DDL`
    - `generate*Views`
    - `generateExtraDDL`
    - `labels`
  - `src/features/ddl/index.ts` 与 `legacy-bridge.ts` 扩展导出 `convertDdlOrchestrated()`。
  - `src/legacy/app.js` 中 `convertDDL()` 现已在函数入口优先委托 `window.SQLDEV_DDL_UTILS.convertDdlOrchestrated()`，并把现有 parser / generator / label 作为依赖注入。
  - 新增 `tests/ddl-conversion-orchestrator.mjs`，覆盖：
    - 空输入
    - 同库转换
    - 不支持数据库
    - 纯表转换 header 汇总
    - 视图 + extra DDL 混合输出拼接
  - `tests/smoke.mjs` 补充 conversion orchestrator typed 模块与 legacy 委托断言。
  - `package.json` 新增 `test:ddl-convert`，并纳入 `test` / `verify`。
- 验证结果：
  - `pnpm.cmd -C d:\codextest\sqldev test:ddl-convert` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev lint` 通过。
  - `pnpm.cmd -C d:\codextest\sqldev verify` 通过。
- 当前收敛状态补充：
  - DDL 主转换链已经从“legacy 内部一整段过程式大函数”变成“typed orchestration + legacy 注入现有能力”的结构。
  - 继续绞杀时，最值得继续正面推进的是函数/过程解析器本体，以及页面层大段状态编排。

## 2026-04-24: Strangler Mode Batch 14 - Routine Parser Primitives
- Goal:
  - Extract routine parameter parsing and declaration parsing out of `src/legacy/app.js` while keeping current UI behavior unchanged.
- Completed:
  - Added `src/features/routines/parser-primitives.ts`.
  - Added `src/features/routines/index.ts` and `src/features/routines/legacy-bridge.ts`.
  - Added `tests/routine-parser-primitives.mjs`.
  - Added `test:routines` to `package.json`, and included it in `test` / `verify`.
  - Updated `legacy.html` to load the routine bridge.
  - Updated `src/legacy/app.js` to prefer typed bridges for routine param parsing, Oracle declaration parsing, MySQL declaration extraction, PostgreSQL declaration extraction, and routine param list splitting.
- Extra fixes:
  - Fixed `src/features/rules/legacy-bridge.ts` import/export mismatch that only surfaced in `vite build`.
  - Converted the top-level legacy script tags in `legacy.html` to `type="module"` so `legacy.html` now builds cleanly under Vite.
- Verification:
  - `pnpm.cmd -C d:\codextest\sqldev test:routines`
  - `pnpm.cmd -C d:\codextest\sqldev test`
  - `pnpm.cmd -C d:\codextest\sqldev verify`
  - `pnpm.cmd -C d:\codextest\sqldev build`
  - All passed.

## 2026-04-24: Strangler Mode Batch 15 - Routine Function / Procedure Parsers
- Goal:
  - Continue shrinking `src/legacy/app.js` by extracting Oracle / MySQL / PostgreSQL routine parser bodies into typed feature modules.
- Completed:
  - Added shared helper `src/features/routines/header-utils.ts`.
  - Added `src/features/routines/function-parsers.ts`.
  - Added `src/features/routines/procedure-parsers.ts`.
  - Added tests:
    - `tests/routine-function-parsers.mjs`
    - `tests/routine-procedure-parsers.mjs`
  - Added package scripts:
    - `test:routines-functions`
    - `test:routines-procedures`
  - Updated `src/features/routines/index.ts` and `src/features/routines/legacy-bridge.ts` to expose typed function / procedure parsers.
  - Updated `src/legacy/app.js` to prefer typed function / procedure parsers before falling back to legacy inline implementations.
- Behavior notes:
  - PostgreSQL routine names now preserve schema-qualified names such as `public.demo_flag` and `public.demo_proc`.
- Verification:
  - `pnpm.cmd -C d:\codextest\sqldev test:routines-functions`
  - `pnpm.cmd -C d:\codextest\sqldev test:routines-procedures`
  - `pnpm.cmd -C d:\codextest\sqldev verify`
  - `pnpm.cmd -C d:\codextest\sqldev build`
  - All passed.

## 2026-04-27: Strangler Mode Batch 16 - Routine Conversion Orchestration
- Goal:
  - Continue shrinking `src/legacy/app.js` by extracting routine conversion entry orchestration (`convertFunction` / `convertProcedure`) into a typed feature module, while preserving existing parser/generator behavior.
- Completed:
  - Added `src/features/routines/conversion-orchestrator.ts`, exposing:
    - `convertFunctionOrchestrated()`
    - `convertProcedureOrchestrated()`
  - Updated `src/features/routines/index.ts` and `src/features/routines/legacy-bridge.ts` to expose the new orchestration APIs via `window.SQLDEV_ROUTINE_UTILS`.
  - Updated `src/legacy/app.js`:
    - `convertFunction()` now prefers `window.SQLDEV_ROUTINE_UTILS.convertFunctionOrchestrated(...)`.
    - `convertProcedure()` now prefers `window.SQLDEV_ROUTINE_UTILS.convertProcedureOrchestrated(...)`.
    - Legacy inline orchestration remains as fallback.
  - Added test `tests/routine-conversion-orchestrator.mjs`.
  - Added npm script `test:routines-convert`, and included it in `test` / `verify`.
  - Updated `tests/smoke.mjs`:
    - Added typed module existence assertions for routine conversion orchestration.
    - Added legacy bridge preference assertions for routine conversion orchestration.
    - Added loader-sharing assertion coverage for the new test file.
- Current convergence update:
  - Routine chain has now covered parser primitives, function/procedure parsers, generators, and conversion entry orchestration in typed modules.
  - Remaining heavy legacy zones are increasingly concentrated in large page-level state / DOM orchestration and deep UI flow coupling in `src/legacy/app.js`.

## 2026-04-27: Strangler Mode Batch 17 - Navigation Page-State Helpers
- Goal:
  - Continue strangler migration by extracting low-risk page-state decision logic from `src/legacy/app.js` (page key normalization, Ziwei access normalization, and page transition effects).
- Completed:
  - Added `src/features/navigation/page-state.ts`, exposing:
    - `normalizeLegacyPageKey()`
    - `normalizeAccessibleLegacyPage()`
    - `resolveLegacyPageTransition()`
  - Extended `src/features/navigation/legacy-bridge.ts` to expose the new page-state helpers via `window.SQLDEV_ROUTE_UTILS`.
  - Updated `src/legacy/app.js`:
    - `normalizePageKey()` now prefers `window.SQLDEV_ROUTE_UTILS.normalizeLegacyPageKey(...)`.
    - `normalizeAccessiblePage()` now prefers `window.SQLDEV_ROUTE_UTILS.normalizeAccessibleLegacyPage(...)`.
    - `applyPageState()` now prefers `window.SQLDEV_ROUTE_UTILS.resolveLegacyPageTransition(...)` for transition effects (expand test tools / preload region data / close mobile sidebar), with legacy fallback preserved.
  - Added `tests/navigation-page-state.mjs`.
  - Added npm script `test:navigation-page-state`, and included it in `test` / `verify`.
  - Updated `tests/smoke.mjs`:
    - Added typed module existence assertion for navigation page-state helpers.
    - Added legacy delegate assertions for page accessibility and page transition helper usage.
    - Added loader-sharing assertion for the new navigation page-state test.
- Current convergence update:
  - Navigation flow now has typed route parsing + typed page-state decision helpers, while legacy retains UI rendering and side-effect execution.
  - Remaining heavier legacy areas are increasingly centered on deeper DOM/event orchestration and cross-feature runtime coupling.

## 2026-04-27: Strangler Mode Batch 18 - Workbench UI-State + Event Decision Helpers
- Goal:
  - Complete the prior “next focus” items by extracting low-risk workbench UI-state helpers and reusable event/action decision logic from `src/legacy/app.js` into typed navigation modules, then delegating through bridge APIs with fallbacks.
- Completed:
  - Added `src/features/navigation/workbench-state.ts`, exposing:
    - `resolveLegacySidebarHoverState()`
    - `resolveLegacyTestToolsMenuToggleState()`
    - `shouldLegacyCloseSidebarForSplash()`
  - Added `src/features/navigation/workbench-actions.ts`, exposing:
    - `resolveLegacyPrimaryWorkbenchPage()`
    - `resolveLegacyWorkbenchActionDecision()`
  - Added `src/features/navigation/event-decisions.ts`, exposing:
    - `shouldLegacyCloseRulesMenuOnEscape()`
    - `resolveLegacyPrimaryHotkeyTarget()`
    - `resolveLegacyOutsideClickDecision()`
  - Updated `src/features/navigation/index.ts` and `src/features/navigation/legacy-bridge.ts` to export and expose all new helpers via `window.SQLDEV_ROUTE_UTILS`.
  - Updated `src/legacy/app.js`:
    - `handleSidebarHover()` now prefers `resolveLegacySidebarHoverState(...)`.
    - `toggleTestToolsMenu()` now prefers `resolveLegacyTestToolsMenuToggleState(...)`.
    - `runPrimaryAction()` now prefers `resolveLegacyPrimaryWorkbenchPage(...)`.
    - `goSplashHome()` now prefers `shouldLegacyCloseSidebarForSplash(...)`.
    - `runWorkbenchAction()` now prefers `resolveLegacyWorkbenchActionDecision(...)`.
    - global keydown handler now prefers:
      - `shouldLegacyCloseRulesMenuOnEscape(...)`
      - `resolveLegacyPrimaryHotkeyTarget(...)`
    - outside-click handler now prefers `resolveLegacyOutsideClickDecision(...)`.
    - legacy inline branches remain as fallback paths.
  - Added `tests/navigation-workbench-helpers.mjs`.
  - Added npm script `test:navigation-workbench`, and included it in `test` / `verify`.
  - Updated `tests/smoke.mjs`:
    - Added typed module existence assertions for workbench-state / workbench-actions / event-decisions.
    - Added legacy delegation assertions for the newly bridged navigation helpers.
    - Added loader-sharing assertion for the new navigation workbench helper test.
- Current convergence update:
  - Previous “next focus” items (UI-state helper extraction, event decision extraction, and conversion/tool-panel decision thinning) are now covered by typed navigation helper modules + bridge-first legacy delegation.
  - Remaining migration work is now mainly in deeper DOM mutation execution paths and heavyweight runtime orchestration blocks, rather than branch decision logic.

## Current next focus
- Continue shrinking large DOM mutation execution blocks in `src/legacy/app.js` where side effects are still directly coupled to UI rendering lifecycle.
- Prioritize extracting stable side-effect orchestration wrappers only when behavior can be guaranteed unchanged.

## 2026-04-27: Strangler Mode Batch 20 - Route Sync Decision Helper
- Goal:
  - Continue shrinking `src/legacy/app.js` by extracting route synchronization branch decisions from `syncRouteForPage()` into a typed navigation helper while preserving current history/hash side-effect behavior.
- Completed:
  - Added `src/features/navigation/route-sync.ts`, exposing:
    - `resolveLegacyRouteSyncDecision()`
  - Updated `src/features/navigation/index.ts` and `src/features/navigation/legacy-bridge.ts` to export and expose the new helper via `window.SQLDEV_ROUTE_UTILS`.
  - Updated `src/legacy/app.js`:
    - `syncRouteForPage()` now prefers `window.SQLDEV_ROUTE_UTILS.resolveLegacyRouteSyncDecision(...)` for sync strategy resolution.
    - Legacy inline branch logic remains as fallback when bridge is unavailable.
  - Added test `tests/navigation-route-sync.mjs`.
  - Added npm script `test:navigation-route-sync`, and included it in `test:navigation-suite`.
  - Updated `tests/smoke.mjs`:
    - Added typed module existence assertion for route-sync helper.
    - Added legacy delegation assertion for route-sync helper usage.
    - Added loader-sharing assertion coverage for the new test file.
- Current convergence update:
  - Navigation path now also covers typed route-sync strategy decisions, further reducing inline routing branch logic in legacy.
  - Remaining migration work is increasingly concentrated in heavy DOM mutation execution and broader runtime orchestration blocks.

## 2026-04-27: Strangler Mode Batch 19 - Route Application Decision Helper
- Goal:
  - Continue shrinking `src/legacy/app.js` by extracting route-application branch decisions from `applyRouteFromLocation()` into a typed navigation helper while preserving side-effect execution in legacy.
- Completed:
  - Added `src/features/navigation/route-application.ts`, exposing:
    - `resolveLegacyRouteApplicationDecision()`
  - Updated `src/features/navigation/index.ts` and `src/features/navigation/legacy-bridge.ts` to export and expose the new helper via `window.SQLDEV_ROUTE_UTILS`.
  - Updated `src/legacy/app.js`:
    - `applyRouteFromLocation()` now prefers `window.SQLDEV_ROUTE_UTILS.resolveLegacyRouteApplicationDecision(...)`.
    - Legacy inline branch logic remains as fallback when bridge is unavailable.
  - Added test `tests/navigation-route-application.mjs`.
  - Added npm script `test:navigation-route-application`, and included it in `test:navigation-suite`.
  - Updated `tests/smoke.mjs`:
    - Added typed module existence assertion for route-application helper.
    - Added legacy delegation assertion for route-application helper usage.
    - Added loader-sharing assertion coverage for the new test file.
- Current convergence update:
  - Route parsing, page-state normalization, workbench/event decision helpers, splash/workbench effect decisions, and route-application branching are now all covered in typed navigation modules with bridge-first legacy delegation.
  - Remaining migration work is increasingly concentrated in heavier DOM mutation execution and cross-feature runtime coupling blocks.

## 2026-04-27: Strangler Mode Batch 21 - Primary Action Handler Decision Helper
- Goal:
  - Continue shrinking `src/legacy/app.js` by extracting `runPrimaryAction()` page→handler mapping into a typed navigation helper, while preserving existing invocation behavior and fallback.
- Completed:
  - Updated `src/features/navigation/workbench-actions.ts`, adding:
    - `resolveLegacyPrimaryActionHandlerName()`
  - Updated `src/features/navigation/index.ts` and `src/features/navigation/legacy-bridge.ts` to export and expose the new helper via `window.SQLDEV_ROUTE_UTILS`.
  - Updated `src/legacy/app.js`:
    - `runPrimaryAction()` now prefers `window.SQLDEV_ROUTE_UTILS.resolveLegacyPrimaryActionHandlerName(...)`.
    - Existing page-based fallback mapping remains intact when bridge helper is unavailable.
  - Updated `tests/navigation-workbench-helpers.mjs` with helper behavior assertions.
  - Updated `tests/smoke.mjs`:
    - Added typed module existence assertion for primary action handler helper.
    - Added legacy delegation assertion for primary action handler helper usage.
- Current convergence update:
  - Primary workbench execution entry now consumes typed handler-decision output, reducing another inline branch cluster in legacy navigation/actions.
  - Remaining migration work stays concentrated in heavier DOM mutation execution and deeper runtime side-effect orchestration blocks.

## 2026-04-27: Strangler Mode Batch 22 - Settings Menu Key Decision Helper
- Goal:
  - Continue shrinking `src/legacy/app.js` by extracting settings dropdown keyboard navigation decision branches from `handleMenuKey()` into typed navigation helpers.
- Completed:
  - Updated `src/features/navigation/event-decisions.ts`, adding:
    - `resolveLegacyMenuKeyDecision()`
  - Updated `src/features/navigation/index.ts` and `src/features/navigation/legacy-bridge.ts` to export and expose the new helper via `window.SQLDEV_ROUTE_UTILS`.
  - Updated `src/legacy/app.js`:
    - `handleMenuKey()` now prefers `window.SQLDEV_ROUTE_UTILS.resolveLegacyMenuKeyDecision(...)` for focus/close decisions.
    - Existing inline key-branch logic remains as fallback when bridge helper is unavailable.
  - Updated `tests/navigation-workbench-helpers.mjs` with menu-key decision assertions.
  - Updated `tests/smoke.mjs`:
    - Added typed module existence assertion for menu-key decision helper.
    - Added legacy delegation assertion for menu-key decision helper usage.
- Current convergence update:
  - Dropdown keyboard decision branches now route through typed navigation helpers, continuing gradual removal of inline legacy branch logic.
  - Remaining migration work still centers on heavy DOM mutation execution and larger side-effect orchestration blocks.

## Current next focus
- Continue shrinking large DOM mutation execution blocks in `src/legacy/app.js` where side effects are still directly coupled to UI rendering lifecycle.
- Prioritize extracting stable side-effect orchestration wrappers only when behavior can be guaranteed unchanged.
