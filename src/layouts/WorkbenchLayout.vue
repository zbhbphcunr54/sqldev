<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import FeedbackWidget from '@/components/business/feedback/FeedbackWidget.vue'

const route = useRoute()

const feedbackSource = computed<'splash' | 'workbench' | 'ziwei'>(() => {
  if (route.path.startsWith('/workbench/ziwei')) return 'ziwei'
  return 'workbench'
})
</script>

<template>
  <RouterView v-slot="{ Component, route: viewRoute }">
    <Transition name="page-soft" mode="out-in">
      <component :is="Component" :key="viewRoute.fullPath" />
    </Transition>
  </RouterView>
  <FeedbackWidget :source="feedbackSource" />
</template>
