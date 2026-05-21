# 皮肤系统实施方案

## 一、背景

将仓库根目录 `theme-preview.html` 中的 5 套主题（C 午夜薰紫、F 深海赛博、H 落日珊瑚、B 极光靛蓝、D 翡翠中性）作为可切换皮肤应用到网站，同时保留每套皮肤内的深色/浅色模式切换。不改变任何现有页面布局。

> 注意：本文档描述的是实施方案，不代表当前代码已完全皮肤化。现有组件中仍存在硬编码颜色、`[data-theme]` 特殊覆盖和局部视觉例外，必须在实施阶段纳入清理与验收。

## 二、现有基础

项目已具备：

| 能力 | 实现方式 |
|------|---------|
| CSS 变量体系 | `src/styles/tokens.css`，100+ 个 CSS custom properties |
| 深浅模式切换 | `<html data-theme="dark">` + Pinia store + localStorage |
| Tailwind 桥接 | `tailwind.config.ts` 将 CSS 变量映射为 utility classes |
| 防闪烁 | `index.html` 内联脚本在渲染前读取 localStorage 设置属性 |
| 切换 UI | `ThemeToggle.vue` 组件（浅色/深色按钮） |

## 三、架构设计

### 核心思路：`data-skin` + `data-theme` 双属性

在 `<html>` 上增加 `data-skin` 属性，与现有的 `data-theme` 并存：

```html
<html lang="zh-CN" data-skin="violet-midnight" data-theme="dark">
```

CSS 级联关系：

```
:root                                    → 基础浅色 token（兜底）
[data-theme="dark"]                      → 基础深色 token（兜底）
[data-skin="violet-midnight"]            → 皮肤午夜薰紫浅色品牌色覆盖
[data-skin="violet-midnight"][data-theme="dark"] → 皮肤午夜薰紫深色品牌色覆盖
```

**关键原则：皮肤覆盖全套视觉 token——包括表面色、文字色、边框色、品牌色。** 每套皮肤就是一套完整的视觉人格，不只是换个按钮颜色。

需要明确的是：引用 token 的组件可以自动跟随皮肤切换；仍使用硬编码颜色、固定渐变、`[data-theme]` 局部覆盖或 CodeMirror 独立主题的组件，需要同步迁移到 token 或增加皮肤兼容处理。不能把“新增 `skins.css`”等同于“全站自动完成皮肤化”。

### 信息流

```
用户点击皮肤色块
  → SkinPicker.vue 调用 appStore.setSkin('violet-midnight')
    → useThemeRuntime watcher 触发
      → 写 localStorage('sqldev:app:skin', 'violet-midnight')
      → document.documentElement.setAttribute('data-skin', 'violet-midnight')
        → CSS 变量自动切换，所有 UI 立即变色
```

### 皮肤 ID 与默认模式

皮肤 ID 使用语义命名，避免只用 `c/f/h/b/d` 这类预览稿编号进入长期代码：

| 预览编号 | 皮肤 | 长期 ID | 推荐默认模式 |
|----------|------|---------|--------------|
| C | 午夜薰紫 | `violet-midnight` | 深色 |
| F | 深海赛博 | `cyber-ocean` | 深色 |
| H | 落日珊瑚 | `coral-sunset` | 浅色 |
| B | 极光靛蓝 | `indigo-aurora` | 浅色 |
| D | 翡翠中性 | `teal-neutral` | 浅色 |

默认模式只在“用户首次选择某个皮肤，且未显式设置过深浅模式”时生效；一旦用户主动切换过浅色/深色，后续换皮肤不再自动覆盖 `themeMode`。这样既保留每套皮肤的推荐观感，也避免用户偏好被意外重置。

## 四、需要修改/新建的文件

### 4.1 新建 `src/styles/skins.css`

5 套皮肤 × 2 种模式 = 10 个 CSS 选择器块。每个皮肤覆盖**全套视觉 token**：

**A. 表面色系（每套皮肤的"底色人格"）**

| 变量 | 用途 | 示例：C 薰紫浅色 | 示例：C 薰紫深色 |
|------|------|-----------------|-----------------|
| `--color-bg` | 页面底色 | `#f8f5ff` 淡紫 | `#110e18` 深紫黑 |
| `--color-panel` | 面板/卡片底色 | `#ffffff` | `#1a1725` |
| `--color-panel-2` | 二级面板 | `#f3eefa` | `#15121e` |
| `--color-panel-3` | 三级面板 | `#f8f5ff` | `#1e1b2a` |
| `--color-text` | 主文字 | `#1a1525` | `#f2eeff` |
| `--color-text-subtle` | 辅助文字 | `#5c4d7a` | `#a99bc5` |
| `--color-text-muted` | 弱文字 | `#9585b2` | `#5c4d73` |
| `--color-border` | 边框 | `#d8cce8` | `rgba(167,139,250,0.16)` |
| `--color-border-hover` | 边框悬停 | `#c4b5d8` | `rgba(167,139,250,0.3)` |
| `--glass-bg` | 毛玻璃底色 | `rgba(248,245,255,0.72)` | `rgba(26,23,37,0.72)` |

**B. 品牌/强调色系（每套皮肤的"性格色"）**

| 变量 | 用途 |
|------|------|
| `--color-brand-50` ~ `--color-brand-800` | 完整品牌色阶 |
| `--color-accent` / `--color-accent-hover` | 主操作色 |
| `--color-accent-bg` / `--color-accent-border` | 强调色背景/边框 |
| `--gradient-brand-primary` | 品牌渐变（双色系） |
| `--shadow-brand` / `--shadow-brand-hover` | 品牌色投影 |
| `--shadow-focus-ring` | 焦点环颜色 |
| `--color-chat-accent` / `--color-chat-glow` / `--gradient-chat-avatar` | AI 聊天强调色 |
| `--color-btn-primary-text` | 按钮文字色 |

**C. 阴影系（配合表面色调整明暗）**

| 变量 | 用途 |
|------|------|
| `--shadow-xs` ~ `--shadow-xl` | 5 级通用阴影 |
| `--shadow-card` / `--shadow-card-hover` | 卡片阴影 |
| `--color-overlay` | 遮罩层透明度 |

**D. 页面别名系（自动跟随 A+B+C）**

`--color-page-bg`, `--color-page-panel`, `--color-page-text` 等页面别名变量通过 `var()` 引用上层变量，无需逐一覆盖。

**5 套皮肤色值表（取自仓库根目录 `theme-preview.html` 双色渐变体系）：**

| 皮肤 | ID | 浅色主色 | 深色主色 | 浅色辅色 | 深色辅色 | 推荐默认模式 |
|------|----|---------|---------|---------|---------|---------|
| 午夜薰紫 | `violet-midnight` | `#7c3aed` | `#a78bfa` | `#db2777` | `#f472b6` | 深色 |
| 深海赛博 | `cyber-ocean` | `#0891b2` | `#22d3ee` | `#7c3aed` | `#a78bfa` | 深色 |
| 落日珊瑚 | `coral-sunset` | `#e8590c` | `#fb923c` | `#eab308` | `#fbbf24` | 浅色 |
| 极光靛蓝 | `indigo-aurora` | `#5865f2` | `#818cf8` | `#06b6d4` | `#22d3ee` | 浅色 |
| 翡翠中性 | `teal-neutral` | `#0d9488` | `#2dd4bf` | `#3b82f6` | `#60a5fa` | 浅色 |

示例（Skin C 午夜薰紫）：

```css
/* Skin: 午夜薰紫 (Violet -> Pink) - 浅色模式 */
[data-skin="violet-midnight"] {
  /* 表面色 — 淡紫底调 */
  --color-bg: #f8f5ff;
  --color-panel: #ffffff;
  --color-panel-2: #f3eefa;
  --color-panel-3: #f8f5ff;

  /* 文字 — 紫灰调 */
  --color-text: #1a1525;
  --color-text-subtle: #5c4d7a;
  --color-text-muted: #9585b2;

  /* 边框 — 淡紫 */
  --color-border: #d8cce8;
  --color-border-hover: #c4b5d8;

  /* 毛玻璃 */
  --glass-bg: rgba(248, 245, 255, 0.72);

  /* 品牌色阶 */
  --color-brand-50:  #faf5ff;
  --color-brand-100: #f3e8ff;
  --color-brand-200: #e9d5ff;
  --color-brand-300: #d8b4fe;
  --color-brand-400: #c084fc;
  --color-brand-500: #a855f7;
  --color-brand-600: #7c3aed;
  --color-brand-700: #6d28d9;
  --color-brand-800: #5b21b6;

  /* 语义强调 */
  --color-accent: var(--color-brand-600);
  --color-accent-hover: var(--color-brand-700);
  --color-accent-bg: rgba(124, 58, 237, 0.08);
  --color-accent-border: rgba(124, 58, 237, 0.2);
  --gradient-brand-primary: linear-gradient(135deg, #7c3aed, #db2777);
  --shadow-brand: 0 4px 16px rgba(124, 58, 237, 0.2);
  --shadow-brand-hover: 0 6px 24px rgba(124, 58, 237, 0.3);
  --shadow-focus-ring: 0 0 0 3px rgba(124, 58, 237, 0.15);

  /* AI 聊天 */
  --color-chat-accent: #7c3aed;
  --color-chat-glow: rgba(124, 58, 237, 0.5);
  --gradient-chat-avatar: linear-gradient(135deg, #7c3aed, #db2777);
  --color-btn-primary-text: #ffffff;

  /* 滚动条 */
  --scrollbar-thumb: #c4b5d8;
  --scrollbar-thumb-hover: #a99bc5;
}

/* Skin: 午夜薰紫 - 深色模式 */
[data-skin="violet-midnight"][data-theme="dark"] {
  /* 表面色 — 深紫黑底调 */
  --color-bg: #110e18;
  --color-panel: #1a1725;
  --color-panel-2: #15121e;
  --color-panel-3: #1e1b2a;

  /* 文字 — 淡紫白 */
  --color-text: #f2eeff;
  --color-text-subtle: #a99bc5;
  --color-text-muted: #5c4d73;

  /* 边框 — 紫光 */
  --color-border: rgba(167, 139, 250, 0.16);
  --color-border-hover: rgba(167, 139, 250, 0.3);

  /* 毛玻璃 */
  --glass-bg: rgba(26, 23, 37, 0.72);

  /* 品牌色阶（深色模式色阶反转） */
  --color-brand-50:  #1a0a2e;
  --color-brand-100: #2e1065;
  --color-brand-200: #3b0764;
  --color-brand-300: #6d28d9;
  --color-brand-400: #7c3aed;
  --color-brand-500: #a78bfa;
  --color-brand-600: #a78bfa;
  --color-brand-700: #c4b5fd;
  --color-brand-800: #ddd6fe;

  --color-accent: var(--color-brand-500);
  --color-accent-hover: var(--color-brand-700);
  --color-accent-bg: rgba(167, 139, 250, 0.15);
  --color-accent-border: rgba(167, 139, 250, 0.3);
  --gradient-brand-primary: linear-gradient(135deg, #a78bfa, #f472b6);
  --shadow-brand: 0 4px 16px rgba(167, 139, 250, 0.3);
  --shadow-brand-hover: 0 6px 24px rgba(167, 139, 250, 0.4);
  --shadow-focus-ring: 0 0 0 3px rgba(167, 139, 250, 0.25);

  --color-chat-accent: #a78bfa;
  --color-chat-glow: rgba(167, 139, 250, 0.5);
  --gradient-chat-avatar: linear-gradient(135deg, #a78bfa, #f472b6);
  --color-btn-primary-text: #1a1528;

  --scrollbar-thumb: rgba(167, 139, 250, 0.25);
  --scrollbar-thumb-hover: rgba(167, 139, 250, 0.4);
}
```

其余 4 套皮肤同理——每套都完整覆盖表面色+品牌色+边框+毛玻璃+滚动条。

**5 套皮肤的表面色调性对照：**

| 皮肤 | 浅色底色 | 浅色调性 | 深色底色 | 深色调性 |
|------|---------|---------|---------|---------|
| C 薰紫 | `#f8f5ff` | 淡紫白 | `#110e18` | 深紫黑 |
| F 赛博 | `#f4fafb` | 冷青白 | `#0c1418` | 深海蓝 |
| H 珊瑚 | `#fdf8f5` | 暖奶白 | `#1a1410` | 暖焦黑 |
| B 靛蓝 | `#f6f7fd` | 淡靛白 | `#111225` | 靛墨黑 |
| D 翡翠 | `#f8f9fa` | 冷中性 | `#111816` | 墨绿黑 |

### 4.2 修改 `src/styles/main.css`（+1 行）

```css
@import './tokens.css';
@import './skins.css';    /* ← 新增 */
@tailwind base;
```

### 4.3 修改 `src/stores/app.ts`

增加皮肤状态和动作：

```typescript
export type SkinId =
  | 'violet-midnight'
  | 'cyber-ocean'
  | 'coral-sunset'
  | 'indigo-aurora'
  | 'teal-neutral'

export const useAppStore = defineStore('app', () => {
  const themeMode = ref<ThemeMode>('light')
  const resolvedTheme = ref<ResolvedTheme>('light')
  const skinId = ref<SkinId>('teal-neutral') // ← 新增，默认翡翠中性
  const themeTouched = ref(false)            // ← 用户是否手动设置过深浅模式

  function setSkin(id: SkinId): void {        // ← 新增
    skinId.value = id
  }

  function setTheme(mode: ThemeMode, options: { touched?: boolean } = {}): void {
    if (options.touched !== false) themeTouched.value = true
    themeMode.value = mode
  }

  function setThemeTouched(touched: boolean): void {
    themeTouched.value = touched
  }

  // ... 现有 setResolvedTheme 不变

  return {
    themeMode,
    resolvedTheme,
    skinId,
    themeTouched,
    setTheme,
    setResolvedTheme,
    setSkin,
    setThemeTouched
  }
})
```

### 4.4 修改 `src/composables/useThemeRuntime.ts`

扩展单例，增加皮肤持久化和 DOM 应用：

```typescript
const SKIN_KEY = 'sqldev:app:skin'
const THEME_TOUCHED_KEY = 'sqldev:app:theme-touched'
const VALID_SKINS: SkinId[] = [
  'violet-midnight',
  'cyber-ocean',
  'coral-sunset',
  'indigo-aurora',
  'teal-neutral'
]

const SKIN_DEFAULT_THEME: Record<SkinId, ThemeMode> = {
  'violet-midnight': 'dark',
  'cyber-ocean': 'dark',
  'coral-sunset': 'light',
  'indigo-aurora': 'light',
  'teal-neutral': 'light'
}

function readStoredSkin(): SkinId {
  const stored = getJson<string | null>(SKIN_KEY, null)
  return VALID_SKINS.includes(stored as SkinId) ? (stored as SkinId) : 'teal-neutral'
}

function writeStoredSkin(skin: SkinId): void {
  setJson(SKIN_KEY, skin)
}

function applySkinToDocument(skin: SkinId): void {
  document.documentElement.setAttribute('data-skin', skin)
}

// 在 useThemeRuntime() 中调整初始化顺序：
appStore.setThemeTouched(getJson<boolean>(THEME_TOUCHED_KEY, false))
appStore.setSkin(readStoredSkin())                 // 读取
appStore.setTheme(readStoredTheme(), { touched: false }) // 读取已有主题，不标记为手动选择
applySkinToDocument(appStore.skinId)                // 初始化应用

watch(() => appStore.skinId, (skin) => {  // 监听变化
  writeStoredSkin(skin)
  applySkinToDocument(skin)
  if (!appStore.themeTouched) {
    appStore.setTheme(SKIN_DEFAULT_THEME[skin], { touched: false })
  }
}, { immediate: true })

watch(() => appStore.themeTouched, (touched) => {
  setJson(THEME_TOUCHED_KEY, touched)
})
```

### 4.5 修改 `index.html`（防闪烁脚本）

扩展现有内联脚本，在渲染前同时设置 skin 和 theme：

```javascript
(function(){try{
  var t=localStorage.getItem('sqldev:app:theme')||localStorage.getItem('sqldev:theme');
  // ↓ 新增：皮肤防闪烁
  var validSkin={ 'violet-midnight':1, 'cyber-ocean':1, 'coral-sunset':1, 'indigo-aurora':1, 'teal-neutral':1 };
  var defaultTheme={ 'violet-midnight':'dark', 'cyber-ocean':'dark', 'coral-sunset':'light', 'indigo-aurora':'light', 'teal-neutral':'light' };
  var skin=localStorage.getItem('sqldev:app:skin');
  if(skin){try{skin=JSON.parse(skin)}catch(e){}}
  if(!validSkin[skin]) skin='teal-neutral';
  document.documentElement.setAttribute('data-skin', skin)
  var touched=localStorage.getItem('sqldev:app:theme-touched');
  if(touched){try{touched=JSON.parse(touched)}catch(e){}}
  var resolved=t || (!touched ? defaultTheme[skin] : null);
  if(resolved==='dark'||(!resolved&&window.matchMedia('(prefers-color-scheme:dark)').matches)){
    document.documentElement.setAttribute('data-theme','dark')
  }
}catch(e){}})()
```

### 4.6 新建 `src/components/common/SkinPicker.vue`

皮肤选择器组件，水平排列 5 个渐变色块：

```
┌───────────────────────────────┐
│  🟣  🔵  🟠  🔷  🟢           │
│  薰紫 赛博 珊瑚 靛蓝 翡翠      │
└───────────────────────────────┘
```

每个色块：
- 24×24px 圆形，显示该皮肤的渐变色（`linear-gradient` 主色→辅色）
- 选中态：外圈高亮环 + 微放大
- 悬停：放大 + 投影
- 点击调用 `appStore.setSkin(id)`
- 必须提供 `aria-label`、可见 `focus-visible`、键盘 Enter/Space 触发和当前选中态语义
- 移动端热区不小于 44×44px；色块视觉尺寸可为 24px，但按钮实际点击区域必须放大

两种变体：
- `compact`：仅色块（用于 Header 下拉菜单）
- `labeled`：色块 + 中文名（用于设置页）

### 4.7 修改 `src/components/layout/AppHeader.vue`

在用户下拉菜单中增加皮肤选择区域：

```html
<!-- 修改前 -->
<div class="dropdown-section-title">主题</div>
<ThemeToggle variant="icon" />

<!-- 修改后 -->
<div class="dropdown-section-title">皮肤</div>
<SkinPicker variant="compact" />
<div class="dropdown-section-title">模式</div>
<ThemeToggle variant="icon" />
```

Header 外露区域是否放置 compact 版 SkinPicker 需要结合移动端空间评估：桌面可放在 `ThemeToggle` 旁边，手机和平板窄屏优先收进下拉菜单，避免 header 操作区拥挤。

### 4.8 迁移硬编码颜色与主题特例

新增皮肤变量后，必须同步清理会绕过 token 的现有实现。至少检查并处理以下类别：

| 类别 | 示例 | 处理要求 |
|------|------|----------|
| CodeMirror 独立主题 | `src/features/sql/editor-themes.ts` | 使用 `--color-accent`、`--color-accent-bg`、`--color-panel-*` 等变量，减少硬编码 fallback |
| 首页 / Splash 特殊样式 | `src/pages/splash/splash.css` | 保留数据库品牌色等业务色，其他界面色优先 token 化 |
| AI 悬浮聊天 | `src/components/business/ai/FloatingChat.vue` | 聊天强调色跟随 `--color-chat-*`，避免只绑定旧紫色方案 |
| 分享海报 / Canvas / QR | `SharePosterModal.vue` 等 | Canvas 或二维码需要显式读取当前 token，不能只判断 `themeMode` |
| `[data-theme]` 局部覆盖 | 各组件 scoped style | 判断是否仍需要；需要时改成 token 表达，避免覆盖皮肤变量 |

数据库 logo、状态色、警告/错误/成功等语义色不要求跟随皮肤主色，但必须保持对比度和可访问性。

## 五、原则上不需要改动的部分

| 文件/模块 | 原因 |
|-----------|------|
| 布局文件（DefaultLayout / AuthLayout / WorkbenchLayout） | 皮肤只改色值，不改结构 |
| `tailwind.config.ts` | 已通过 CSS 变量桥接，自动生效 |
| 大多数现有组件模板 | 引用 CSS 变量的部分可以自动生效；硬编码颜色和局部主题覆盖仍需清理 |
| 路由、鉴权、API、数据库 | 皮肤系统只影响浏览器侧视觉状态，不改变业务协议 |
| ThemeToggle 组件 | 深浅模式切换 UI 可复用，但 store 类型和运行时逻辑需要支持 `themeTouched` |

## 六、影响范围示意

皮肤切换后，以下 UI 元素的颜色会自动变化：

- Header 品牌 logo 方块背景
- 导航激活态背景/文字色
- 所有 `.btn-primary` 按钮
- 所有 `.btn-secondary` 边框和文字
- `.badge-accent` 徽章
- 输入框 focus 态边框和光环
- AI 聊天头像渐变和光晕
- `.hero-panel` 渐变光晕
- 所有使用 `text-accent` / `bg-accentBg` / `border-accent` 的 Tailwind class

## 七、验证清单

1. `pnpm dev` 启动开发服务器
2. 逐一切换 5 套皮肤 × 2 种模式 = 10 种组合，确认品牌色正确
3. 刷新页面后皮肤和模式是否保持（localStorage 持久化）
4. 页面加载是否有闪烁（FOUC 防护）
5. Android 手机 / 平板、iPhone / iPad、鸿蒙手机 / 平板上验证 SkinPicker 可点击、可聚焦、不会撑破 Header 或下拉菜单
6. 手机竖屏、手机横屏、平板竖屏、平板横屏、平板分屏 / 中等宽度场景验证皮肤选择器布局
7. 每套皮肤检查文本对比度、focus ring、disabled、loading、empty、error 状态
8. 覆盖重点页面：Splash / 首页、工作台、SQL 编辑器、AI 聊天、设置页、弹窗 / 抽屉 / 下拉
9. `pnpm check:css-colors` 确认无新增硬编码颜色违规；如迁移历史硬编码，需要同步更新 baseline 或继续收敛
10. `pnpm typecheck`
11. `pnpm lint`
12. `pnpm test:unit`
13. `pnpm build`

## 八、实施顺序

1. 定义 `SkinId`、皮肤元数据和运行时持久化，完成 `data-skin` 防闪烁。
2. 新增 `skins.css`，先覆盖全局视觉 token，并接入 `main.css`。
3. 新增 `SkinPicker.vue`，接入 Header 下拉菜单；桌面外露入口视空间再决定。
4. 清理硬编码颜色和 `[data-theme]` 局部覆盖，优先处理 SQL 编辑器、Splash、AI 聊天、分享海报。
5. 执行 5 套皮肤 × 2 种模式 × 关键页面的视觉验收。
6. 若该方案成为长期基线，同步更新 `docs/AI_DEV.md`；若只是阶段性落地记录，同步更新 `docs/CONTEXT_FULL.md`。
