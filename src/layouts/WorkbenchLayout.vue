<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import FeedbackWidget from '@/components/business/feedback/FeedbackWidget.vue'
import FloatingChat from '@/components/business/ai/FloatingChat.vue'

const route = useRoute()

const feedbackSource = computed<'splash' | 'workbench' | 'ziwei'>(() => {
  if (route.path.startsWith('/workbench/ziwei')) return 'ziwei'
  return 'workbench'
})
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page-soft" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <FeedbackWidget :source="feedbackSource" />
  <FloatingChat />
</template>
