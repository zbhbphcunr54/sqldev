<!-- [2026-05-03] 新增：提示弹窗 -->
<script setup lang="ts">
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.alertModal.visible"
      class="modal-mask"
      @click.self="store.hideAlert()"
    >
      <div class="modal" role="dialog" aria-modal="true" :aria-labelledby="'alert-title'">
        <div class="modal-head">
          <h4 id="alert-title" class="modal-title">{{ store.alertModal.title }}</h4>
          <button class="modal-close" @click="store.hideAlert()" aria-label="关闭">
            &times;
          </button>
        </div>
        <div class="modal-body">
          <p>{{ store.alertModal.message }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn-modal primary" @click="store.hideAlert()">确定</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
}

.modal {
  width: min(400px, 96vw);
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-modal);
  overflow: hidden;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 20px;
  cursor: pointer;
  transition: background 0.15s;
}

.modal-close:hover {
  background: var(--color-panel-2);
}

.modal-body {
  padding: 20px;
}

.modal-body p {
  margin: 0;
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.6;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
  background: var(--color-panel-2);
}

.btn-modal {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-modal:hover {
  background: var(--color-panel-2);
}

.btn-modal.primary {
  border-color: var(--color-brand-500);
  background: var(--color-brand-500);
  color: white;
}

.btn-modal.primary:hover {
  background: var(--color-brand-600);
}
</style>
