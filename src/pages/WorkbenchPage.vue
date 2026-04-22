<script setup lang="ts">
import { computed, ref } from 'vue'
import { requestConvert } from '@/api/convert'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { mapErrorCodeToMessage } from '@/utils/error-map'

const sourceDialect = ref<'oracle' | 'mysql' | 'postgresql'>('oracle')
const targetDialect = ref<'oracle' | 'mysql' | 'postgresql'>('postgresql')
const inputSql = ref('')
const outputSql = ref('')
const loading = ref(false)
const errorMessage = ref('')
const warnings = ref<string[]>([])

const hasInput = computed(() => inputSql.value.trim().length > 0)
const showEmptyState = computed(() => !hasInput.value && !loading.value && !errorMessage.value)

async function handleConvert() {
  if (!hasInput.value || loading.value) return
  loading.value = true
  errorMessage.value = ''
  warnings.value = []
  try {
    const result = await requestConvert({
      sourceDialect: sourceDialect.value,
      targetDialect: targetDialect.value,
      sql: inputSql.value
    })
    if (!result.ok) {
      errorMessage.value = '转换失败，请稍后重试。'
      return
    }
    outputSql.value = result.outputSql || ''
    warnings.value = result.warnings || []
  } catch (err) {
    if (err instanceof ApiError) {
      errorMessage.value = mapErrorCodeToMessage(err.code)
    } else {
      errorMessage.value = '转换异常：请检查登录状态或稍后重试。'
    }
  } finally {
    loading.value = false
  }
}

function handleLoadSample() {
  inputSql.value = [
    'CREATE TABLE orders (',
    '  id NUMBER(10) PRIMARY KEY,',
    '  user_id NUMBER(10) NOT NULL,',
    '  amount NUMBER(10,2) NOT NULL,',
    "  created_at DATE DEFAULT SYSDATE",
    ');'
  ].join('\n')
}
</script>

<template>
  <section class="space-y-4">
    <header class="rounded-card border border-border bg-panel p-4">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-base font-semibold">SQL 翻译工作台</h1>
        <span class="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">引擎在线</span>
      </div>
      <p class="mt-1 text-sm text-subtle">支持 Oracle / MySQL / PostgreSQL 双向转换，保留警告与审计信息。</p>
    </header>

    <section class="rounded-card border border-border bg-panel p-4">
      <div class="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto] md:items-center">
        <select v-model="sourceDialect" class="input-control w-full">
          <option value="oracle">Oracle</option>
          <option value="mysql">MySQL</option>
          <option value="postgresql">PostgreSQL</option>
        </select>
        <span class="text-center text-xs text-subtle">→</span>
        <select v-model="targetDialect" class="input-control w-full">
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="oracle">Oracle</option>
        </select>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary px-3 py-2 text-sm" @click="handleLoadSample">加载示例</button>
          <button class="btn-primary px-3 py-2 text-sm" :disabled="loading || !hasInput" @click="handleConvert">
            {{ loading ? '转换中...' : '开始转换' }}
          </button>
        </div>
      </div>
    </section>

    <div class="grid gap-4 lg:grid-cols-2">
      <article class="rounded-card border border-border bg-panel p-4">
        <p class="mb-2 text-xs text-subtle">输入 SQL（支持粘贴）</p>
        <textarea
          v-model="inputSql"
          rows="18"
          class="input-control font-mono text-sm leading-6 w-full resize-y"
          placeholder="粘贴待转换 SQL，例如 CREATE TABLE ..."
        ></textarea>
      </article>

      <article class="rounded-card border border-border bg-panel p-4">
        <p class="mb-2 text-xs text-subtle">输出 SQL</p>
        <textarea
          v-model="outputSql"
          rows="18"
          class="input-control font-mono text-sm leading-6 w-full resize-y"
          readonly
          placeholder="转换结果将显示在这里"
        ></textarea>
      </article>
    </div>

    <StatePanel
      v-if="loading"
      type="loading"
      title="正在转换 SQL"
      description="引擎正在解析语法与目标方言规则，请稍候。"
    />
    <StatePanel
      v-else-if="errorMessage"
      type="error"
      title="转换失败"
      :description="errorMessage"
    />
    <StatePanel
      v-else-if="showEmptyState"
      type="empty"
      title="还没有输入 SQL"
      description="你可以先点击“加载示例”，或直接粘贴建表语句后开始转换。"
    />
    <StatePanel
      v-else
      type="success"
      title="转换完成"
      description="结果已更新，可继续编辑输入区并重复转换。"
    >
      <ul v-if="warnings.length" class="mt-3 space-y-1 text-xs text-warning">
        <li v-for="item in warnings" :key="item">• {{ item }}</li>
      </ul>
    </StatePanel>
  </section>
</template>
