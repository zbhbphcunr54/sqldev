<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { sanitizeInternalRedirectPath } from '@/features/navigation/redirect'
import { useAuth } from '@/composables/useAuth'
import { useAuthModal } from '@/composables/useAuthModal'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const authModal = useAuthModal()

onMounted(async () => {
  await auth.initAuth()
  const redirectTo = sanitizeInternalRedirectPath(route.query.redirect)
  authModal.openModal({ redirectTo })
  await router.replace('/')
})
</script>

<template>
  <section class="sr-only" aria-live="polite">正在打开登录弹窗...</section>
</template>
