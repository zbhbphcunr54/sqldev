<script setup lang="ts">
import { useEscapeKey } from '@/composables/useEscapeKey'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

useEscapeKey(() => emit('close'))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="base-modal-overlay" @click.self="emit('close')">
      <div class="base-modal-panel">
        <div class="base-modal-header">
          <div class="base-modal-header-content">
            <h2 class="base-modal-title"><slot name="title" /></h2>
            <p v-if="$slots.subtitle" class="base-modal-subtitle"><slot name="subtitle" /></p>
          </div>
          <button class="base-modal-close" aria-label="关闭" @click="emit('close')">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="base-modal-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="base-modal-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.base-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
  animation: bm-fade-in 0.15s ease-out;
}

@keyframes bm-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.base-modal-panel {
  width: 520px;
  max-width: 92vw;
  max-height: 90vh;
  background: var(--color-panel);
  border: 1px solid var(--color-modal-border);
  border-radius: var(--radius-modal);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: bm-scale-in 0.2s ease-out;
}

@keyframes bm-scale-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.base-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-modal-section-border);
  flex-shrink: 0;
}

.base-modal-header-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.base-modal-title {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.base-modal-subtitle {
  font-size: 13px;
  color: var(--color-text-subtle);
  margin: 0;
}

.base-modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  flex-shrink: 0;
}

.base-modal-close:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.base-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.base-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-modal-section-border);
  flex-shrink: 0;
}
</style>
