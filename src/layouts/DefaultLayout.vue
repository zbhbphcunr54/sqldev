<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import FeedbackWidget from '@/components/business/feedback/FeedbackWidget.vue'
import WorkbenchSidebar from '@/components/business/workbench/WorkbenchSidebar.vue'

const route = useRoute()

const isWorkbenchArea = computed(() => route.path.startsWith('/workbench'))
const feedbackSource = computed<'splash' | 'workbench' | 'ziwei'>(() => {
  if (route.path.startsWith('/workbench/ziwei')) return 'ziwei'
  if (route.path.startsWith('/workbench')) return 'workbench'
  return 'splash'
})
</script>

<template>
  <div class="min-h-screen bg-bg text-text">
    <AppHeader />
    <main class="mx-auto w-full max-w-[1280px] px-4 py-4">
      <div v-if="isWorkbenchArea" class="flex flex-col gap-4 md:flex-row">
        <WorkbenchSidebar />
        <section class="min-w-0 flex-1">
          <RouterView v-slot="{ Component, route: viewRoute }">
            <Transition name="page-soft" mode="out-in">
              <component :is="Component" :key="viewRoute.fullPath" />
            </Transition>
          </RouterView>
        </section>
      </div>
      <RouterView v-else v-slot="{ Component, route: viewRoute }">
        <Transition name="page-soft" mode="out-in">
          <component :is="Component" :key="viewRoute.fullPath" />
        </Transition>
      </RouterView>
    </main>
    <FeedbackWidget :source="feedbackSource" />
  </div>
</template>
