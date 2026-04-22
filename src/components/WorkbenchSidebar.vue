<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const menus = computed(() => [
  { to: '/workbench', label: 'SQL 翻译', icon: '⇄' },
  { to: '/workbench/ziwei', label: '紫微斗数', icon: '✦' }
])
</script>

<template>
  <aside class="w-full rounded-card border border-border bg-panel p-2 md:w-14 md:hover:w-48 md:transition-[width]">
    <nav class="flex flex-row gap-2 md:flex-col">
      <RouterLink
        v-for="item in menus"
        :key="item.to"
        :to="item.to"
        class="group flex min-h-10 flex-1 items-center gap-2 rounded-control px-2 text-sm text-subtle transition-colors hover:bg-panel2 hover:text-text md:flex-none"
        :class="{ 'bg-panel2 text-text': route.path === item.to }"
      >
        <span class="inline-block h-6 w-6 text-center text-base leading-6">{{ item.icon }}</span>
        <span class="hidden whitespace-nowrap md:group-hover:block">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>
