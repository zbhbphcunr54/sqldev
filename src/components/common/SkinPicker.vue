<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore, type SkinId } from '@/stores/app'

const appStore = useAppStore()
const open = ref(false)

const skins: { id: SkinId; name: string; tone: string; gradient: string }[] = [
  {
    id: 'violet-midnight',
    name: '午夜薰紫',
    tone: '紫粉',
    gradient: 'linear-gradient(135deg, #7c3aed, #db2777)'
  },
  {
    id: 'cyber-ocean',
    name: '深海赛博',
    tone: '青紫',
    gradient: 'linear-gradient(135deg, #0891b2, #7c3aed)'
  },
  {
    id: 'coral-sunset',
    name: '落日珊瑚',
    tone: '橙金',
    gradient: 'linear-gradient(135deg, #e8590c, #eab308)'
  },
  {
    id: 'indigo-aurora',
    name: '极光靛蓝',
    tone: '靛青',
    gradient: 'linear-gradient(135deg, #5865f2, #06b6d4)'
  },
  {
    id: 'teal-neutral',
    name: '翡翠中性',
    tone: '翠蓝',
    gradient: 'linear-gradient(135deg, #0d9488, #3b82f6)'
  }
]

const currentSkin = computed(() => skins.find((s) => s.id === appStore.skinId) ?? skins[0])

function select(id: SkinId) {
  appStore.setSkin(id)
  open.value = false
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (open.value && !target.closest('.skin-select')) {
    open.value = false
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) open.value = false
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div class="skin-select">
    <button
      class="skin-select__trigger"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="open = !open"
    >
      <span class="skin-select__dot" :style="{ background: currentSkin.gradient }" />
      <span class="skin-select__name">{{ currentSkin.name }}</span>
      <svg
        class="skin-select__chevron"
        :class="{ flipped: open }"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
      >
        <path
          d="M3 4.5L6 7.5L9 4.5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <Transition name="skin-drop">
      <div v-if="open" class="skin-select__dropdown" role="listbox">
        <button
          v-for="s in skins"
          :key="s.id"
          class="skin-select__option"
          :class="{ active: appStore.skinId === s.id }"
          role="option"
          :aria-selected="appStore.skinId === s.id"
          :aria-label="`切换皮肤：${s.name}`"
          @click="select(s.id)"
        >
          <span class="skin-select__option-dot" :style="{ background: s.gradient }" />
          <span class="skin-select__option-text">
            <span class="skin-select__option-name">{{ s.name }}</span>
            <span class="skin-select__option-tone">{{ s.tone }}</span>
          </span>
          <svg
            v-if="appStore.skinId === s.id"
            class="skin-select__check"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M3 7.5L5.5 10L11 4"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.skin-select {
  position: relative;
}

.skin-select__trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
  white-space: nowrap;
}

.skin-select__trigger:hover {
  border-color: var(--color-border-hover);
  background: var(--color-panel-2);
}

.skin-select__dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

.skin-select__name {
  letter-spacing: 0.02em;
}

.skin-select__chevron {
  color: var(--color-text-muted);
  transition: transform var(--duration-fast) var(--ease-apple);
  flex-shrink: 0;
}

.skin-select__chevron.flipped {
  transform: rotate(180deg);
}

.skin-select__dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 180px;
  padding: 4px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 200;
}

.skin-select__option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-apple);
}

.skin-select__option:hover {
  background: var(--color-panel-2);
}

.skin-select__option.active {
  background: var(--color-accent-bg);
}

.skin-select__option-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.skin-select__option-text {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.skin-select__option-name {
  font-weight: 600;
  font-size: 13px;
}

.skin-select__option-tone {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 400;
}

.skin-select__check {
  color: var(--color-accent);
  flex-shrink: 0;
}

.skin-drop-enter-active,
.skin-drop-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.skin-drop-enter-from,
.skin-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
