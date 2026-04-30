<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LegacyFrameView from '@/components/business/legacy/LegacyFrameView.vue'
import {
  buildWorkbenchPath,
  normalizeWorkbenchSection
} from '@/features/navigation/workbench-sections'

const route = useRoute()
const router = useRouter()

const hashPath = computed(() => {
  return `/workbench/${normalizeWorkbenchSection(route.params.section)}`
})

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
  <LegacyFrameView :hash-path="hashPath" />
</template>
