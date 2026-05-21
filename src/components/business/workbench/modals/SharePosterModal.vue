<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed, watch } from 'vue'
import QRCode from 'qrcode'
import { buildZiweiShareLink } from '@/features/ziwei/share'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const appStore = useAppStore()
const isDark = computed(() => appStore.themeMode === 'dark')

const qrDataUrl = ref('')
const shareLink = computed(() => buildZiweiShareLink(window.location))
const shareLinkDisplay = computed(() => {
  const link = shareLink.value
  return link.length > 40 ? link.slice(0, 40) + '...' : link
})

const features = [
  { tone: 'blue', title: '完整排盘', desc: '公历农历输入，十二宫星曜全展示' },
  { tone: 'gold', title: '三层四化', desc: '生年 / 大限 / 流年四化一目了然' },
  { tone: 'purple', title: 'AI 深度解读', desc: '一键生成结构化命盘解读' },
  { tone: 'teal', title: 'AI 问答', desc: '基于命盘内容自由追问' }
]

async function generateQR() {
  try {
    const style = getComputedStyle(document.documentElement)
    const qrColor = style.getPropertyValue('--color-text-subtle').trim() || (isDark.value ? '#a1a1a6' : '#1d1d1f')
    qrDataUrl.value = await QRCode.toDataURL(shareLink.value, {
      width: 160,
      margin: 1,
      color: { dark: qrColor, light: '#00000000' }
    })
  } catch { /* ignore */ }
}

watch(() => props.visible, (val) => { if (val) generateQR() }, { immediate: true })
watch(isDark, () => { if (props.visible) generateQR() })

function handleEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.visible) emit('close')
}

onMounted(() => window.addEventListener('keydown', handleEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', handleEscape))
</script>

<template>
  <Teleport to="body">
    <Transition name="poster-enter">
      <div v-if="visible" class="poster-mask" @click.self="emit('close')">
        <div class="poster-viewport">
          <div class="poster-canvas">
            <!-- 顶部渐变条 -->
            <div class="poster-accent-bar"></div>
            <!-- 光晕 -->
            <div class="poster-glow"></div>

            <div class="poster-content">
              <!-- 标题 -->
              <header class="poster-header">
                <h2 class="poster-title">紫微斗数</h2>
                <p class="poster-subtitle">专业排盘 · AI 深度解读 · 一键分享</p>
              </header>

              <!-- 示例宫位 -->
              <section class="poster-card">
                <div class="poster-card-shine"></div>
                <span class="poster-kicker">示例命盘</span>
                <div class="poster-palace-grid">
                  <div class="poster-palace" data-tone="orange">
                    <span class="poster-palace-name">命宫</span>
                    <span class="poster-palace-star">紫微</span>
                    <span class="poster-palace-star">天府</span>
                  </div>
                  <div class="poster-palace" data-tone="blue">
                    <span class="poster-palace-name">财帛</span>
                    <span class="poster-palace-star">武曲</span>
                    <span class="poster-palace-star">天相</span>
                  </div>
                  <div class="poster-palace" data-tone="purple">
                    <span class="poster-palace-name">事业</span>
                    <span class="poster-palace-star">廉贞</span>
                    <span class="poster-palace-star">破军</span>
                  </div>
                </div>
                <div class="poster-hua-row">
                  <span class="poster-hua lu">化禄</span>
                  <span class="poster-hua quan">化权</span>
                  <span class="poster-hua ke">化科</span>
                  <span class="poster-hua ji">化忌</span>
                </div>
              </section>

              <!-- 功能亮点 -->
              <section class="poster-card">
                <div class="poster-card-shine"></div>
                <span class="poster-kicker">功能亮点</span>
                <div class="poster-features">
                  <div v-for="f in features" :key="f.title" class="poster-feature">
                    <span class="poster-feature-dot" :data-tone="f.tone"></span>
                    <div class="poster-feature-text">
                      <span class="poster-feature-title">{{ f.title }}</span>
                      <span class="poster-feature-desc">{{ f.desc }}</span>
                    </div>
                  </div>
                </div>
              </section>

              <!-- 二维码 + 链接 -->
              <section class="poster-card poster-share-card">
                <div class="poster-card-shine"></div>
                <div class="poster-share-body">
                  <span class="poster-kicker">扫码体验</span>
                  <p class="poster-share-url">{{ shareLinkDisplay }}</p>
                </div>
                <div class="poster-qr-wrap">
                  <img v-if="qrDataUrl" :src="qrDataUrl" alt="分享二维码" width="72" height="72" />
                  <div v-else class="poster-qr-empty"></div>
                </div>
              </section>

              <!-- 底部 -->
              <footer class="poster-footer">紫微斗数 — 命理工具</footer>
            </div>
          </div>

          <button class="poster-close" aria-label="关闭" @click="emit('close')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* === 遮罩 === */
.poster-mask {
  position: fixed;
  inset: 0;
  z-index: 10100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--color-overlay);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  overflow-y: auto;
}

/* === 视口 === */
.poster-viewport {
  position: relative;
  width: min(380px, 90vw);
  max-height: 92vh;
  overflow-y: auto;
  border-radius: calc(var(--radius-lg) + 6px);
  box-shadow:
    0 24px 56px rgba(29, 39, 67, 0.12),
    0 8px 24px rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] .poster-viewport {
  box-shadow:
    0 24px 56px rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(0, 0, 0, 0.3);
}

.poster-viewport::-webkit-scrollbar { width: 0; }

/* === 画布 === */
.poster-canvas {
  position: relative;
  border-radius: calc(var(--radius-lg) + 6px);
  overflow: hidden;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
}

/* === 顶部渐变装饰条 === */
.poster-accent-bar {
  height: 3px;
  background: linear-gradient(90deg, var(--color-accent), var(--color-purple), var(--color-accent));
  opacity: 0.8;
}

/* === 光晕（hero-panel 风格） === */
.poster-glow {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  width: 280px;
  height: 180px;
  background: radial-gradient(
    ellipse 80% 60% at 50% 30%,
    var(--color-accent-bg),
    transparent
  );
  pointer-events: none;
}

[data-theme="dark"] .poster-glow {
  background: radial-gradient(
    ellipse 80% 60% at 50% 30%,
    var(--color-accent-bg),
    transparent
  );
}

/* === 内容 === */
.poster-content {
  position: relative;
  padding: 32px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: var(--font-body);
}

/* === 标题 === */
.poster-header {
  text-align: center;
  padding-bottom: 4px;
}

.poster-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: var(--tracking-tight);
  margin-bottom: 6px;
}

.poster-subtitle {
  font-size: 12px;
  color: var(--color-text-subtle);
  font-weight: 400;
  letter-spacing: var(--tracking-wide);
}

/* === 玻璃卡片（统一样式） === */
.poster-card {
  position: relative;
  padding: 16px;
  border-radius: var(--radius-lg);
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

[data-theme="dark"] .poster-card {
  background: var(--color-panel-2);
  border-color: var(--color-border);
}

.poster-card-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), transparent 30%);
  pointer-events: none;
  border-radius: inherit;
}

[data-theme="dark"] .poster-card-shine {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 30%);
}

/* === Kicker 标签 === */
.poster-kicker {
  display: block;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
}

/* === 示例宫位 === */
.poster-palace-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.poster-palace {
  padding: 10px;
  border-radius: var(--radius-md);
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 3px;
  transition: box-shadow var(--duration-normal) var(--ease-apple);
}

.poster-palace[data-tone="orange"] {
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--color-hua-quan) 12%, transparent);
}

.poster-palace[data-tone="blue"] {
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--color-accent) 12%, transparent);
}

.poster-palace[data-tone="purple"] {
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--color-purple) 12%, transparent);
}

.poster-palace-name {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-subtle);
  letter-spacing: 0.04em;
}

.poster-palace-star {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.35;
}

/* === 四化 Pill 标签 === */
.poster-hua-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.poster-hua {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  letter-spacing: 0.02em;
}

.poster-hua.lu {
  background: color-mix(in srgb, var(--color-hua-lu) 15%, transparent);
  color: var(--color-hua-lu);
}

.poster-hua.quan {
  background: color-mix(in srgb, var(--color-hua-quan) 15%, transparent);
  color: var(--color-hua-quan);
}

.poster-hua.ke {
  background: color-mix(in srgb, var(--color-hua-ke) 15%, transparent);
  color: var(--color-hua-ke);
}

.poster-hua.ji {
  background: color-mix(in srgb, var(--color-hua-ji) 15%, transparent);
  color: var(--color-hua-ji);
}

/* === 功能亮点 === */
.poster-features {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.poster-feature {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.poster-feature-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 5px;
}

.poster-feature-dot[data-tone="blue"] { background: var(--color-accent); }
.poster-feature-dot[data-tone="gold"] { background: var(--color-hua-lu); }
.poster-feature-dot[data-tone="purple"] { background: var(--color-purple); }
.poster-feature-dot[data-tone="teal"] { background: var(--color-hua-ke); }

.poster-feature-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.poster-feature-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.25;
}

.poster-feature-desc {
  font-size: 11px;
  color: var(--color-text-subtle);
  line-height: 1.5;
}

/* === 分享区 === */
.poster-share-card {
  display: flex;
  align-items: center;
  gap: 14px;
}

.poster-share-body {
  flex: 1;
  min-width: 0;
}

.poster-share-body .poster-kicker {
  margin-bottom: 6px;
}

.poster-share-url {
  font-size: 10px;
  color: var(--color-text-muted);
  word-break: break-all;
  line-height: 1.5;
  font-family: var(--font-code);
}

.poster-qr-wrap {
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  padding: 4px;
  background: var(--color-panel);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.poster-qr-wrap img {
  width: 100%;
  height: 100%;
  border-radius: calc(var(--radius-md) - 2px);
}

.poster-qr-empty {
  width: 100%;
  height: 100%;
  border-radius: calc(var(--radius-md) - 2px);
  background: var(--color-panel-2);
}

/* === 底部 === */
.poster-footer {
  text-align: center;
  font-size: 11px;
  color: var(--color-text-muted);
  letter-spacing: var(--tracking-wide);
  font-weight: 500;
  padding-top: 2px;
}

/* === 关闭按钮 === */
.poster-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--color-panel-2);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
  z-index: 2;
}

.poster-close:hover {
  background: var(--color-panel-3);
  color: var(--color-text);
}

/* === 入场动画 === */
.poster-enter-enter-active {
  transition: opacity var(--duration-slow) var(--ease-apple);
}

.poster-enter-enter-active .poster-viewport {
  animation: poster-rise 0.4s var(--ease-out) both;
}

.poster-enter-leave-active {
  transition: opacity var(--duration-normal) var(--ease-apple);
}

.poster-enter-enter-from,
.poster-enter-leave-to {
  opacity: 0;
}

@keyframes poster-rise {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
