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

<style>
/* 全局滚动条样式 */
html {
  scrollbar-width: thin;
  scrollbar-color: rgba(99, 135, 241, 0.3) rgba(15, 22, 40, 0.35);
}

html::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

html::-webkit-scrollbar-track {
  background: rgba(15, 22, 40, 0.35);
}

html::-webkit-scrollbar-thumb {
  background: rgba(99, 135, 241, 0.3);
  border-radius: 4px;
}

html::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 135, 241, 0.5);
}

[data-theme='dark'] html {
  scrollbar-color: rgba(137, 180, 250, 0.3) rgba(30, 30, 46, 0.35);
}

[data-theme='dark'] html::-webkit-scrollbar-thumb {
  background: rgba(137, 180, 250, 0.3);
}

[data-theme='dark'] html::-webkit-scrollbar-thumb:hover {
  background: rgba(137, 180, 250, 0.5);
}
</style>
