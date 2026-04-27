<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const authStore = useAuthStore()
useAppStore()

const isLegacyFramePage = computed(() => route.meta.legacyFrame === true)
const isAuthLayout = computed(() => route.meta.layout === 'auth')

onMounted(async () => {
  await authStore.initAuth()
})
</script>

<template>
  <RouterView v-if="isLegacyFramePage" />
  <AuthLayout v-else-if="isAuthLayout" />
  <DefaultLayout v-else />
</template>
