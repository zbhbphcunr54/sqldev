<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { WORKBENCH_SECTIONS, buildWorkbenchPath } from '@/features/navigation/workbench-sections'

const props = withDefaults(
  defineProps<{
    hashPath: string
  }>(),
  {
    hashPath: '/workbench/ddl'
  }
)

const router = useRouter()
const frameRef = ref<HTMLIFrameElement | null>(null)
const loading = ref(true)
const failed = ref(false)

function normalizeLegacyHashPath(value: unknown): string {
  const hashPath = String(value || '/workbench/ddl')
  return hashPath.startsWith('/') ? hashPath : `/${hashPath}`
}

function buildLegacyFrameSrc(hashPathValue: unknown): string {
  const normalized = normalizeLegacyHashPath(hashPathValue)
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}legacy.html#${normalized}`
}

const frameSrc = ref(buildLegacyFrameSrc(props.hashPath))
const frameLoaded = ref(false)

function postFrameHashPath(hashPathValue: unknown): void {
  const contentWindow = frameRef.value?.contentWindow
  if (!contentWindow) return
  contentWindow.postMessage(
    {
      type: 'sqldev:set-workbench-hash',
      hashPath: normalizeLegacyHashPath(hashPathValue)
    },
    window.location.origin
  )
}

watch(
  () => props.hashPath,
  (hashPath) => {
    if (!frameLoaded.value || failed.value) {
      frameSrc.value = buildLegacyFrameSrc(hashPath)
      loading.value = true
      return
    }
    postFrameHashPath(hashPath)
  }
)

type LegacyFrameMessage =
  | { type?: 'sqldev:navigate-home' }
  | { type?: 'sqldev:navigate-workbench-section'; section?: unknown; replace?: unknown }

const allowedWorkbenchSections = new Set<string>(WORKBENCH_SECTIONS)

function readLegacyFrameMessage(event: MessageEvent): LegacyFrameMessage | null {
  if (event.origin !== window.location.origin) return null
  if (event.source !== frameRef.value?.contentWindow) return null
  const data = event.data as LegacyFrameMessage | null
  if (!data || typeof data.type !== 'string') return null
  return data
}

async function handleFrameMessage(event: MessageEvent): Promise<void> {
  const data = readLegacyFrameMessage(event)
  if (!data) return
  if (data.type === 'sqldev:navigate-home') {
    await router.push('/')
    return
  }
  if (data.type === 'sqldev:navigate-workbench-section') {
    const section = String(data.section || 'ddl').trim()
    if (!allowedWorkbenchSections.has(section)) return
    const target = buildWorkbenchPath(section)
    if (data.replace) {
      await router.replace(target)
      return
    }
    await router.push(target)
  }
}

function handleFrameLoad(): void {
  frameLoaded.value = true
  loading.value = false
  failed.value = false
}

function handleFrameError(): void {
  loading.value = false
  failed.value = true
}

onMounted(() => {
  window.addEventListener('message', handleFrameMessage)
})

onUnmounted(() => {
  window.removeEventListener('message', handleFrameMessage)
})
</script>

<template>
  <section class="legacy-frame-page">
    <iframe
      ref="frameRef"
      class="legacy-frame"
      :src="frameSrc"
      title="SQLDev Legacy Workbench"
      loading="eager"
      referrerpolicy="no-referrer"
      sandbox="allow-same-origin allow-scripts allow-forms"
      allow="clipboard-read; clipboard-write"
      @load="handleFrameLoad"
      @error="handleFrameError"
    />

    <div v-if="loading || failed" class="legacy-frame-state" role="status">
      <div class="legacy-frame-state-card">
        <span class="legacy-frame-state-dot"></span>
        <strong>{{ failed ? '页面加载失败' : '正在加载工作台' }}</strong>
        <p>{{ failed ? '请刷新页面或稍后重试。' : '正在准备完整 SQLDev 界面...' }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.legacy-frame-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg, #0b1020);
}

.legacy-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.legacy-frame-state {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 35%, rgba(80, 111, 255, 0.2), transparent 34%),
    var(--color-bg, #0b1020);
}

.legacy-frame-state-card {
  display: grid;
  gap: 0.45rem;
  min-width: 260px;
  max-width: 360px;
  padding: 1.25rem;
  border: 1px solid var(--color-border, rgba(148, 163, 184, 0.18));
  border-radius: 1.25rem;
  color: var(--color-text, #e5eefc);
  background: var(--color-panel, rgba(12, 18, 34, 0.86));
  box-shadow: var(--shadow-panel, 0 20px 70px rgba(0, 0, 0, 0.28));
}

.legacy-frame-state-card p {
  margin: 0;
  color: var(--color-subtle, #8fa0bb);
  font-size: 0.875rem;
}

.legacy-frame-state-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
  background: var(--color-brand-500, #6477ff);
  box-shadow: 0 0 18px rgba(100, 119, 255, 0.72);
  animation: legacy-frame-pulse 1.1s ease-out infinite;
}

@keyframes legacy-frame-pulse {
  0% {
    transform: scale(0.82);
    opacity: 0.62;
  }

  60% {
    transform: scale(1.16);
    opacity: 1;
  }

  100% {
    transform: scale(0.82);
    opacity: 0.62;
  }
}
</style>
