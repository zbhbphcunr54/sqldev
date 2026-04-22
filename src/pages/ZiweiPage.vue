<script setup lang="ts">
import ZiweiFormPanel from '@/components/ziwei/ZiweiFormPanel.vue'
import ZiweiChartPanel from '@/components/ziwei/ZiweiChartPanel.vue'
import ZiweiAiPanel from '@/components/ziwei/ZiweiAiPanel.vue'
import { useZiweiTool } from '@/composables/useZiweiTool'

const {
  form,
  chartText,
  aiResult,
  qaQuestion,
  qaSuggestions,
  loadingChart,
  loadingAi,
  status,
  canGenerate,
  canAskAi,
  generateChart,
  runAiAnalysis,
  askAi
} = useZiweiTool()
</script>

<template>
  <section class="grid gap-4 xl:grid-cols-[320px_1fr_340px]">
    <ZiweiFormPanel v-model="form" :can-generate="canGenerate" :loading="loadingChart" @generate="generateChart" />
    <ZiweiChartPanel v-model="chartText" />
    <ZiweiAiPanel
      v-model:result="aiResult"
      v-model:question="qaQuestion"
      :loading="loadingAi"
      :can-ask="canAskAi"
      :suggestions="qaSuggestions"
      :status="status"
      @analysis="runAiAnalysis"
      @qa="askAi"
    />
  </section>
</template>
