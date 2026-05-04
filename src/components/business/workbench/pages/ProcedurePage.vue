<!-- [2026-05-04] 新增：存储过程翻译页面 -->
<script setup lang="ts">
import { useWorkbenchStore } from '@/stores/workbench'
import { requestConvert } from '@/api/convert'
import { mapErrorCodeToMessage } from '@/utils/error-map'
import { useClipboard } from '@/composables/useClipboard'
import SqlEditor from '../components/SqlEditor.vue'

const store = useWorkbenchStore()
const { copyToClipboard } = useClipboard()

async function handleConvert(): Promise<void> {
  if (!store.procInput.trim()) {
    store.showAlert('提示', '请输入要翻译的存储过程语句')
    return
  }

  store.procConverting = true

  try {
    const result = await requestConvert({
      sourceDialect: store.procSourceDb,
      targetDialect: store.procTargetDb,
      sql: store.procInput,
      kind: 'proc'
    })

    if (result.ok) {
      store.procOutput = result.outputSql || ''
    } else {
      store.procOutput = ''
      store.showAlert('翻译失败', mapErrorCodeToMessage(result.error || 'convert_failed'))
    }
  } catch (error) {
    store.procOutput = ''
    store.showAlert('翻译失败', mapErrorCodeToMessage(String(error)))
  } finally {
    store.procConverting = false
  }
}

async function handleCopy(): Promise<void> {
  if (!store.procOutput) return
  await copyToClipboard(store.procOutput)
}

function handleInputUpdate(value: string): void {
  store.procInput = value
}
</script>

<template>
  <div class="proc-page">
    <section class="workspace">
      <!-- Input Panel -->
      <article class="panel">
        <div class="panel-head">
          <div class="panel-head-left">
            <span class="panel-dot" :class="store.procSourceDb"></span>
            <h2 class="panel-title">{{ store.procSourceLabel }} 输入</h2>
          </div>
          <span class="panel-paste-hint">Ctrl / ⌘ + Enter 翻译</span>
        </div>
        <p class="panel-desc">粘贴 {{ store.procSourceLabel }} 存储过程定义（CREATE PROCEDURE / CREATE OR REPLACE PROCEDURE）</p>

        <div class="panel-editor-shell">
          <SqlEditor
            :model-value="store.procInput"
            placeholder="粘贴 CREATE PROCEDURE 语句..."
            @update:model-value="handleInputUpdate"
          />
        </div>
      </article>

      <!-- Output Panel -->
      <article class="panel">
        <div class="panel-head">
          <div class="panel-head-left">
            <span class="panel-dot" :class="store.procTargetDb"></span>
            <h2 class="panel-title">{{ store.procTargetLabel }} 输出</h2>
          </div>
          <button
            class="panel-copy-btn"
            @click="handleCopy"
            :disabled="!store.procOutput"
            title="复制输出"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="5" y="3" width="8" height="10" rx="1" stroke="currentColor" stroke-width="1.3" />
              <path d="M3 11V4.5A1.5 1.5 0 0 1 4.5 3H10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            </svg>
            复制
          </button>
        </div>
        <p class="panel-desc">翻译结果</p>

        <div class="panel-editor-shell">
          <SqlEditor
            :model-value="store.procOutput"
            :readonly="true"
            placeholder="等待翻译..."
          />
        </div>
      </article>
    </section>

    <div class="status-bar">
      <span class="status-text">
        {{ store.procConverting ? '正在翻译...' : '就绪' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.proc-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.workspace {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  flex: 1;
  background: var(--color-border);
  overflow: hidden;
}

.panel {
  display: flex;
  flex-direction: column;
  background: var(--color-panel);
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.panel-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.panel-dot.oracle {
  background: #f44336;
}

.panel-dot.mysql {
  background: #00758f;
}

.panel-dot.postgresql {
  background: #336791;
}

.panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.panel-paste-hint {
  flex: 1;
  font-size: 12px;
  color: var(--color-text-subtle);
}

.panel-copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.panel-copy-btn:hover:not(:disabled) {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.panel-copy-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.panel-desc {
  margin: 0;
  padding: 8px 16px;
  font-size: 12px;
  color: var(--color-text-subtle);
  background: var(--color-panel-2);
  border-bottom: 1px solid var(--color-border);
}

.panel-editor-shell {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.status-bar {
  display: flex;
  align-items: center;
  padding: 8px 24px;
  background: var(--color-panel);
  border-top: 1px solid var(--color-border);
}

.status-text {
  font-size: 12px;
  color: var(--color-text-subtle);
}

@media (max-width: 768px) {
  .workspace {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
}
</style>
