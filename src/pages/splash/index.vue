<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAppStore, type ThemeMode } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import FeedbackWidget from '@/components/business/feedback/FeedbackWidget.vue'

const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()
const { isAuthenticated, user } = storeToRefs(authStore)

const themeLabel = computed(() => {
  if (appStore.themeMode === 'light') return '浅色'
  if (appStore.themeMode === 'dark') return '深色'
  return '系统'
})

function setTheme(mode: ThemeMode): void {
  appStore.setTheme(mode)
}

async function enterWorkbench(): Promise<void> {
  await router.push('/workbench/ddl')
}

async function openLogin(): Promise<void> {
  await router.push('/login')
}

async function handleSignOut(): Promise<void> {
  await authStore.signOut()
}
</script>

<template>
  <main class="splash-page">
    <div class="splash-ambient" aria-hidden="true">
      <span class="orb orb-a"></span>
      <span class="orb orb-b"></span>
      <span class="orb orb-c"></span>
      <span class="grid-layer"></span>
    </div>

    <nav class="splash-nav" aria-label="首页导航">
      <button class="brand" type="button" @click="enterWorkbench">
        <span class="brand-mark">SQL</span>
        <span class="brand-text">SQL 翻译工作台</span>
      </button>

      <div class="nav-actions">
        <div class="theme-switch" :aria-label="`当前主题：${themeLabel}`">
          <button
            type="button"
            :class="{ active: appStore.themeMode === 'light' }"
            @click="setTheme('light')"
          >
            浅色
          </button>
          <button
            type="button"
            :class="{ active: appStore.themeMode === 'dark' }"
            @click="setTheme('dark')"
          >
            深色
          </button>
          <button
            type="button"
            :class="{ active: appStore.themeMode === 'system' }"
            @click="setTheme('system')"
          >
            系统
          </button>
        </div>

        <button v-if="!isAuthenticated" class="login-link" type="button" @click="openLogin">
          注册 / 登录
        </button>
        <div v-else class="user-chip">
          <span>{{ user?.email }}</span>
          <button type="button" @click="handleSignOut">退出</button>
        </div>
      </div>
    </nav>

    <section class="hero-section" aria-labelledby="splash-title">
      <div class="hero-copy">
        <p class="eyebrow">Oracle / MySQL / PostgreSQL</p>
        <h1 id="splash-title">跨数据库<br /><span>SQL 翻译</span></h1>
        <p class="hero-subtitle">
          DDL 建表语句、函数与存储过程在线互转。打开即用，专注迁移，减少重复手工改写。
        </p>
        <div class="hero-actions">
          <button class="primary-cta" type="button" @click="enterWorkbench">
            立即体验
            <span aria-hidden="true">→</span>
          </button>
          <button class="secondary-cta" type="button" @click="openLogin">注册 / 登录</button>
        </div>
      </div>

      <div class="db-visual" aria-label="数据库关系可视化">
        <svg viewBox="0 0 420 320" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="splashLineGrad" x1="70" x2="350" y1="60" y2="270">
              <stop offset="0%" stop-color="#8fb6ff" />
              <stop offset="48%" stop-color="#8b8cff" />
              <stop offset="100%" stop-color="#26d7e8" />
            </linearGradient>
          </defs>
          <path d="M210 58L72 262L348 262Z" class="db-line" />
          <circle class="particle particle-a" r="4" />
          <circle class="particle particle-b" r="4" />
          <circle class="particle particle-c" r="4" />
        </svg>
        <div class="db-node oracle">
          <strong>ORA</strong>
          <span>Oracle</span>
        </div>
        <div class="db-node mysql">
          <strong>MY</strong>
          <span>MySQL</span>
        </div>
        <div class="db-node pg">
          <strong>PG</strong>
          <span>PostgreSQL</span>
        </div>
      </div>
    </section>

    <section class="preview-section" aria-label="SQL 翻译实时预览">
      <div class="preview-title">
        <span></span>
        <p>实时翻译预览</p>
        <span></span>
      </div>
      <div class="preview-grid">
        <article class="code-panel">
          <header>
            <span class="dot oracle"></span>
            <strong>Oracle 输入</strong>
            <em>24 行</em>
          </header>
          <pre><code><span class="comment">-- 用户信息表</span>
<span class="kw">CREATE TABLE</span> USERS (
  USER_ID    <span class="type">NUMBER</span>(18)   <span class="kw">NOT NULL</span>,
  USERNAME   <span class="type">VARCHAR2</span>(100) <span class="kw">NOT NULL</span>,
  EMAIL      <span class="type">VARCHAR2</span>(200),
  BALANCE    <span class="type">NUMBER</span>(18,2)  <span class="kw">DEFAULT</span> 0,
  CREATED_AT <span class="type">DATE</span>          <span class="kw">DEFAULT</span> SYSDATE,
  <span class="kw">CONSTRAINT</span> PK_USERS <span class="kw">PRIMARY KEY</span> (USER_ID)
);</code></pre>
        </article>

        <div class="preview-arrow" aria-hidden="true">→</div>

        <article class="code-panel">
          <header>
            <span class="dot pg"></span>
            <strong>PostgreSQL 输出</strong>
            <em>24 行</em>
          </header>
          <pre><code><span class="comment">-- 用户信息表</span>
<span class="kw">CREATE TABLE</span> users (
  user_id    <span class="type">BIGINT</span>       <span class="kw">NOT NULL</span>,
  username   <span class="type">VARCHAR</span>(100) <span class="kw">NOT NULL</span>,
  email      <span class="type">VARCHAR</span>(200),
  balance    <span class="type">NUMERIC</span>(18,2) <span class="kw">DEFAULT</span> 0,
  created_at <span class="type">TIMESTAMP</span>     <span class="kw">DEFAULT</span> CLOCK_TIMESTAMP(),
  <span class="kw">CONSTRAINT</span> pk_users <span class="kw">PRIMARY KEY</span> (user_id)
);</code></pre>
        </article>
      </div>
    </section>

    <section class="feature-grid" aria-label="核心能力">
      <article>
        <strong>6</strong>
        <h2>种翻译方向</h2>
        <p>三库任意两两互转，覆盖主流迁移路线。</p>
      </article>
      <article>
        <strong>400+</strong>
        <h2>映射规则</h2>
        <p>DDL 与程序块规则持续沉淀，可维护、可扩展。</p>
      </article>
      <article>
        <strong>3</strong>
        <h2>类 SQL 对象</h2>
        <p>建表语句、函数、存储过程完整翻译。</p>
      </article>
      <article>
        <strong>160+</strong>
        <h2>语法覆盖</h2>
        <p>函数、类型、异常处理与常见语法自动转换。</p>
      </article>
    </section>

    <section class="final-cta">
      <h2>开始你的 <span>SQL 迁移</span> 之旅</h2>
      <p>无需安装，打开即用。保持快速，也保持安全。</p>
      <button class="primary-cta" type="button" @click="enterWorkbench">进入工作台</button>
    </section>

    <footer class="splash-footer">Version 2026.04.13 / 95a8f3c</footer>
    <FeedbackWidget source="splash" />
  </main>
</template>

<style scoped>
.splash-page {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden;
  color: #eaf1ff;
  background:
    radial-gradient(circle at 10% 5%, rgba(74, 124, 255, 0.28), transparent 34rem),
    radial-gradient(circle at 86% 18%, rgba(35, 211, 238, 0.14), transparent 30rem),
    linear-gradient(180deg, #071126 0%, #0a1530 46%, #101b3a 100%);
  font-family: 'DM Sans', 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif;
}

[data-theme='light'] .splash-page {
  color: #122142;
  background:
    radial-gradient(circle at 8% 8%, rgba(77, 125, 249, 0.16), transparent 32rem),
    radial-gradient(circle at 86% 18%, rgba(34, 211, 238, 0.12), transparent 28rem),
    linear-gradient(180deg, #f6f8ff 0%, #edf3ff 48%, #f8fbff 100%);
}

.splash-ambient,
.grid-layer,
.orb {
  pointer-events: none;
  position: absolute;
  inset: 0;
}

.grid-layer {
  opacity: 0.36;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: linear-gradient(to bottom, black, transparent 82%);
}

.orb {
  width: 32rem;
  height: 32rem;
  border-radius: 999px;
  filter: blur(96px);
  opacity: 0.48;
}

.orb-a {
  left: -12rem;
  top: -10rem;
  background: rgba(79, 125, 249, 0.32);
}

.orb-b {
  right: -10rem;
  top: 4rem;
  background: rgba(139, 92, 246, 0.22);
}

.orb-c {
  bottom: 10rem;
  left: 42%;
  background: rgba(34, 211, 238, 0.16);
}

.splash-nav,
.hero-section,
.preview-section,
.feature-grid,
.final-cta,
.splash-footer {
  position: relative;
  z-index: 1;
  width: min(1180px, calc(100% - 32px));
  margin-inline: auto;
}

.splash-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 0 10px;
}

.brand,
.nav-actions,
.theme-switch,
.user-chip {
  display: inline-flex;
  align-items: center;
}

.brand {
  gap: 10px;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.brand-mark {
  display: grid;
  height: 38px;
  width: 38px;
  place-items: center;
  border: 1px solid rgba(148, 190, 255, 0.4);
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(79, 125, 249, 0.24), rgba(34, 211, 238, 0.14));
  color: #b9d0ff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.brand-text {
  font-weight: 800;
  letter-spacing: 0.02em;
}

.nav-actions {
  gap: 12px;
}

.theme-switch {
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  background: rgba(8, 14, 30, 0.42);
  backdrop-filter: blur(16px);
}

[data-theme='light'] .theme-switch {
  background: rgba(255, 255, 255, 0.7);
}

.theme-switch button,
.login-link,
.user-chip button,
.secondary-cta {
  border: 0;
  color: currentColor;
  background: transparent;
  cursor: pointer;
}

.theme-switch button {
  border-radius: 999px;
  padding: 6px 10px;
  color: rgba(226, 238, 255, 0.68);
  font-size: 12px;
}

[data-theme='light'] .theme-switch button {
  color: rgba(18, 33, 66, 0.62);
}

.theme-switch button.active {
  color: #ffffff;
  background: rgba(79, 125, 249, 0.72);
}

.login-link,
.user-chip {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  padding: 9px 14px;
  background: rgba(8, 14, 30, 0.36);
  color: inherit;
  font-size: 13px;
}

[data-theme='light'] .login-link,
[data-theme='light'] .user-chip {
  background: rgba(255, 255, 255, 0.72);
}

.user-chip {
  gap: 10px;
  max-width: min(420px, 40vw);
}

.user-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-section {
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(320px, 0.98fr);
  align-items: center;
  min-height: 560px;
  gap: 36px;
  padding: 28px 0 14px;
}

.eyebrow {
  margin: 0 0 18px;
  color: #8fb6ff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 0;
  font-size: clamp(4.2rem, 9vw, 8.5rem);
  font-weight: 800;
  letter-spacing: -0.085em;
  line-height: 0.86;
}

.hero-copy h1 span,
.final-cta span {
  background: linear-gradient(135deg, #9bd8ff 0%, #7fa5ff 42%, #c19cff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

[data-theme='light'] .hero-copy h1 span,
[data-theme='light'] .final-cta span {
  background-image: linear-gradient(135deg, #1f68d8 0%, #4f46e5 55%, #0f9aa8 100%);
}

.hero-subtitle {
  max-width: 580px;
  margin: 24px 0 0;
  color: rgba(226, 238, 255, 0.72);
  font-size: clamp(1.08rem, 2vw, 1.45rem);
  line-height: 1.72;
}

[data-theme='light'] .hero-subtitle {
  color: rgba(18, 33, 66, 0.68);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 32px;
}

.primary-cta,
.secondary-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  border-radius: 999px;
  padding: 0 22px;
  font-weight: 800;
}

.primary-cta {
  border: 0;
  color: #061022;
  background: linear-gradient(135deg, #d8efff, #8db7ff 42%, #83f2ff);
  box-shadow: 0 24px 70px rgba(60, 128, 255, 0.36);
}

.primary-cta span {
  margin-left: 10px;
}

.secondary-cta {
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.06);
}

.db-visual {
  position: relative;
  min-height: 360px;
}

.db-visual svg {
  width: 100%;
  height: 100%;
  min-height: 320px;
}

.db-line {
  fill: rgba(34, 211, 238, 0.03);
  stroke: url(#splashLineGrad);
  stroke-width: 1.8;
  stroke-dasharray: 6 12;
}

.particle {
  fill: #82ecff;
  filter: drop-shadow(0 0 10px rgba(130, 236, 255, 0.9));
}

.particle-a {
  offset-path: path('M210 58L72 262');
  animation: flow 4s linear infinite;
}

.particle-b {
  offset-path: path('M72 262L348 262');
  animation: flow 4.4s 0.8s linear infinite;
}

.particle-c {
  offset-path: path('M348 262L210 58');
  animation: flow 3.8s 1.4s linear infinite;
}

@keyframes flow {
  from {
    offset-distance: 0%;
    opacity: 0;
  }
  12%,
  88% {
    opacity: 1;
  }
  to {
    offset-distance: 100%;
    opacity: 0;
  }
}

.db-node {
  position: absolute;
  display: grid;
  place-items: center;
  gap: 8px;
  min-width: 116px;
  transform: translate(-50%, -50%);
}

.db-node strong {
  display: grid;
  width: 72px;
  height: 72px;
  place-items: center;
  border-radius: 24px;
  color: white;
  box-shadow: 0 22px 50px rgba(0, 0, 0, 0.28);
}

.db-node span {
  color: rgba(226, 238, 255, 0.74);
  font-size: 13px;
  font-weight: 800;
}

[data-theme='light'] .db-node span {
  color: rgba(18, 33, 66, 0.68);
}

.db-node.oracle {
  left: 50%;
  top: 17%;
}

.db-node.oracle strong {
  background: linear-gradient(135deg, #d45140, #93281f);
}

.db-node.mysql {
  left: 18%;
  top: 82%;
}

.db-node.mysql strong {
  background: linear-gradient(135deg, #0f8faa, #07546a);
}

.db-node.pg {
  left: 82%;
  top: 82%;
}

.db-node.pg strong {
  background: linear-gradient(135deg, #437eb0, #244765);
}

.preview-section {
  padding: 12px 0 44px;
}

.preview-title {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 18px;
  margin-bottom: 16px;
}

.preview-title span {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(148, 190, 255, 0.38), transparent);
}

.preview-title p {
  margin: 0;
  color: #9db9f8;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.preview-grid {
  display: grid;
  grid-template-columns: 1fr 54px 1fr;
  gap: 16px;
  align-items: stretch;
}

.code-panel {
  overflow: hidden;
  border: 1px solid rgba(135, 164, 224, 0.18);
  border-radius: 24px;
  background: rgba(7, 13, 28, 0.72);
  box-shadow: 0 28px 80px rgba(1, 7, 20, 0.28);
  backdrop-filter: blur(18px);
}

[data-theme='light'] .code-panel {
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 28px 70px rgba(68, 92, 140, 0.14);
}

.code-panel header {
  display: flex;
  align-items: center;
  gap: 9px;
  border-bottom: 1px solid rgba(135, 164, 224, 0.14);
  padding: 14px 16px;
}

.code-panel header em {
  margin-left: auto;
  color: rgba(165, 183, 220, 0.68);
  font-size: 12px;
  font-style: normal;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
}

.dot.oracle {
  background: #e25b4a;
}

.dot.pg {
  background: #4c93c8;
}

pre {
  margin: 0;
  overflow-x: auto;
  padding: 18px;
  color: #dce7ff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.75;
}

[data-theme='light'] pre {
  color: #203152;
}

.comment {
  color: #6fa8ff;
}

.kw {
  color: #8fb6ff;
  font-weight: 800;
}

.type {
  color: #6fe6d1;
}

[data-theme='light'] .type {
  color: #087e79;
}

.preview-arrow {
  display: grid;
  place-items: center;
  color: #9db9f8;
  font-size: 32px;
  font-weight: 800;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  padding-bottom: 52px;
}

.feature-grid article,
.final-cta {
  border: 1px solid rgba(135, 164, 224, 0.18);
  border-radius: 24px;
  background: rgba(10, 18, 38, 0.58);
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(16px);
}

[data-theme='light'] .feature-grid article,
[data-theme='light'] .final-cta {
  background: rgba(255, 255, 255, 0.72);
}

.feature-grid article {
  padding: 20px;
}

.feature-grid strong {
  color: #9bd8ff;
  font-size: 38px;
  line-height: 1;
}

.feature-grid h2 {
  margin: 10px 0 6px;
  font-size: 16px;
}

.feature-grid p,
.final-cta p {
  margin: 0;
  color: rgba(226, 238, 255, 0.66);
  line-height: 1.65;
}

[data-theme='light'] .feature-grid p,
[data-theme='light'] .final-cta p {
  color: rgba(18, 33, 66, 0.62);
}

.final-cta {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 42px 20px;
  text-align: center;
}

.final-cta h2 {
  margin: 0;
  font-size: clamp(1.8rem, 4vw, 3.2rem);
  letter-spacing: -0.04em;
}

.splash-footer {
  padding: 24px 0 36px;
  color: rgba(165, 183, 220, 0.72);
  font-size: 12px;
  text-align: center;
}

@media (max-width: 900px) {
  .splash-nav {
    align-items: flex-start;
    gap: 14px;
  }

  .nav-actions {
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .hero-section,
  .preview-grid,
  .feature-grid {
    grid-template-columns: 1fr;
  }

  .hero-section {
    min-height: auto;
    padding-top: 58px;
  }

  .preview-arrow {
    transform: rotate(90deg);
  }
}

@media (max-width: 560px) {
  .splash-nav {
    flex-direction: column;
  }

  .theme-switch {
    order: 2;
  }

  .hero-copy h1 {
    font-size: clamp(3.5rem, 18vw, 5rem);
  }
}
</style>
