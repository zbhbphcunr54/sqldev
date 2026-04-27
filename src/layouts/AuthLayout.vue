<script setup lang="ts">
import AppHeader from '@/components/layout/AppHeader.vue'
</script>

<template>
  <div class="min-h-screen bg-bg text-text">
    <AppHeader />
    <main class="mx-auto w-full max-w-[1280px] px-4 py-4">
      <RouterView />
    </main>
  </div>
</template>
