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
    case 'error': return 'border-danger text-danger'
    case 'warning': return 'border-warning text-warning'
    default: return 'border-brand-200 text-brand-600'
  }
}

function getSeverityBgClass(severity: string): string {
  switch (severity) {
    case 'error': return 'bg-dangerBg'
    case 'warning': return 'bg-warningBg'
    default: return 'bg-accentBg'
  }
}

function getRiskSeverityClass(severity: string): string {
  switch (severity) {
    case 'high': return 'bg-dangerBg text-danger'
    case 'medium': return 'bg-warningBg text-warning'
    default: return 'bg-accentBg text-accent'
  }
}

function getRiskCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    performance: '性能', data_precision: '数据精度', charset: '字符集',
    identifier: '标识符', reserved_word: '保留字', transaction: '事务',
    partition: '分区', other: '其他'
  }
  return map[category] || category
}
</script>

<template>
  <div class="space-y-4">
    <!-- 语法问题 -->
    <div v-if="syntaxIssues.length > 0" class="border border-border rounded-lg overflow-hidden">
      <div class="px-4 py-2 bg-panel2 border-b border-border font-medium text-text">
        语法问题 ({{ syntaxIssues.length }})
      </div>
      <div class="divide-y divide-border">
        <div v-for="(issue, index) in syntaxIssues" :key="index" :class="['px-4 py-3', getSeverityBgClass(issue.severity)]">
          <div class="flex items-start gap-2">
            <span class="text-base">{{ getSeverityIcon(issue.severity) }}</span>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span v-if="issue.line > 0" class="inline-block px-1.5 py-0.5 text-xs font-mono bg-panel rounded">L{{ issue.line }}</span>
                <span :class="['text-sm font-medium', getSeverityClass(issue.severity)]">
                  {{ issue.severity === 'error' ? '错误' : issue.severity === 'warning' ? '警告' : '提示' }}
                </span>
              </div>
              <p class="text-sm text-text mt-1">{{ issue.message }}</p>
              <p v-if="issue.fix" class="text-sm text-subtle mt-1"><span class="text-muted">修复：</span>{{ issue.fix }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 语义问题 -->
    <div v-if="semanticIssues.length > 0" class="border border-border rounded-lg overflow-hidden">
      <div class="px-4 py-2 bg-panel2 border-b border-border font-medium text-text">
        语义问题 ({{ semanticIssues.length }})
      </div>
      <div class="divide-y divide-border">
        <div v-for="(issue, index) in semanticIssues" :key="index" :class="['px-4 py-3', getSeverityBgClass(issue.severity)]">
          <div class="flex items-start gap-2">
            <span class="text-base">{{ getSeverityIcon(issue.severity) }}</span>
            <div class="flex-1">
              <span :class="['text-sm font-medium', getSeverityClass(issue.severity)]">
                {{ issue.severity === 'error' ? '错误' : issue.severity === 'warning' ? '警告' : '提示' }}
              </span>
              <p class="text-sm text-text mt-1">{{ issue.message }}</p>
              <div v-if="issue.original || issue.converted" class="mt-2 text-xs font-mono">
                <p v-if="issue.original" class="text-danger"><span class="text-muted">原始：</span>{{ issue.original }}</p>
                <p v-if="issue.converted" class="text-success"><span class="text-muted">转换后：</span>{{ issue.converted }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 业务逻辑风险 -->
    <div v-if="logicRisks.length > 0" class="border border-border rounded-lg overflow-hidden">
      <div class="px-4 py-2 bg-panel2 border-b border-border font-medium text-text">
        业务逻辑风险 ({{ logicRisks.length }})
      </div>
      <div class="divide-y divide-border">
        <div v-for="(risk, index) in logicRisks" :key="index" class="px-4 py-3 bg-warningBg border-b border-border last:border-b-0">
          <div class="flex items-start gap-2">
            <span class="text-base">⚡</span>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span :class="['inline-block px-1.5 py-0.5 text-xs font-medium rounded', getRiskSeverityClass(risk.severity)]">
                  {{ getRiskCategoryLabel(risk.category) }}
                </span>
                <span :class="['inline-block px-1.5 py-0.5 text-xs font-medium rounded', getRiskSeverityClass(risk.severity)]">
                  {{ risk.severity === 'high' ? '高' : risk.severity === 'medium' ? '中' : '低' }}风险
                </span>
              </div>
              <p class="text-sm text-text mt-1">{{ risk.message }}</p>
              <p v-if="risk.impact" class="text-sm text-warning mt-1 font-medium">
                <span class="text-muted">影响：</span>{{ risk.impact }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="syntaxIssues.length === 0 && semanticIssues.length === 0 && logicRisks.length === 0" class="text-center py-8 text-subtle">
      <p class="text-lg mb-1">🎉</p>
      <p>未发现问题，转换质量优秀！</p>
    </div>
  </div>
</template>
