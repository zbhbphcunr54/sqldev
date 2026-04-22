import { computed, onMounted, ref } from 'vue'
import { requestZiweiAnalysis, requestZiweiConfig, requestZiweiQa } from '@/api/ziwei'
import { ApiError } from '@/api/http'
import { mapErrorCodeToMessage } from '@/utils/error-map'

export interface BirthForm {
  name: string
  date: string
  hour: number
  minute: number
  gender: 'male' | 'female'
}

export function useZiweiTool() {
  const form = ref<BirthForm>({
    name: '',
    date: '',
    hour: 12,
    minute: 0,
    gender: 'male'
  })

  const chartText = ref('')
  const aiResult = ref('')
  const qaQuestion = ref('')
  const qaSuggestions = ref<string[]>([])
  const loadingChart = ref(false)
  const loadingAi = ref(false)
  const status = ref<{ type: 'idle' | 'error' | 'success'; text: string }>({ type: 'idle', text: '' })

  const canGenerate = computed(() => !!form.value.date)
  const canAskAi = computed(() => chartText.value.trim().length > 20)

  function buildChartPayload(): Record<string, unknown> {
    return {
      profile: {
        name: form.value.name || '未命名命例',
        birthDate: form.value.date,
        birthTime: `${String(form.value.hour).padStart(2, '0')}:${String(form.value.minute).padStart(2, '0')}`,
        gender: form.value.gender
      },
      chart: {
        mingGong: '命宫',
        shenGong: '身宫',
        majorStars: ['紫微', '天府', '天同'],
        transform: '传统四化'
      }
    }
  }

  async function loadConfig() {
    try {
      const cfg = await requestZiweiConfig({ mode: 'config' })
      qaSuggestions.value = cfg.config?.suggestions || []
    } catch {
      qaSuggestions.value = []
    }
  }

  async function generateChart() {
    if (!canGenerate.value || loadingChart.value) return
    loadingChart.value = true
    status.value = { type: 'idle', text: '' }
    try {
      chartText.value = JSON.stringify(buildChartPayload(), null, 2)
      aiResult.value = ''
      status.value = { type: 'success', text: '命盘生成完成，可点击 AI 深度解读。' }
    } catch {
      status.value = { type: 'error', text: '命盘生成失败，请检查输入。' }
    } finally {
      loadingChart.value = false
    }
  }

  async function runAiAnalysis() {
    if (!canAskAi.value || loadingAi.value) return
    loadingAi.value = true
    status.value = { type: 'idle', text: '' }
    try {
      const response = await requestZiweiAnalysis({
        mode: 'analysis',
        style: 'pro',
        chart: chartText.value
      })
      aiResult.value = JSON.stringify(response.analysis || {}, null, 2)
      status.value = { type: 'success', text: 'AI 解读完成。' }
    } catch (err) {
      if (err instanceof ApiError) {
        status.value = { type: 'error', text: mapErrorCodeToMessage(err.code) }
      } else {
        status.value = { type: 'error', text: 'AI 深度解盘失败，请稍后重试。' }
      }
    } finally {
      loadingAi.value = false
    }
  }

  async function askAi() {
    if (!qaQuestion.value.trim() || !canAskAi.value || loadingAi.value) return
    loadingAi.value = true
    status.value = { type: 'idle', text: '' }
    try {
      const response = await requestZiweiQa({
        mode: 'qa',
        chart: chartText.value,
        question: qaQuestion.value.trim()
      })
      aiResult.value = response.answer || ''
      status.value = { type: 'success', text: '问答完成。' }
    } catch (err) {
      if (err instanceof ApiError) {
        status.value = { type: 'error', text: mapErrorCodeToMessage(err.code) }
      } else {
        status.value = { type: 'error', text: 'AI 问答失败，请稍后重试。' }
      }
    } finally {
      loadingAi.value = false
    }
  }

  onMounted(async () => {
    await loadConfig()
  })

  return {
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
  }
}
