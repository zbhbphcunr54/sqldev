<script setup lang="ts">
const props = defineProps<{
  type: 'loading' | 'empty' | 'error' | 'success'
  title: string
  description: string
}>()

const iconMap: Record<string, string> = {
  loading: '⏳',
  empty: '🧭',
  error: '⚠️',
  success: '✅'
}
</script>

<template>
  <section class="rounded-card border border-border bg-panel2 p-5">
    <p class="text-lg">{{ iconMap[props.type] }}</p>
    <h3 class="mt-2 text-sm font-semibold text-text">{{ props.title }}</h3>
    <p class="mt-1 text-sm text-subtle">{{ props.description }}</p>
    <slot />
  </section>
</template>
