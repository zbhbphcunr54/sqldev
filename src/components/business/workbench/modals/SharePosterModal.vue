<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { buildZiweiShareLink } from '@/features/ziwei/share'

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
}>(), {
  profileName: '',
  chartMeta: '',
  correctionText: '',
  highlights: () => [],
  huaFacts: () => [],
  chartReady: false,
  aiAnalysisReady: false
})

const emit = defineEmits<{
  close: []
}>()

const qrDataUrl = ref('')
const shareLink = computed(() => buildZiweiShareLink(window.location))
const displayName = computed(() => props.profileName.trim() || '命盘档案')
const displayHighlights = computed(() =>
  props.highlights.filter(item => item.value && item.value !== '--').slice(0, 6)
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
    qrDataUrl.value = await QRCode.toDataURL(shareLink.value, {
      width: 200,
      margin: 0,
      color: { dark: '#1a1a2e', light: '#00000000' }
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
            <!-- Decorative background glows -->
            <div class="poster-glow poster-glow--gold"></div>
            <div class="poster-glow poster-glow--blue"></div>
            <div class="poster-glow poster-glow--purple"></div>

            <!-- Decorative ring -->
            <div class="poster-ring"></div>

            <!-- Title -->
            <header class="poster-header">
              <span class="poster-ornament">*</span>
              <span class="poster-title-text">紫 微 命 格</span>
              <span class="poster-ornament">*</span>
            </header>

            <!-- Name + Birth info panel -->
            <section class="poster-identity">
              <h2 class="poster-name">{{ displayName }}</h2>
              <div class="poster-divider"></div>
              <p v-if="chartMeta" class="poster-birth-meta">{{ chartMeta }}</p>
              <p v-if="correctionText" class="poster-correction">{{ correctionText }}</p>
            </section>

            <!-- Stats grid -->
            <section v-if="displayHighlights.length" class="poster-stats">
              <div
                v-for="item in displayHighlights"
                :key="item.label"
                class="poster-stat"
              >
                <span class="poster-stat-label">{{ item.label }}</span>
                <span class="poster-stat-value">{{ item.value }}</span>
              </div>
            </section>

            <!-- Three-layer Hua panel -->
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

            <!-- Status indicator -->
            <div class="poster-status">
              <span class="poster-status-dot" :class="{ 'poster-status-dot--ai': aiAnalysisReady, 'poster-status-dot--chart': chartReady && !aiAnalysisReady }"></span>
              <span class="poster-status-text">{{ statusText }}</span>
            </div>

            <!-- QR code + CTA -->
            <footer class="poster-footer">
              <div class="poster-cta">
                <span class="poster-cta-main">扫码排你的命盘</span>
                <span class="poster-cta-sub">SQLDev · 紫微斗数</span>
              </div>
              <div class="poster-qr-wrap">
                <img v-if="qrDataUrl" :src="qrDataUrl" alt="分享二维码" width="72" height="72" />
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
   命格卡 (Destiny Card) — 深空主题分享海报
   ================================================ */

.poster-mask {
  position: fixed;
  inset: 0;
  z-index: 10100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(2, 4, 16, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.poster-shell {
  position: relative;
  width: min(390px, 90vw);
}

.poster-card {
  --poster-gold: #e8c372;
  --poster-gold-dim: rgba(232, 195, 114, 0.5);
  --poster-gold-glow: rgba(232, 195, 114, 0.18);
  --poster-ink: #f0eadd;
  --poster-ink-muted: rgba(240, 234, 221, 0.52);
  --poster-glass: rgba(255, 255, 255, 0.04);
  --poster-glass-border: rgba(255, 255, 255, 0.08);
  --poster-glass-strong: rgba(255, 255, 255, 0.06);

  position: relative;
  overflow: hidden;
  border-radius: 28px;
  padding: 32px 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  background:
    radial-gradient(ellipse 120% 80% at 20% 10%, rgba(232, 195, 114, 0.1), transparent 50%),
    radial-gradient(ellipse 100% 60% at 85% 20%, rgba(87, 135, 255, 0.08), transparent 40%),
    radial-gradient(ellipse 80% 60% at 50% 90%, rgba(139, 92, 246, 0.07), transparent 40%),
    linear-gradient(168deg, #070b1e 0%, #0c1230 40%, #111a40 72%, #0e1535 100%);

  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    0 40px 80px rgba(0, 0, 0, 0.5),
    0 12px 28px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* --- Decorative glow orbs --- */
.poster-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  pointer-events: none;
  z-index: 0;
}

.poster-glow--gold {
  top: -60px;
  left: -30px;
  width: 200px;
  height: 200px;
  background: rgba(232, 195, 114, 0.15);
  opacity: 0.6;
}

.poster-glow--blue {
  top: 30px;
  right: -50px;
  width: 180px;
  height: 180px;
  background: rgba(87, 135, 255, 0.12);
  opacity: 0.5;
}

.poster-glow--purple {
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: 240px;
  height: 200px;
  background: rgba(139, 92, 246, 0.1);
  opacity: 0.4;
}

/* --- Decorative celestial ring --- */
.poster-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 340px;
  height: 340px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid rgba(232, 195, 114, 0.04);
  pointer-events: none;
  z-index: 0;
}

.poster-ring::after {
  content: '';
  position: absolute;
  inset: 20px;
  border-radius: 50%;
  border: 1px dashed rgba(232, 195, 114, 0.03);
}

/* --- All content above glow --- */
.poster-header,
.poster-identity,
.poster-stats,
.poster-hua,
.poster-status,
.poster-footer {
  position: relative;
  z-index: 1;
}

/* --- Title --- */
.poster-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.poster-ornament {
  font-size: 10px;
  color: var(--poster-gold-dim);
  line-height: 1;
}

.poster-title-text {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.36em;
  color: var(--poster-gold);
  text-transform: uppercase;
}

/* --- Name + Birth Info --- */
.poster-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 16px;
  border-radius: 20px;
  background: var(--poster-glass);
  border: 1px solid var(--poster-glass-border);
  backdrop-filter: blur(8px);
}

.poster-name {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--poster-ink);
  text-align: center;
  margin: 0;
}

.poster-divider {
  width: 48px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--poster-gold-dim), transparent);
}

.poster-birth-meta {
  font-size: 12px;
  line-height: 1.5;
  color: var(--poster-ink-muted);
  text-align: center;
  margin: 0;
}

.poster-correction {
  font-size: 11px;
  line-height: 1.4;
  color: rgba(232, 195, 114, 0.6);
  text-align: center;
  margin: 0;
}

/* --- Stats Grid (2×3) --- */
.poster-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.poster-stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 14px 12px;
  border-radius: 16px;
  background: var(--poster-glass);
  border: 1px solid var(--poster-glass-border);
  backdrop-filter: blur(6px);
}

.poster-stat-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--poster-ink-muted);
}

.poster-stat-value {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: var(--poster-ink);
}

/* --- Three-layer Hua panel --- */
.poster-hua {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  background: var(--poster-glass-strong);
  border: 1px solid var(--poster-glass-border);
  backdrop-filter: blur(8px);
}

.poster-hua-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.24em;
  color: var(--poster-gold);
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
  background: rgba(232, 195, 114, 0.15);
  color: var(--poster-gold);
  border: 1px solid rgba(232, 195, 114, 0.2);
}

.poster-hua-icon--1 {
  background: rgba(139, 92, 246, 0.12);
  color: #c4a3ff;
  border: 1px solid rgba(139, 92, 246, 0.18);
}

.poster-hua-icon--2 {
  background: rgba(87, 135, 255, 0.12);
  color: #8fb5ff;
  border: 1px solid rgba(87, 135, 255, 0.18);
}

.poster-hua-text {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(240, 234, 221, 0.78);
  flex: 1;
  min-width: 0;
}

/* --- Status --- */
.poster-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.poster-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--poster-ink-muted);
}

.poster-status-dot--chart {
  background: var(--poster-gold);
  box-shadow: 0 0 8px rgba(232, 195, 114, 0.4);
}

.poster-status-dot--ai {
  background: #7ce7d8;
  box-shadow: 0 0 8px rgba(124, 231, 216, 0.4);
}

.poster-status-text {
  font-size: 11px;
  font-weight: 500;
  color: var(--poster-ink-muted);
  letter-spacing: 0.02em;
}

/* --- Footer / QR --- */
.poster-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--poster-glass);
  border: 1px solid var(--poster-glass-border);
  backdrop-filter: blur(6px);
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
  width: 72px;
  height: 72px;
  padding: 6px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.poster-qr-wrap img,
.poster-qr-empty {
  width: 100%;
  height: 100%;
  border-radius: 9px;
}

.poster-qr-empty {
  background: rgba(0, 0, 0, 0.06);
}

/* --- Close button --- */
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
  background: rgba(7, 14, 25, 0.7);
  color: rgba(240, 234, 221, 0.9);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
  z-index: 2;
}

.poster-close:hover {
  background: rgba(7, 14, 25, 0.9);
  transform: scale(1.05);
}

/* --- Entrance animation --- */
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

/* --- Responsive --- */
@media (max-width: 400px) {
  .poster-card {
    padding: 28px 18px 24px;
    gap: 16px;
  }

  .poster-name {
    font-size: 24px;
  }

  .poster-stat-value {
    font-size: 15px;
  }

  .poster-stats {
    gap: 6px;
  }

  .poster-stat {
    padding: 12px 12px 10px;
  }
}
</style>
