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

const isZiweiPage = computed(() => route.path.startsWith('/workbench/ziwei'))
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page-soft" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <FeedbackWidget :source="feedbackSource" />
  <FloatingChat :class="{ 'lg:block hidden': isZiweiPage }" />
</template>
