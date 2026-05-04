<script setup lang="ts">
import type { Suggestion } from '@/api/convert-verify'

defineProps<{
  suggestions: Suggestion[]
}>()

function getPriorityClass(priority: string): string {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-700 border-red-200'
    case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    default: return 'bg-blue-100 text-blue-700 border-blue-200'
  }
}

function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'high': return '高优先级'
    case 'medium': return '中优先级'
    default: return '低优先级'
  }
}
</script>

<template>
  <div v-if="suggestions.length > 0" class="space-y-3">
    <div
      v-for="(suggestion, index) in suggestions"
      :key="index"
      class="border rounded-lg p-4 bg-white"
    >
      <div class="flex items-center gap-2 mb-2">
        <span
          :class="[
            'inline-block px-2 py-0.5 text-xs font-medium rounded border',
            getPriorityClass(suggestion.priority)
          ]"
        >
          {{ getPriorityLabel(suggestion.priority) }}
        </span>
      </div>
      <pre
        v-if="suggestion.targetSql"
        class="text-sm font-mono bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto whitespace-pre-wrap"
      >{{ suggestion.targetSql }}</pre>
      <p v-if="suggestion.explanation" class="text-sm text-gray-600 mt-2">
        {{ suggestion.explanation }}
      </p>
    </div>
  </div>
  <div
    v-else
    class="text-center py-6 text-gray-500"
  >
    暂无修改建议
  </div>
</template>
