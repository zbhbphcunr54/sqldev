<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import FeedbackWidget from '@/components/business/feedback/FeedbackWidget.vue'
import { useAppStore, type ThemeMode } from '@/stores/app'
import { useAuth } from '@/composables/useAuth'
import { useAuthModal } from '@/composables/useAuthModal'
import './splash.css'

interface FeatureCard {
  title: string
  desc: string
  stat: string
  statSuffix?: string
  icon: 'scan' | 'rules' | 'ddl' | 'bolt'
}

const router = useRouter()
const appStore = useAppStore()
const auth = useAuth()
const authModal = useAuthModal()
const { isAuthenticated } = auth

const feedbackSource = 'splash' as const

const navAuthButtonLabel = computed(() => (isAuthenticated.value ? '进入工作台' : '注册 / 登录'))

const features: FeatureCard[] = [
  {
    title: '6 种翻译方向',
    desc: 'Oracle、MySQL、PostgreSQL 三库任意两两互转，覆盖主流迁移场景',
    stat: '6',
    icon: 'scan'
  },
  {
    title: '400+ 映射规则',
    desc: 'DDL 类型映射 199 条，程序块语法转换 212 条，持续扩展中',
    stat: '400',
    statSuffix: '+',
    icon: 'rules'
  },
  {
    title: 'DDL · 函数 · 存储过程',
    desc: '建表语句、函数定义、存储过程完整翻译，包含异常处理与分区',
    stat: '3',
    statSuffix: ' 类型',
    icon: 'ddl'
  },
  {
    title: '160+ 种语法覆盖',
    desc: '函数、语句、数据类型全覆盖，语法高亮编辑器即时预览翻译结果',
    stat: '160',
    statSuffix: '+',
    icon: 'bolt'
  }
]

const oraclePreviewHtml = `<span class="cmt">-- 用户信息表</span>
<span class="kw">CREATE TABLE</span> USERS (
    USER_ID       <span class="type">NUMBER</span>(18)       <span class="kw">NOT NULL</span>,
    USERNAME      <span class="type">VARCHAR2</span>(100)    <span class="kw">NOT NULL</span>,
    EMAIL         <span class="type">VARCHAR2</span>(200),
    BALANCE       <span class="type">NUMBER</span>(18,2)     <span class="kw">DEFAULT</span> <span class="num">0</span>,
    STATUS        <span class="type">NUMBER</span>(1)        <span class="kw">DEFAULT</span> <span class="num">1</span>,
    AVATAR        <span class="type">BLOB</span>,
    BIO           <span class="type">CLOB</span>,
    CREATED_AT    <span class="type">DATE</span>            <span class="kw">DEFAULT</span> <span class="fn">SYSDATE</span>,
    <span class="kw">CONSTRAINT</span> PK_USERS <span class="kw">PRIMARY KEY</span> (USER_ID)
);

<span class="kw">COMMENT ON TABLE</span> USERS <span class="kw">IS</span> <span class="str">'用户信息表'</span>;
<span class="kw">COMMENT ON COLUMN</span> USERS.EMAIL <span class="kw">IS</span> <span class="str">'邮箱'</span>;`

const postgresPreviewHtml = `<span class="cmt">-- 用户信息表</span>
<span class="kw">CREATE TABLE</span> users (
    user_id       <span class="type">BIGINT</span>           <span class="kw">NOT NULL</span>,
    username      <span class="type">VARCHAR</span>(100)      <span class="kw">NOT NULL</span>,
    email         <span class="type">VARCHAR</span>(200),
    balance       <span class="type">NUMERIC</span>(18,2)     <span class="kw">DEFAULT</span> <span class="num">0</span>,
    status        <span class="type">SMALLINT</span>          <span class="kw">DEFAULT</span> <span class="num">1</span>,
    avatar        <span class="type">BYTEA</span>,
    bio           <span class="type">TEXT</span>,
    created_at    <span class="type">TIMESTAMP</span>         <span class="kw">DEFAULT</span> <span class="fn">CLOCK_TIMESTAMP</span>(),
    <span class="kw">CONSTRAINT</span> pk_users <span class="kw">PRIMARY KEY</span> (user_id)
);

<span class="kw">COMMENT ON TABLE</span> users <span class="kw">IS</span> <span class="str">'用户信息表'</span>;
<span class="kw">COMMENT ON COLUMN</span> users.email <span class="kw">IS</span> <span class="str">'邮箱'</span>;`

function nextTheme(mode: ThemeMode): ThemeMode {
  if (mode === 'light') return 'dark'
  if (mode === 'dark') return 'system'
  return 'light'
}

function toggleTheme(): void {
  appStore.setTheme(nextTheme(appStore.themeMode))
}

async function enterWorkbench(): Promise<void> {
  await router.push('/workbench/ddl')
}

async function handleAuthIntent(): Promise<void> {
  if (isAuthenticated.value) {
    await router.push('/workbench/ddl')
    return
  }
  authModal.openModal({ redirectTo: '/workbench/ddl' })
}
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- Static trusted SQL preview markup keeps legacy syntax highlighting without runtime user input. -->
  <section id="splash-poster" aria-labelledby="splash-title">
    <div class="sp-ambient" aria-hidden="true">
      <div class="sp-orb sp-orb-1"></div>
      <div class="sp-orb sp-orb-2"></div>
      <div class="sp-orb sp-orb-3"></div>
    </div>
    <canvas class="sp-canvas" aria-hidden="true"></canvas>
    <div class="sp-grid" aria-hidden="true"></div>
    <div class="sp-tokens" aria-hidden="true"></div>
    <div class="sp-vignette" aria-hidden="true"></div>

    <div class="sp-shell">
      <div class="sp-page">
        <nav class="sp-nav" aria-label="首页导航">
          <div class="sp-nav-logo">
            <div class="sp-nav-logo-mark">SQL</div>
            <span class="sp-nav-logo-text">SQL 翻译工作台</span>
          </div>
          <div class="sp-nav-actions">
            <button
              class="sp-nav-theme theme-toggle"
              type="button"
              aria-label="切换主题"
              title="切换主题"
              @click="toggleTheme"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M10 2.5V4.2M10 15.8V17.5M17.5 10H15.8M4.2 10H2.5M15.3 4.7L14.1 5.9M5.9 14.1L4.7 15.3M15.3 15.3L14.1 14.1M5.9 5.9L4.7 4.7"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                />
                <circle cx="10" cy="10" r="3.2" stroke="currentColor" stroke-width="1.4" />
              </svg>
            </button>
            <button class="sp-nav-login" type="button" @click="handleAuthIntent">
              {{ navAuthButtonLabel }}
            </button>
          </div>
        </nav>

        <section class="sp-hero">
          <h1 id="splash-title" class="sp-hero-title">
            跨数据库<br /><span class="sp-title-accent">SQL 翻译</span>
          </h1>
          <p class="sp-hero-sub">
            Oracle、MySQL、PostgreSQL<br />DDL语句、函数与存储过程 — 一键互转
          </p>

          <div class="sp-db-viz">
            <svg viewBox="0 0 380 300" aria-hidden="true">
              <defs>
                <linearGradient
                  id="sp-line-grad"
                  gradientUnits="userSpaceOnUse"
                  x1="70"
                  y1="55"
                  x2="310"
                  y2="250"
                >
                  <stop offset="0%" stop-color="rgba(79,125,249,.3)" />
                  <stop offset="50%" stop-color="rgba(139,92,246,.4)" />
                  <stop offset="100%" stop-color="rgba(34,211,238,.3)" />
                </linearGradient>
              </defs>
              <path class="sp-db-line" d="M190 55 L70 250"></path>
              <path class="sp-db-line sp-db-line-2" d="M190 55 L310 250"></path>
              <path class="sp-db-line sp-db-line-3" d="M70 250 L310 250"></path>
              <circle r="3" fill="#22d3ee" opacity="0">
                <animateMotion dur="3.5s" repeatCount="indefinite" path="M190 55 L310 250" />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.1;0.9;1"
                  dur="3.5s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle r="3" fill="#4f7df9" opacity="0">
                <animateMotion
                  dur="4s"
                  repeatCount="indefinite"
                  begin="1.2s"
                  path="M310 250 L70 250"
                />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.1;0.9;1"
                  dur="4s"
                  repeatCount="indefinite"
                  begin="1.2s"
                />
              </circle>
              <circle r="3" fill="#8b5cf6" opacity="0">
                <animateMotion
                  dur="3.5s"
                  repeatCount="indefinite"
                  begin="2.4s"
                  path="M70 250 L190 55"
                />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.1;0.9;1"
                  dur="3.5s"
                  repeatCount="indefinite"
                  begin="2.4s"
                />
              </circle>
            </svg>
            <div class="sp-db-node sp-db-node-oracle">
              <div class="sp-db-node-icon oracle">ORA</div>
              <span class="sp-db-node-label">Oracle</span>
            </div>
            <div class="sp-db-node sp-db-node-mysql">
              <div class="sp-db-node-icon mysql">MY</div>
              <span class="sp-db-node-label">MySQL</span>
            </div>
            <div class="sp-db-node sp-db-node-pg">
              <div class="sp-db-node-icon pg">PG</div>
              <span class="sp-db-node-label">PostgreSQL</span>
            </div>
          </div>

          <div class="sp-hero-cta sp-hero-cta-center">
            <button id="sp-enter-btn" class="sp-btn-primary" type="button" @click="enterWorkbench">
              立即体验
              <svg width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M3 8h10m-4-4 4 4-4 4"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </section>

        <section class="sp-preview-section">
          <div class="sp-preview-label"><span>实时翻译预览</span></div>
          <div class="sp-preview-wrap">
            <div class="sp-preview-panel">
              <div class="sp-preview-header">
                <div class="sp-preview-header-left">
                  <span class="sp-preview-dot oracle"></span>
                  <span class="sp-preview-db-name">Oracle 输入</span>
                </div>
                <span class="sp-preview-lines">24 行</span>
              </div>
              <div class="sp-preview-code" v-html="oraclePreviewHtml"></div>
            </div>

            <div class="sp-preview-divider" aria-hidden="true">
              <div class="sp-preview-arrow">
                <svg fill="none" viewBox="0 0 24 24">
                  <path
                    d="M5 12h14m-6-6 6 6-6 6"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div class="sp-preview-panel">
              <div class="sp-preview-header">
                <div class="sp-preview-header-left">
                  <span class="sp-preview-dot pg"></span>
                  <span class="sp-preview-db-name">PostgreSQL 输出</span>
                </div>
                <span class="sp-preview-lines">24 行</span>
              </div>
              <div class="sp-preview-code" v-html="postgresPreviewHtml"></div>
            </div>
          </div>
        </section>

        <section class="sp-features-section">
          <div class="sp-features-grid">
            <div v-for="feature in features" :key="feature.title" class="sp-feat-card">
              <div class="sp-feat-icon">
                <svg v-if="feature.icon === 'scan'" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
                <svg v-else-if="feature.icon === 'rules'" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
                <svg v-else-if="feature.icon === 'ddl'" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M4 6h16M4 12h16M4 18h7"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
                <svg v-else fill="none" viewBox="0 0 24 24">
                  <path
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <div class="sp-feat-title">{{ feature.title }}</div>
              <div class="sp-feat-desc">{{ feature.desc }}</div>
              <div class="sp-feat-stat">
                {{ feature.stat }}<small v-if="feature.statSuffix">{{ feature.statSuffix }}</small>
              </div>
            </div>
          </div>
        </section>

        <section class="sp-final-cta">
          <h2>开始你的<span class="sp-title-accent"> SQL 迁移</span>之旅</h2>
          <p>无需安装，打开即用。免费开源。</p>
          <div class="sp-hero-cta sp-hero-cta-center">
            <button class="sp-btn-primary sp-final-auth" type="button" @click="handleAuthIntent">
              {{ navAuthButtonLabel }}
              <svg width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M3 8h10m-4-4 4 4-4 4"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </section>

        <footer class="sp-site-footer" aria-label="站点信息">
          <span class="sp-site-footer-meta">Version 2026.04.13 / 95a8f3c</span>
        </footer>
      </div>
    </div>

    <FeedbackWidget :source="feedbackSource" />
  </section>
</template>
