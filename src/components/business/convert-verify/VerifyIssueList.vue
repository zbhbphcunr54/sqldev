<script setup lang="ts">
import type { SyntaxIssue, SemanticIssue, LogicRisk } from '@/api/convert-verify'

defineProps<{
  syntaxIssues: SyntaxIssue[]
  semanticIssues: SemanticIssue[]
  logicRisks: LogicRisk[]
}>()

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'error': return '❌'
    case 'warning': return '⚠️'
    default: return 'ℹ️'
  }
}

function getSeverityClass(severity: string): string {
  switch (severity) {
    case 'error': return 'border-red-200 bg-red-50'
    case 'warning': return 'border-yellow-200 bg-yellow-50'
    default: return 'border-blue-200 bg-blue-50'
  }
}

function getSeverityTextClass(severity: string): string {
  switch (severity) {
    case 'error': return 'text-red-600'
    case 'warning': return 'text-yellow-600'
    default: return 'text-blue-600'
  }
}

function getRiskSeverityClass(severity: string): string {
  switch (severity) {
    case 'high': return 'bg-red-100 text-red-700'
    case 'medium': return 'bg-yellow-100 text-yellow-700'
    default: return 'bg-blue-100 text-blue-700'
  }
}

function getRiskCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    performance: '性能',
    data_precision: '数据精度',
    charset: '字符集',
    identifier: '标识符',
    reserved_word: '保留字',
    transaction: '事务',
    partition: '分区',
    other: '其他'
  }
  return map[category] || category
}
</script>

<template>
  <div class="space-y-4">
    <!-- 语法问题 -->
    <div v-if="syntaxIssues.length > 0" class="border rounded-lg overflow-hidden">
      <div class="px-4 py-2 bg-gray-50 border-b font-medium text-gray-700">
        语法问题 ({{ syntaxIssues.length }})
      </div>
      <div class="divide-y">
        <div
          v-for="(issue, index) in syntaxIssues"
          :key="index"
          :class="['px-4 py-3', getSeverityClass(issue.severity)]"
        >
          <div class="flex items-start gap-2">
            <span class="text-base">{{ getSeverityIcon(issue.severity) }}</span>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span
                  v-if="issue.line > 0"
                  class="inline-block px-1.5 py-0.5 text-xs font-mono bg-white rounded"
                >
                  L{{ issue.line }}
                </span>
                <span :class="['text-sm font-medium', getSeverityTextClass(issue.severity)]">
                  {{ issue.severity === 'error' ? '错误' : issue.severity === 'warning' ? '警告' : '提示' }}
                </span>
              </div>
              <p class="text-sm text-gray-700 mt-1">{{ issue.message }}</p>
              <p v-if="issue.fix" class="text-sm text-gray-600 mt-1">
                <span class="text-gray-400">修复：</span>{{ issue.fix }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 语义问题 -->
    <div v-if="semanticIssues.length > 0" class="border rounded-lg overflow-hidden">
      <div class="px-4 py-2 bg-gray-50 border-b font-medium text-gray-700">
        语义问题 ({{ semanticIssues.length }})
      </div>
      <div class="divide-y">
        <div
          v-for="(issue, index) in semanticIssues"
          :key="index"
          :class="['px-4 py-3', getSeverityClass(issue.severity)]"
        >
          <div class="flex items-start gap-2">
            <span class="text-base">{{ getSeverityIcon(issue.severity) }}</span>
            <div class="flex-1">
              <span :class="['text-sm font-medium', getSeverityTextClass(issue.severity)]">
                {{ issue.severity === 'error' ? '错误' : issue.severity === 'warning' ? '警告' : '提示' }}
              </span>
              <p class="text-sm text-gray-700 mt-1">{{ issue.message }}</p>
              <div v-if="issue.original || issue.converted" class="mt-2 text-xs font-mono">
                <p v-if="issue.original" class="text-red-600">
                  <span class="text-gray-400">原始：</span>{{ issue.original }}
                </p>
                <p v-if="issue.converted" class="text-green-600">
                  <span class="text-gray-400">转换后：</span>{{ issue.converted }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 业务逻辑风险 -->
    <div v-if="logicRisks.length > 0" class="border rounded-lg overflow-hidden">
      <div class="px-4 py-2 bg-gray-50 border-b font-medium text-gray-700">
        业务逻辑风险 ({{ logicRisks.length }})
      </div>
      <div class="divide-y">
        <div
          v-for="(risk, index) in logicRisks"
          :key="index"
          class="px-4 py-3 bg-orange-50 border-b border-orange-100 last:border-b-0"
        >
          <div class="flex items-start gap-2">
            <span class="text-base">⚡</span>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span
                  :class="['inline-block px-1.5 py-0.5 text-xs font-medium rounded', getRiskSeverityClass(risk.severity)]"
                >
                  {{ getRiskCategoryLabel(risk.category) }}
                </span>
                <span
                  :class="['inline-block px-1.5 py-0.5 text-xs font-medium rounded', getRiskSeverityClass(risk.severity)]"
                >
                  {{ risk.severity === 'high' ? '高' : risk.severity === 'medium' ? '中' : '低' }}风险
                </span>
              </div>
              <p class="text-sm text-gray-700 mt-1">{{ risk.message }}</p>
              <p v-if="risk.impact" class="text-sm text-orange-700 mt-1 font-medium">
                <span class="text-orange-400">影响：</span>{{ risk.impact }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="syntaxIssues.length === 0 && semanticIssues.length === 0 && logicRisks.length === 0"
      class="text-center py-8 text-gray-500"
    >
      <p class="text-lg mb-1">🎉</p>
      <p>未发现问题，转换质量优秀！</p>
    </div>
  </div>
</template>
