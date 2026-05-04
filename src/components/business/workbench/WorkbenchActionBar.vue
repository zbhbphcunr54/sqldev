<!-- [2026-05-04] 新增：工作台操作工具栏 -->
<script setup lang="ts">
import { ref } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'
import { useClipboard } from '@/composables/useClipboard'

const store = useWorkbenchStore()
const { copyToClipboard } = useClipboard()
const fileInputRef = ref<HTMLInputElement | null>(null)

function loadSample(): void {
  store.loadSample()
}

function triggerUpload(): void {
  fileInputRef.value?.click()
}

async function handleFileUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    store.setCurrentInput(text)
    store.showAlert('成功', `已加载文件：${file.name}`)
  } catch {
    store.showAlert('错误', '文件读取失败')
  }
  input.value = ''
}

async function copyOutput(): Promise<void> {
  let output = ''
  if (store.activePage === 'ddl') output = store.outputDdl
  else if (store.activePage === 'func') output = store.funcOutput
  else if (store.activePage === 'proc') output = store.procOutput

  if (!output) {
    store.showAlert('提示', '没有可复制的内容')
    return
  }

  const success = await copyToClipboard(output)
  if (success) {
    store.showAlert('成功', '已复制到剪贴板')
  } else {
    store.showAlert('错误', '复制失败')
  }
}

function downloadOutput(): void {
  let output = ''
  let filename = 'output.sql'

  if (store.activePage === 'ddl') {
    output = store.outputDdl
    filename = 'output_ddl.sql'
  } else if (store.activePage === 'func') {
    output = store.funcOutput
    filename = 'output_function.sql'
  } else if (store.activePage === 'proc') {
    output = store.procOutput
    filename = 'output_procedure.sql'
  }

  if (!output) {
    store.showAlert('提示', '没有可下载的内容')
    return
  }

  const blob = new Blob([output], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function clearAll(): void {
  store.clearInput()
}
</script>

<template>
  <div class="action-bar-wrap" v-if="store.isWorkbenchPage">
    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".sql,.txt"
      class="hidden-input"
      @change="handleFileUpload"
    />

    <button
      class="action-bar-toggle"
      @click="store.actionBarCollapsed = !store.actionBarCollapsed"
      :aria-expanded="!store.actionBarCollapsed"
      type="button"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M3 2.5h10v11H3z" stroke="currentColor" stroke-width="1.3" />
        <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      </svg>
      工具
      <svg
        class="action-bar-toggle-chevron"
        :class="{ expanded: !store.actionBarCollapsed }"
        width="10"
        height="10"
        viewBox="0 0 10 10"
      >
        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </svg>
    </button>

    <div class="action-bar" role="toolbar" aria-label="工作台操作" v-show="!store.actionBarCollapsed">
      <button class="action-btn" type="button" @click="loadSample">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 2.5h10v11H3z" stroke="currentColor" stroke-width="1.3" />
          <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
        加载示例
      </button>

      <button class="action-btn" type="button" @click="triggerUpload">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 11V3M8 3 5.5 5.5M8 3l2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M3 11.5v1h10v-1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
        上传文件
      </button>

      <button class="action-btn" type="button" @click="copyOutput">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="5" y="3" width="8" height="10" rx="1" stroke="currentColor" stroke-width="1.3" />
          <path d="M3 11V4.5A1.5 1.5 0 0 1 4.5 3H10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
        复制输出
      </button>

      <button class="action-btn" type="button" @click="downloadOutput">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 2.5h8l2 2v9H3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
          <path d="M5 2.5v3h5v-3M5 12h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
        保存文件
      </button>

      <div class="action-divider"></div>

      <button class="action-btn action-btn-danger" type="button" @click="clearAll">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 4h10M6 2.5h4M5 4v8.5h6V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        清空
      </button>
    </div>
  </div>
</template>

<style scoped>
.action-bar-wrap {
  display: flex;
  align-items: center;
  padding: 8px 24px;
  background: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
}

.hidden-input {
  display: none;
}

.action-bar-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.action-bar-toggle:hover {
  background: var(--color-panel-2);
}

.action-bar-toggle-chevron {
  transition: transform 0.2s;
}

.action-bar-toggle-chevron.expanded {
  transform: rotate(180deg);
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--color-border);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.action-btn:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
  border-color: var(--color-border);
}

.action-btn-danger:hover {
  background: rgba(220, 38, 38, 0.1);
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.action-divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: var(--color-border);
}

/* Mobile */
@media (max-width: 768px) {
  .action-bar {
    display: none;
  }
}
</style>
