<!-- [2026-05-07] 通用确认弹窗组件 -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { useConfirm } from '@/composables/useConfirm'

const { visible, title, message, confirmText, cancelText, confirmClass, handleConfirm, handleCancel } = useConfirm()

const confirmPanel = ref<HTMLElement | null>(null)

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') handleCancel()
}

watch(visible, (val) => {
  if (val) {
    nextTick(() => confirmPanel.value?.focus())
  }
})

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="confirm-overlay" @click.self="handleCancel">
      <div ref="confirmPanel" class="confirm-panel" tabindex="-1">
        <div class="confirm-header">
          <h3 class="confirm-title">{{ title }}</h3>
          <button class="confirm-close" aria-label="关闭对话框" @click="handleCancel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="confirm-body">
          <p class="confirm-message">{{ message }}</p>
        </div>
        <div class="confirm-footer">
          <button class="btn btn-cancel" @click="handleCancel">{{ cancelText }}</button>
          <button class="btn" :class="confirmClass === 'danger' ? 'btn-danger' : 'btn-primary'" @click="handleConfirm">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
  animation: confirmFadeIn 0.15s ease-out;
}

@keyframes confirmFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.confirm-panel {
  width: 420px;
  max-width: 92vw;
  background: var(--color-panel);
  border: 1px solid var(--color-modal-border);
  border-radius: var(--radius-modal);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: confirmScaleIn 0.2s ease-out;
}

@keyframes confirmScaleIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.confirm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-modal-section-border);
}

.confirm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  font-family: var(--font-body);
}

.confirm-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.confirm-close:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.confirm-body {
  padding: 24px;
}

.confirm-message {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-subtle);
  line-height: 1.6;
  white-space: pre-line;
  font-family: var(--font-body);
}

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-modal-section-border);
}

.btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-subtle);
}

.btn-cancel:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.btn-primary {
  background: var(--color-accent);
  color: var(--color-btn-primary-text);
}

.btn-primary:hover {
  background: var(--color-accent-hover);
}

.btn-danger {
  background: var(--color-danger);
  color: var(--color-btn-primary-text);
}

.btn-danger:hover {
  background: var(--color-danger-hover);
}
</style>
