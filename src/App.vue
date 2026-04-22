<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import WorkbenchSidebar from '@/components/WorkbenchSidebar.vue'
import FeedbackWidget from '@/components/FeedbackWidget.vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const authStore = useAuthStore()
useAppStore()

const isWorkbenchArea = computed(() => route.path.startsWith('/workbench'))
const feedbackSource = computed<'splash' | 'workbench' | 'ziwei'>(() => {
  if (route.path.startsWith('/workbench/ziwei')) return 'ziwei'
  if (route.path.startsWith('/workbench')) return 'workbench'
  return 'splash'
})

onMounted(async () => {
  await authStore.initAuth()
})
</script>

<template>
  <div class="min-h-screen bg-bg text-text">
    <AppHeader />
    <main class="mx-auto w-full max-w-[1280px] px-4 py-4">
      <div v-if="isWorkbenchArea" class="flex flex-col gap-4 md:flex-row">
        <WorkbenchSidebar />
        <section class="min-w-0 flex-1">
          <RouterView />
        </section>
      </div>
      <RouterView v-else />
    </main>
    <FeedbackWidget :source="feedbackSource" />
  </div>
</template>
