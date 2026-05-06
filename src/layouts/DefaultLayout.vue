<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import FeedbackWidget from '@/components/business/feedback/FeedbackWidget.vue'

const route = useRoute()

const feedbackSource = computed<'splash'>(() => 'splash')
</script>

<template>
  <div class="layout-container">
    <AppHeader />
    <main class="layout-main">
      <RouterView v-slot="{ Component, route: viewRoute }">
        <Transition name="page-soft" mode="out-in">
          <component :is="Component" :key="viewRoute.fullPath" />
        </Transition>
      </RouterView>
    </main>
    <FeedbackWidget :source="feedbackSource" />
  </div>
</template>

<style scoped>
.layout-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-bg);
}

.layout-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
