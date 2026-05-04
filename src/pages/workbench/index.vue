<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WorkbenchApp from '@/components/business/workbench/WorkbenchApp.vue'
import {
  buildWorkbenchPath,
  normalizeWorkbenchSection
} from '@/features/navigation/workbench-sections'

const route = useRoute()
const router = useRouter()

watch(
  () => route.params.section,
  (section) => {
    const rawSection = Array.isArray(section) ? section[0] : section
    const normalized = normalizeWorkbenchSection(section)
    if (rawSection !== normalized) {
      void router.replace(buildWorkbenchPath(normalized))
    }
  },
  { immediate: true }
)
</script>

<template>
  <WorkbenchApp />
</template>
