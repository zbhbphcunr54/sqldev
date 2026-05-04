<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  requestConvertVerify,
  fetchVerifyQuota,
  type ConvertVerifyResponse,
  type QuotaByKind
} from '@/api/convert-verify'
import VerifyScoreBadge from './VerifyScoreBadge.vue'
import VerifyIssueList from './VerifyIssueList.vue'
import VerifySuggestionCard from './VerifySuggestionCard.vue'

const props = defineProps<{
  kind: 'ddl' | 'func' | 'proc'
  fromDb: string
  toDb: string
  inputSql: string
  outputSql: string
}>()

const emit = defineEmits<{
  (e: 'verify-complete', result: ConvertVerifyResponse): void
}>()

const loading = ref(false)
const result = ref<ConvertVerifyResponse | null>(null)
const errorMessage = ref('')
const quota = ref<QuotaByKind | null>(null)

const currentQuota = computed(() => {
  if (!quota.value) return null
  return quota.value[props.kind] || null
})

const canVerify = computed(() => {
  if (!currentQuota.value) return true
  return currentQuota.value.remaining > 0
})

async function handleVerify() {
  if (!canVerify.value || loading.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await requestConvertVerify({
      kind: props.kind,
      fromDb: props.fromDb as 'oracle' | 'mysql' | 'postgresql',
      toDb: props.toDb as 'oracle' | 'mysql' | 'postgresql',
      inputSql: props.inputSql,
      outputSql: props.outputSql
    })

    result.value = response
    emit('verify-complete', response)

    // Refresh quota
    quota.value = await fetchVerifyQuota()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : '校验失败'
  } finally {
    loading.value = false
  }
}

async function loadQuota() {
  try {
    quota.value = await fetchVerifyQuota()
  } catch {
    // Ignore quota loading errors
  }
}

// Load quota on mount
loadQuota()
</script>

<template>
  <div class="border rounded-lg bg-white overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="font-medium text-gray-700">AI 校验</span>
        <span
          v-if="currentQuota"
          class="text-xs px-2 py-1 rounded"
          :class="currentQuota.remaining > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
        >
          今日配额：{{ currentQuota.used }}/{{ currentQuota.limit }}
        </span>
      </div>
      <button
        :disabled="!canVerify || loading"
        :class="[
          'px-4 py-1.5 rounded text-sm font-medium transition-colors',
          canVerify && !loading
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        ]"
        @click="handleVerify"
      >
        {{ loading ? '校验中...' : '开始校验' }}
      </button>
    </div>

    <!-- Content -->
    <div class="p-4">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        <span class="ml-3 text-gray-600">正在分析 SQL...</span>
      </div>

      <!-- Error -->
      <div v-else-if="errorMessage" class="text-center py-8">
        <p class="text-red-600 mb-2">校验失败</p>
        <p class="text-gray-600 text-sm">{{ errorMessage }}</p>
        <button
          class="mt-3 px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          @click="handleVerify"
        >
          重试
        </button>
      </div>

      <!-- Result -->
      <div v-else-if="result?.ok && result.overallScore !== undefined" class="space-y-6">
        <!-- Score -->
        <VerifyScoreBadge :score="result.overallScore" :summary="result.summary" />

        <!-- Tabs -->
        <div class="border rounded-lg overflow-hidden">
          <div class="flex border-b bg-gray-50">
            <button
              class="px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600"
            >
              全部问题 ({{ (result.syntaxIssues?.length || 0) + (result.semanticIssues?.length || 0) + (result.logicRisks?.length || 0) }})
            </button>
          </div>
          <div class="p-4">
            <VerifyIssueList
              :syntax-issues="result.syntaxIssues || []"
              :semantic-issues="result.semanticIssues || []"
              :logic-risks="result.logicRisks || []"
            />
          </div>
        </div>

        <!-- Suggestions -->
        <div v-if="result.suggestions && result.suggestions.length > 0">
          <h3 class="text-sm font-medium text-gray-700 mb-3">修改建议</h3>
          <VerifySuggestionCard :suggestions="result.suggestions" />
        </div>

        <!-- Meta -->
        <div class="text-xs text-gray-400 flex items-center gap-4">
          <span v-if="result.cached">缓存命中</span>
          <span v-if="result.model">模型: {{ result.model }}</span>
          <span v-if="result.durationMs">耗时: {{ result.durationMs }}ms</span>
        </div>
      </div>

      <!-- Empty -->
      <div v-else class="text-center py-12 text-gray-500">
        <p class="text-lg mb-2">🔍</p>
        <p>点击"开始校验"进行 AI 校验</p>
        <p class="text-sm mt-1">AI 将检查语法、语义和业务逻辑问题</p>
      </div>
    </div>
  </div>
</template>
