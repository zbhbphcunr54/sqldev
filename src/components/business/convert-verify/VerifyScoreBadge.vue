<script setup lang="ts">
defineProps<{
  score: number
  summary?: string
}>()

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-success bg-successBg border-success'
  if (score >= 70) return 'text-warning bg-warningBg border-warning'
  if (score >= 50) return 'text-accent bg-accentBg border-accent'
  return 'text-danger bg-dangerBg border-danger'
}

function getScoreLabel(score: number): string {
  if (score >= 90) return '优秀'
  if (score >= 70) return '良好'
  if (score >= 50) return '一般'
  return '需改进'
}
</script>

<template>
  <div class="flex items-center gap-3">
    <div :class="['inline-flex items-center justify-center w-16 h-16 rounded-lg border-2 font-bold text-xl', getScoreColor(score)]">
      {{ score }}
    </div>
    <div class="flex flex-col">
      <span class="text-sm font-medium text-text">{{ getScoreLabel(score) }}</span>
      <span v-if="summary" class="text-sm text-subtle max-w-md">{{ summary }}</span>
    </div>
  </div>
</template>
