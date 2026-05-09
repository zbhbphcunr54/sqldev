<!-- [2026-05-05] 更新：工作台操作工具栏 - 完全匹配 UI 预览 -->
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
    filename = 'ddl_translated.sql'
  } else if (store.activePage === 'func') {
    output = store.funcOutput
    filename = 'function_translated.sql'
  } else if (store.activePage === 'proc') {
    output = store.procOutput
    filename = 'procedure_translated.sql'
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

function aiVerify(): void {
  let output = ''
  if (store.activePage === 'ddl') output = store.outputDdl
  else if (store.activePage === 'func') output = store.funcOutput
  else if (store.activePage === 'proc') output = store.procOutput

  if (!output) {
    store.showAlert('提示', '请先进行翻译后再使用AI校验')
    return
  }
  store.showAlert('AI 校验', 'AI 校验功能开发中...')
}

function clearAll(): void {
  store.clearInput()
}
</script>

<template>
  <div v-if="store.isWorkbenchPage" class="wb-toolbar">
    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".sql,.txt"
      class="hidden-input"
      @change="handleFileUpload"
    />

    <button class="tb-btn" type="button" title="加载示例" aria-label="加载示例" @click="loadSample">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.2" />
        <path
          d="M3.5 4.5h7M3.5 7h5M3.5 9.5h6"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
        />
      </svg>
      <span class="tb-label">示例</span>
    </button>

    <button
      class="tb-btn"
      type="button"
      title="上传文件"
      aria-label="上传文件"
      @click="triggerUpload"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M7 10V3M7 3 5 5M7 3l2 2"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path d="M2 10.5v1h10v-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
      </svg>
      <span class="tb-label">上传</span>
    </button>

    <button class="tb-btn" type="button" title="复制输出" aria-label="复制输出" @click="copyOutput">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="4" y="3" width="7" height="8" rx="1" stroke="currentColor" stroke-width="1.2" />
        <path
          d="M3 10V5A1 1 0 0 1 4 4H8.5"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
        />
      </svg>
      <span class="tb-label">复制</span>
    </button>

    <button
      class="tb-btn"
      type="button"
      title="下载文件"
      aria-label="下载文件"
      @click="downloadOutput"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M2 3h8l2 2v7H2z"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linejoin="round"
        />
        <path d="M4 3v2.5h5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        <path d="M4 10h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
      </svg>
      <span class="tb-label">下载</span>
    </button>

    <div class="tb-sep"></div>

    <button
      class="tb-btn tb-btn-ai"
      type="button"
      title="AI 语法校验"
      aria-label="AI 语法校验"
      @click="aiVerify"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M7 1v2M7 11v2M1 7h2M11 7h2M3 3l1.5 1.5M9.5 9.5 11 11M11 3l-1.5 1.5M4.5 9.5 3 11"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
        />
        <circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.2" />
      </svg>
      <span class="tb-label">AI 校验</span>
    </button>

    <div class="tb-spacer"></div>

    <button
      class="tb-btn danger"
      type="button"
      title="清空内容"
      aria-label="清空内容"
      @click="clearAll"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M2.5 3.5h9M5 2h4M4.5 3.5v7h5v-7"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="tb-label">清空</span>
    </button>
  </div>
</template>

<style scoped>
.wb-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-panel);
  flex-shrink: 0;
}

.hidden-input {
  display: none;
}

.tb-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--color-text-muted);
  border-radius: 6px;
  transition: all 0.15s;
  cursor: pointer;
  border: none;
  background: transparent;
}

.tb-btn:hover {
  color: var(--color-text);
  background: var(--color-panel-2);
}

.tb-btn:focus-visible {
  color: var(--color-text);
  background: var(--color-panel-2);
}

.tb-btn svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.tb-sep {
  width: 1px;
  height: 14px;
  background: var(--color-border);
  margin: 0 4px;
}

.tb-spacer {
  flex: 1;
}

.tb-btn.danger:hover {
  color: var(--color-danger);
  background: var(--color-danger-bg);
}

.tb-btn.danger:focus-visible {
  color: var(--color-danger);
  background: var(--color-danger-bg);
}

.tb-btn-ai {
  color: var(--color-brand-500);
}

.tb-btn-ai:hover {
  background: var(--color-brand-50);
}

.tb-btn-ai:focus-visible {
  background: var(--color-brand-50);
}

@media (max-width: 768px) {
  .wb-toolbar {
    overflow-x: auto;
    padding: 5px 10px;
    gap: 4px;
    scrollbar-width: none;
  }

  .wb-toolbar::-webkit-scrollbar {
    display: none;
  }

  .tb-btn {
    padding: 6px;
    min-width: 28px;
    justify-content: center;
  }

  .tb-label,
  .tb-sep,
  .tb-spacer {
    display: none;
  }
}
</style>
