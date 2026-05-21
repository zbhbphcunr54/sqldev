<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WorkbenchApp from '@/components/business/workbench/WorkbenchApp.vue'
import { useAuth } from '@/composables/useAuth'
import {
  buildWorkbenchPath,
  normalizeWorkbenchSection
} from '@/features/navigation/workbench-sections'

const route = useRoute()
const router = useRouter()
const auth = useAuth()

function isZiweiShareMode(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('ziwei_share') === '1'
}

watch(
  () => [route.params.section, auth.canAccessZiweiTool.value] as const,
  ([section, canAccessZiweiTool]) => {
    if (isZiweiShareMode()) return
    const rawSection = Array.isArray(section) ? section[0] : section
    const normalized = normalizeWorkbenchSection(section, { canAccessZiweiTool })
    if (rawSection !== normalized) {
      void router.replace(buildWorkbenchPath(normalized, { canAccessZiweiTool }))
    }
  },
  { immediate: true }
)
</script>

<template>
  <WorkbenchApp />
</template>
