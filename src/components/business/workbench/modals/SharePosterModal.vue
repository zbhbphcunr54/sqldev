<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { buildZiweiShareLink } from '@/features/ziwei/share'
import { useAppStore } from '@/stores/app'
import type { ZiweiAnalysisResult } from '@/api/ziwei-analysis'

type PosterFact = {
  label: string
  value: string
}

const props = withDefaults(defineProps<{
  visible: boolean
  profileName?: string
  chartMeta?: string
  correctionText?: string
  highlights?: PosterFact[]
  huaFacts?: PosterFact[]
  chartReady?: boolean
  aiAnalysisReady?: boolean
  aiResult?: ZiweiAnalysisResult | null
}>(), {
  profileName: '',
  chartMeta: '',
  correctionText: '',
  highlights: () => [],
  huaFacts: () => [],
  chartReady: false,
  aiAnalysisReady: false,
  aiResult: null
})

const emit = defineEmits<{
  close: []
}>()

type PersonaEntry = {
  persona: string
  hook: string
}

const STAR_PERSONA_MAP: Record<string, PersonaEntry> = {
  '紫微': { persona: '帝星坐命', hook: '主贵气，有领导才能' },
  '天机': { persona: '善星坐命', hook: '主机谋聪慧，善筹划' },
  '太阳': { persona: '日星坐命', hook: '主光明磊落，有官禄之象' },
  '武曲': { persona: '财星坐命', hook: '主刚毅果断，利财帛' },
  '天同': { persona: '福星坐命', hook: '主安逸享福，性情温和' },
  '廉贞': { persona: '次桃花坐命', hook: '主情绪起伏，桃花重' },
  '天府': { persona: '库星坐命', hook: '主稳重保守，有财库之象' },
  '太阴': { persona: '月星坐命', hook: '主细腻内敛，田宅有缘' },
  '贪狼': { persona: '桃花坐命', hook: '主欲望强，多才艺' },
  '巨门': { persona: '暗星坐命', hook: '主口才佳，易惹是非' },
  '天相': { persona: '印星坐命', hook: '主贵人运，善协调' },
  '天梁': { persona: '荫星坐命', hook: '主逢凶化吉，有长者风范' },
  '七杀': { persona: '将星坐命', hook: '主刚烈冲劲，人生多变动' },
  '破军': { persona: '耗星坐命', hook: '主破耗开创，不喜守旧' }
}

const FALLBACK_HOOK = '你的命格，百中无一'

const appStore = useAppStore()
const isDark = computed(() => appStore.resolvedTheme === 'dark')
const qrDataUrl = ref('')
const shareLink = computed(() => buildZiweiShareLink(window.location))

const heroStarName = computed(() => {
  const ming = props.highlights.find(h => h.label === '命主')
  return (ming?.value && ming.value !== '--') ? ming.value : props.profileName.trim() || '命盘'
})

const heroPersona = computed(() => STAR_PERSONA_MAP[heroStarName.value]?.persona ?? '')

const heroHook = computed(() => {
  if (props.aiResult?.overview) {
    const text = props.aiResult.overview.replace(/\n+/g, ' ').trim()
    return text.length > 30 ? text.slice(0, 30) + '…' : text
  }
  return STAR_PERSONA_MAP[heroStarName.value]?.hook ?? FALLBACK_HOOK
})

const displayNaYin = computed(() => {
  const item = props.highlights.find(h => h.label === '纳音')
  return (item?.value && item.value !== '--') ? item.value : ''
})

const coreStats = computed(() =>
  props.highlights.filter(h =>
    h.value && h.value !== '--' && (h.label === '命主' || h.label === '身主' || h.label === '五行局')
  )
)

const timeInfo = computed(() =>
  props.highlights.filter(h =>
    h.value && h.value !== '--' && (h.label === '当前大限' || h.label === '流年')
  )
)

const displayHuaFacts = computed(() =>
  props.huaFacts.filter(item => item.value && item.value !== '--').slice(0, 3)
)

const statusText = computed(() => {
  if (props.aiAnalysisReady) return 'AI 解读已就绪'
  if (props.chartReady) return '已完成排盘'
  return '待排盘'
})

const huaLayerIcons = ['生', '限', '年']

async function generateQR(): Promise<void> {
  try {
    const qrColor = isDark.value
      ? { dark: '#c4b5fd', light: '#00000000' }
      : { dark: '#4338ca', light: '#00000000' }
    qrDataUrl.value = await QRCode.toDataURL(shareLink.value, {
      width: 200,
      margin: 0,
      color: qrColor
    })
  } catch (error: unknown) {
    console.warn('[ziwei-share-poster] QR generation failed:', error)
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) void generateQR()
  },
  { immediate: true }
)

function handleEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.visible) emit('close')
}

onMounted(() => window.addEventListener('keydown', handleEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', handleEscape))
</script>

<template>
  <Teleport to="body">
    <Transition name="poster-enter">
      <div v-if="visible" class="poster-mask" @click.self="emit('close')">
        <div class="poster-shell">
          <div class="poster-card">
            <!-- Hero: 品牌渐变大色块 + 命格揭示 -->
            <section class="poster-hero">
              <span class="poster-hero-label">✦ 命格已锁定 ✦</span>
              <h1 class="poster-hero-title">★ {{ heroStarName }} ★</h1>
              <p v-if="heroPersona" class="poster-hero-persona">「 {{ heroPersona }} 」</p>
              <p class="poster-hero-hook">{{ heroHook }}</p>
            </section>

            <!-- 核心信息：命主/身主/五行局+纳音 -->
            <section class="poster-core">
              <div class="poster-core-row">
                <span
                  v-for="item in coreStats"
                  :key="item.label"
                  class="poster-core-item"
                >
                  <span class="poster-core-label">{{ item.label }}：</span>
                  <span class="poster-core-value">{{ item.value }}</span>
                </span>
                <span v-if="displayNaYin" class="poster-core-item">
                  <span class="poster-core-label">纳音：</span>
                  <span class="poster-core-value poster-core-value--nayin">{{ displayNaYin }}</span>
                </span>
              </div>
            </section>

            <!-- 时间线：大限/流年 -->
            <section v-if="timeInfo.length" class="poster-time">
              <span
                v-for="item in timeInfo"
                :key="item.label"
                class="poster-time-item"
              >
                {{ item.label }}：{{ item.value }}
              </span>
            </section>

            <!-- 三层四化面板 -->
            <section v-if="displayHuaFacts.length" class="poster-hua">
              <h3 class="poster-hua-title">三 层 四 化</h3>
              <div class="poster-hua-list">
                <div
                  v-for="(item, idx) in displayHuaFacts"
                  :key="item.label"
                  class="poster-hua-row"
                >
                  <span
                    class="poster-hua-icon"
                    :class="`poster-hua-icon--${idx}`"
                  >{{ huaLayerIcons[idx] || '·' }}</span>
                  <span class="poster-hua-text">{{ item.value }}</span>
                </div>
              </div>
            </section>

            <!-- 状态指示器 -->
            <div class="poster-status">
              <span class="poster-status-dot" :class="{ 'poster-status-dot--ai': aiAnalysisReady, 'poster-status-dot--chart': chartReady && !aiAnalysisReady }"></span>
              <span class="poster-status-text">{{ statusText }}</span>
            </div>

            <!-- QR code + CTA -->
            <footer class="poster-footer">
              <div class="poster-cta">
                <span class="poster-cta-main">扫码排你的命盘</span>
                <span class="poster-cta-sub">紫微斗数 · ziwei.life</span>
              </div>
              <div class="poster-qr-wrap">
                <img v-if="qrDataUrl" :src="qrDataUrl" alt="分享二维码" width="80" height="80" />
                <div v-else class="poster-qr-empty"></div>
              </div>
            </footer>
          </div>

          <button class="poster-close" aria-label="关闭" @click="emit('close')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ================================================
   命格卡 (Destiny Card) — 命运揭示风格
   ================================================ */

.poster-mask {
  position: fixed;
  inset: 0;
  z-index: 10100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--color-overlay, rgba(0, 0, 0, 0.6));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.poster-shell {
  position: relative;
  width: min(390px, 90vw);
}

.poster-card {
  --poster-bg: var(--color-panel);
  --poster-bg-2: var(--color-panel-2);
  --poster-accent: var(--color-accent);
  --poster-accent-dim: var(--color-accent-bg);
  --poster-accent-border: var(--color-accent-border);
  --poster-ink: var(--color-text);
  --poster-ink-muted: var(--color-text-subtle);
  --poster-ink-faint: var(--color-text-muted);
  --poster-border: var(--color-border);
  --poster-glass: var(--glass-bg, rgba(255, 255, 255, 0.06));
  --poster-glass-border: var(--color-border);
  --poster-brand-gradient: var(--gradient-brand-primary);
  --poster-brand-shadow: var(--shadow-brand);

  position: relative;
  overflow: hidden;
  border-radius: 28px;
  padding: 20px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  background: var(--poster-bg);
  border: 1px solid var(--poster-border);
  box-shadow:
    var(--poster-brand-shadow),
    var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.2));
}

/* --- Hero 区域：品牌渐变大色块 --- */
.poster-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 18px 14px 16px;
  border-radius: 18px;
  background: var(--poster-brand-gradient);
  color: var(--color-btn-primary-text, #fff);
  text-align: center;
  overflow: hidden;
}

.poster-hero::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -30%;
  width: 160%;
  height: 100%;
  background: radial-gradient(ellipse, rgba(255, 255, 255, 0.12) 0%, transparent 70%);
  pointer-events: none;
}

.poster-hero-label {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.3em;
  opacity: 0.8;
  position: relative;
}

.poster-hero-title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.1;
  margin: 0;
  text-shadow: 0 0 24px var(--color-chat-glow, rgba(255, 255, 255, 0.4));
  position: relative;
}

.poster-hero-persona {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.15em;
  opacity: 0.9;
  margin: 0;
  position: relative;
}

.poster-hero-hook {
  font-size: 11px;
  line-height: 1.4;
  opacity: 0.75;
  margin: 0;
  max-width: 240px;
  position: relative;
}

.poster-hero-stars {
  font-size: 8px;
  letter-spacing: 0.5em;
  opacity: 0.35;
  position: relative;
}

/* --- 核心信息行 --- */
.poster-core {
  position: relative;
  z-index: 1;
}

.poster-core-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--poster-glass);
  border: 1px solid var(--poster-glass-border);
  flex-wrap: wrap;
}

.poster-core-item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.poster-core-label {
  font-size: 11px;
  color: var(--poster-ink-muted);
}

.poster-core-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--poster-ink);
}

.poster-core-value--nayin {
  color: var(--poster-accent);
}

/* --- 时间线信息 --- */
.poster-time {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.poster-time-item {
  font-size: 11px;
  color: var(--poster-ink-muted);
  padding: 8px 14px;
  border-radius: 10px;
  background: var(--poster-glass);
  border: 1px solid var(--poster-glass-border);
}

/* --- 三层四化面板 --- */
.poster-hua {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  background: var(--poster-glass);
  border: 1px solid var(--poster-glass-border);
  position: relative;
  z-index: 1;
}

.poster-hua-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.24em;
  color: var(--poster-accent);
  margin: 0;
  text-align: center;
}

.poster-hua-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.poster-hua-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.poster-hua-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.poster-hua-icon--0 {
  background: var(--poster-accent-dim);
  color: var(--poster-accent);
  border: 1px solid var(--poster-accent-border);
}

.poster-hua-icon--1 {
  background: var(--color-brand-100, rgba(139, 92, 246, 0.12));
  color: var(--color-brand-600, #7c3aed);
  border: 1px solid var(--color-brand-200, rgba(139, 92, 246, 0.18));
}

.poster-hua-icon--2 {
  background: var(--color-brand-50, rgba(87, 135, 255, 0.12));
  color: var(--color-brand-700, #0e7490);
  border: 1px solid var(--color-brand-100, rgba(87, 135, 255, 0.18));
}

.poster-hua-text {
  font-size: 12px;
  line-height: 1.5;
  color: var(--poster-ink-muted);
  flex: 1;
  min-width: 0;
}

/* --- 状态 --- */
.poster-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  position: relative;
  z-index: 1;
}

.poster-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--poster-ink-faint);
}

.poster-status-dot--chart {
  background: var(--poster-accent);
  box-shadow: 0 0 8px var(--poster-accent-dim);
}

.poster-status-dot--ai {
  background: var(--color-success, #22c55e);
  box-shadow: 0 0 8px var(--color-successBg, rgba(34, 197, 94, 0.3));
}

.poster-status-text {
  font-size: 11px;
  font-weight: 500;
  color: var(--poster-ink-muted);
  letter-spacing: 0.02em;
}

/* --- 底部 / 二维码 --- */
.poster-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--poster-glass);
  border: 1px solid var(--poster-glass-border);
  position: relative;
  z-index: 1;
}

.poster-cta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.poster-cta-main {
  font-size: 15px;
  font-weight: 600;
  color: var(--poster-ink);
  line-height: 1.2;
}

.poster-cta-sub {
  font-size: 11px;
  color: var(--poster-ink-muted);
  letter-spacing: 0.02em;
}

.poster-qr-wrap {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  padding: 6px;
  border-radius: 14px;
  background: var(--poster-bg-2);
  border: 1px solid var(--poster-border);
}

.poster-qr-wrap img,
.poster-qr-empty {
  width: 100%;
  height: 100%;
  border-radius: 9px;
}

.poster-qr-empty {
  background: var(--poster-glass);
}

/* --- 关闭按钮 --- */
.poster-close {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--poster-bg-2);
  color: var(--poster-ink-muted);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease;
  z-index: 2;
  border: 1px solid var(--poster-border);
}

.poster-close:hover {
  background: var(--poster-accent-dim);
  color: var(--poster-accent);
  transform: scale(1.05);
}

/* --- 入场动画 --- */
.poster-enter-enter-active {
  transition: opacity 0.3s ease;
}

.poster-enter-enter-active .poster-shell {
  animation: poster-rise 0.36s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.poster-enter-leave-active {
  transition: opacity 0.2s ease;
}

.poster-enter-enter-from,
.poster-enter-leave-to {
  opacity: 0;
}

@keyframes poster-rise {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* --- 响应式 --- */
@media (max-width: 400px) {
  .poster-card {
    padding: 16px 16px 20px;
    gap: 12px;
  }

  .poster-hero {
    padding: 14px 12px 12px;
    gap: 4px;
    border-radius: 16px;
  }

  .poster-hero-title {
    font-size: 20px;
  }

  .poster-core-row {
    gap: 10px;
    padding: 12px 12px;
  }

  .poster-core-value {
    font-size: 13px;
  }
}
</style>
