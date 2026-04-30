<script setup lang="ts">
import { WORKBENCH_SECTION_NAV_ITEMS } from '@/features/navigation/workbench-sections'
</script>

<template>
  <aside
    class="w-full rounded-card border border-border bg-panel p-2 md:w-14 md:transition-[width] md:hover:w-48"
  >
    <nav class="flex flex-row gap-2 md:flex-col">
      <RouterLink
        v-for="item in WORKBENCH_SECTION_NAV_ITEMS"
        :key="item.to"
        :to="item.to"
        class="group flex min-h-10 flex-1 items-center gap-2 rounded-control px-2 text-sm text-subtle transition-colors hover:bg-panel2 hover:text-text md:flex-none"
        exact-active-class="bg-panel2 text-text"
      >
        <span class="inline-block h-6 min-w-6 text-center text-[10px] font-bold leading-6">
          {{ item.icon }}
        </span>
        <span class="hidden whitespace-nowrap md:group-hover:block">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>
