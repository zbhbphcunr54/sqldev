import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { ZiweiChart } from '@/features/ziwei/compute'
import { requestZiweiAnalysis } from '@/api/ziwei-analysis'
import { mapErrorCodeToMessage } from '@/utils/error-map'
import { mapZiweiAiErrorMessage } from '@/features/ziwei/ai-utils'
import { ApiError } from '@/api/http'
import { UI_LABELS } from '@/features/ziwei/ui-constants'

export function useZiweiAI(
  chart: Ref<ZiweiChart | null>,
  profileName: Ref<string>,
  gender: Ref<string>,
  school: Ref<string>
) {
  const aiLoading = ref(false)
  const aiError = ref('')
  const aiResult = ref<{
    overview: string
    sections: Array<{ title: string; summary: string }>
  } | null>(null)

  const aiQuestionInput = ref('')
  const aiQuestionLoading = ref(false)
  const aiQuestionAnswer = ref('')
  const aiQuestionError = ref('')

  const currentStep = computed(() => {
    if (!chart.value) return 1
    if (!aiResult.value) return 2
    return 3
  })

  const aiButtonLabel = computed(() => {
    if (aiLoading.value) return UI_LABELS.BTN_AI_LOADING
    if (aiResult.value) return UI_LABELS.BTN_AI_RETRY
    return UI_LABELS.BTN_AI_INITIAL
  })

  async function handleAiAnalysis(): Promise<void> {
    if (!chart.value) return

    aiLoading.value = true
    aiError.value = ''

    try {
      const result = await requestZiweiAnalysis({
        chart: chart.value,
        profileName: profileName.value,
        gender: gender.value,
        school: school.value
      })

      if (result.ok && result.data) {
        aiResult.value = result.data
      } else {
        aiError.value = mapZiweiAiErrorMessage(result.error || 'ai_analysis_failed')
      }
    } catch (err) {
      if (err instanceof ApiError) {
        aiError.value = mapErrorCodeToMessage(err.code)
      } else {
        console.error('[useZiweiAI] analysis failed:', err)
        aiError.value = mapErrorCodeToMessage('unknown_error')
      }
    } finally {
      aiLoading.value = false
    }
  }

  async function handleAiQuestion(): Promise<void> {
    if (!aiQuestionInput.value.trim() || !aiResult.value) return

    aiQuestionLoading.value = true
    aiQuestionError.value = ''

    try {
      aiQuestionAnswer.value = UI_LABELS.HINT_AI_QA_DEVELOPING
    } catch (err) {
      console.error('[useZiweiAI] question failed:', err)
      aiQuestionError.value = mapErrorCodeToMessage('ziwei_qa_failed')
    } finally {
      aiQuestionLoading.value = false
    }
  }

  return {
    aiLoading,
    aiError,
    aiResult,
    aiQuestionInput,
    aiQuestionLoading,
    aiQuestionAnswer,
    aiQuestionError,
    currentStep,
    aiButtonLabel,
    handleAiAnalysis,
    handleAiQuestion
  }
}
