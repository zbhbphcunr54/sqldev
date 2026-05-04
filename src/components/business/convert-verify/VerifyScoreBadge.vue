<script setup lang="ts">
defineProps<{
  score: number
  summary?: string
}>()

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600 bg-green-50 border-green-200'
  if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  if (score >= 50) return 'text-orange-600 bg-orange-50 border-orange-200'
  return 'text-red-600 bg-red-50 border-red-200'
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
    <div
      :class="[
        'inline-flex items-center justify-center w-16 h-16 rounded-lg border-2 font-bold text-xl',
        getScoreColor(score)
      ]"
    >
      {{ score }}
    </div>
    <div class="flex flex-col">
      <span class="text-sm font-medium text-gray-700">{{ getScoreLabel(score) }}</span>
      <span v-if="summary" class="text-sm text-gray-500 max-w-md">{{ summary }}</span>
    </div>
  </div>
</template>
