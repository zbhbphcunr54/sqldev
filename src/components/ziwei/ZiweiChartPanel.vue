<script setup lang="ts">
const chartText = defineModel<string>({
  required: true
})
</script>

<template>
  <section class="rounded-card border border-border bg-panel p-4">
    <h2 class="text-sm font-semibold">图片命盘（结构化数据）</h2>
    <textarea
      v-model="chartText"
      rows="22"
      class="input-control mt-3 w-full resize-y font-mono text-xs leading-6"
      readonly
      placeholder="点击左侧“排盘”后，这里会生成结构化命盘数据。"
    ></textarea>
  </section>
</template>
