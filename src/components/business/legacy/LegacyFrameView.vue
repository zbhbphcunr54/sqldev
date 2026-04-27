<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    hashPath: string
  }>(),
  {
    hashPath: '/splash'
  }
)

const frameSrc = computed(() => {
  const hashPath = String(props.hashPath || '/splash')
  const normalized = hashPath.startsWith('/') ? hashPath : `/${hashPath}`
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}legacy.html#${normalized}`
})
</script>

<template>
  <section class="legacy-frame-page">
    <iframe
      class="legacy-frame"
      :src="frameSrc"
      title="SQLDev Legacy Workbench"
      loading="eager"
      referrerpolicy="no-referrer"
      allow="clipboard-read; clipboard-write"
    />
  </section>
</template>

<style scoped>
.legacy-frame-page {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0b1020;
}

.legacy-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
</style>
