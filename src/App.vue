<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import WorkbenchLayout from '@/layouts/WorkbenchLayout.vue'
import AuthModal from '@/components/business/auth/AuthModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeRuntime } from '@/composables/useThemeRuntime'

const route = useRoute()
const authStore = useAuthStore()
useThemeRuntime()

const layout = computed(() => {
  if (route.meta.fullPage) return 'full'
  return route.meta.layout as string | undefined
})

onMounted(async () => {
  await authStore.initAuth()
})
</script>

<template>
  <WorkbenchLayout v-if="layout === 'workbench'" />
  <AuthLayout v-else-if="layout === 'auth'" />
  <DefaultLayout v-else-if="layout === 'default'" />
  <RouterView v-else />
  <AuthModal />
</template>
