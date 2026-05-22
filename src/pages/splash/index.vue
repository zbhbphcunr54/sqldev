<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import FeedbackWidget from '@/components/business/feedback/FeedbackWidget.vue'
import { useAppStore, type ThemeMode } from '@/stores/app'
import { useAuth } from '@/composables/useAuth'
import { useAuthModal } from '@/composables/useAuthModal'
import { DB_META_MAP } from '@/features/sql/db-meta'
import './splash.css'

const router = useRouter()
const appStore = useAppStore()
const auth = useAuth()
const authModal = useAuthModal()
const { isAuthenticated } = auth

const feedbackSource = 'splash' as const
const bentoRef = ref<HTMLElement | null>(null)

const navAuthButtonLabel = computed(() => (isAuthenticated.value ? '进入工作台' : '注册 / 登录'))

const stats = [
  { value: '17', label: '种数据库' },
  { value: '3', label: '种 SQL 类型' },
  { value: 'AI', label: '智能分析' }
]

const dbBadges = Object.values(DB_META_MAP).map((db) => ({
  label: db.abbr,
  slug: db.slug
}))

const miniOracleHtml = `<span class="cmt">-- Oracle DDL</span>
<span class="kw">CREATE TABLE</span> users (
  id <span class="type">NUMBER</span>(18) <span class="kw">NOT NULL</span>
);`

const miniPgHtml = `<span class="cmt">-- PostgreSQL</span>
<span class="kw">CREATE TABLE</span> users (
  id <span class="type">BIGINT</span> <span class="kw">NOT NULL</span>
);`

function nextTheme(mode: ThemeMode): ThemeMode {
  return mode === 'light' ? 'dark' : 'light'
}

function toggleTheme(): void {
  appStore.setTheme(nextTheme(appStore.themeMode))
}

async function handleAuthIntent(): Promise<void> {
  if (isAuthenticated.value) {
    await router.push('/workbench/home')
    return
  }
  authModal.openModal({ redirectTo: '/workbench/home' })
}

function handleBentoMouseMove(e: MouseEvent): void {
  const el = bentoRef.value
  if (!el) return
  const cards = el.querySelectorAll<HTMLElement>('.sp-bento-card')
  cards.forEach((card) => {
    const rect = card.getBoundingClientRect()
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  })
}
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- Static trusted SQL preview markup -->
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
        <!-- Nav -->
        <nav class="sp-nav" aria-label="首页导航">
          <div class="sp-nav-logo">
            <div class="sp-nav-logo-mark">Dev</div>
            <span class="sp-nav-logo-text">Dev Studio</span>
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

        <!-- Hero -->
        <section class="sp-hero">
          <div class="sp-hero-badge">开发者工具集</div>
          <h1 id="splash-title" class="sp-hero-title sp-hero-title-gradient">Dev Studio</h1>
          <p class="sp-hero-sub">
            SQL 跨库翻译 · 证件号码生成 · AI 智能分析<br />开发者的多功能工作台
          </p>
          <div class="sp-hero-cta sp-hero-cta-center">
            <button class="sp-btn-primary" type="button" @click="handleAuthIntent">
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

          <!-- Stats Strip -->
          <div class="sp-stats-strip" aria-label="核心数据">
            <div
              v-for="(s, i) in stats"
              :key="i"
              class="sp-stat-item"
            >
              <span class="sp-stat-value">{{ s.value }}</span>
              <span class="sp-stat-label">{{ s.label }}</span>
            </div>
          </div>

        </section>

        <!-- Bento Grid -->
        <section
          ref="bentoRef"
          class="sp-bento-section"
          aria-label="功能一览"
          @mousemove="handleBentoMouseMove"
        >
          <div class="sp-bento-grid">
            <!-- Card 1: SQL 转换 (2col × 2row) -->
            <div class="sp-bento-card sp-bento-sql">
              <div class="sp-bento-pill">核心功能</div>
              <h3 class="sp-bento-title">SQL 跨库翻译</h3>
              <p class="sp-bento-desc">DDL 建表、函数、存储过程一键互转，覆盖 17 种数据库</p>
              <div class="sp-bento-sql-preview">
                <div class="sp-mini-code">
                  <div class="sp-mini-code-head">
                    <span class="sp-mini-dot oracle"></span>
                    <span>Oracle</span>
                  </div>
                  <pre v-html="miniOracleHtml"></pre>
                </div>
                <div class="sp-mini-arrow" aria-hidden="true">
                  <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                    <path
                      d="M4 10h12m-5-5 5 5-5 5"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
                <div class="sp-mini-code">
                  <div class="sp-mini-code-head">
                    <span class="sp-mini-dot pg"></span>
                    <span>PostgreSQL</span>
                  </div>
                  <pre v-html="miniPgHtml"></pre>
                </div>
              </div>
              <div class="sp-db-pills">
                <span
                  v-for="db in dbBadges"
                  :key="db.slug"
                  class="sp-db-pill"
                  :style="{ '--pill-color': `var(--db-${db.slug})` }"
                >{{ db.label }}</span>
              </div>
            </div>

            <!-- Card 2: 证件号码 (1col × 2row) -->
            <div class="sp-bento-card sp-bento-id">
              <div class="sp-bento-pill">实用工具</div>
              <h3 class="sp-bento-title">证件号码生成</h3>
              <p class="sp-bento-desc">身份证 · 统一社会信用代码</p>
              <div class="sp-id-anatomy">
                <div class="sp-id-seg sp-id-region">
                  <span class="sp-id-val">110105</span>
                  <span class="sp-id-lbl">地区</span>
                </div>
                <div class="sp-id-seg sp-id-birth">
                  <span class="sp-id-val">19900307</span>
                  <span class="sp-id-lbl">出生</span>
                </div>
                <div class="sp-id-seg sp-id-seq">
                  <span class="sp-id-val">234</span>
                  <span class="sp-id-lbl">顺序</span>
                </div>
                <div class="sp-id-seg sp-id-check">
                  <span class="sp-id-val">5</span>
                  <span class="sp-id-lbl">校验</span>
                </div>
              </div>
              <div class="sp-id-uscc">
                <span class="sp-id-uscc-tag">USCC</span>
                <span class="sp-id-uscc-val">91110000MA01XXXX4X</span>
              </div>
            </div>

            <!-- Card 3: AI 对话 (1×1) -->
            <div class="sp-bento-card sp-bento-ai">
              <div class="sp-bento-pill">智能助手</div>
              <h3 class="sp-bento-title">AI 对话</h3>
              <p class="sp-bento-desc">多模型配置与智能分析</p>
              <div class="sp-chat-bubbles">
                <div class="sp-chat-user">
                  <span>分析这段 SQL 的性能瓶颈</span>
                </div>
                <div class="sp-chat-ai">
                  <span>建议添加复合索引并优化 JOIN 顺序...</span>
                </div>
              </div>
            </div>

            <!-- Card 5: 更多工具 (1×1) -->
            <div class="sp-bento-card sp-bento-more">
              <h3 class="sp-bento-title">更多工具</h3>
              <p class="sp-bento-desc">管理与审计</p>
              <div class="sp-more-links">
                <div class="sp-more-link">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <span>AI 配置管理</span>
                </div>
                <div class="sp-more-link">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <span>操作日志</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Final CTA -->
        <section class="sp-final-cta">
          <h2>开始你的<span class="sp-title-accent"> 效率提升</span>之旅</h2>
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
      </div>
    </div>

    <FeedbackWidget :source="feedbackSource" />
  </section>
</template>
