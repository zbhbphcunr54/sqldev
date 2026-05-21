import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { ZiweiChart } from '@/features/ziwei/compute'
import {
  type ZiweiAnalysisResult,
  requestZiweiAnalysisStream,
  requestZiweiQaStream
} from '@/api/ziwei-analysis'
import { ApiError } from '@/api/http'
import { mapZiweiAiErrorMessage } from '@/features/ziwei/ai-utils'
import { UI_LABELS } from '@/features/ziwei/ui-constants'
import { mapErrorCodeToMessage } from '@/utils/error-map'

export function useZiweiAI(
  chart: Ref<ZiweiChart | null>,
  profileName: Ref<string>,
  gender: Ref<string>,
  school: Ref<string>
) {
  const aiLoading = ref(false)
  const aiError = ref('')
  const aiAnalysisReady = ref(false)
  const aiStreamingText = ref('')
  const aiResult = ref<ZiweiAnalysisResult | null>(null)

  const aiQuestionInput = ref('')
  const aiQuestionLoading = ref(false)
  const aiQuestionAnswer = ref('')
  const aiQuestionError = ref('')
  const lastAiQuestion = ref('')
  const aiQuestionStreaming = ref(false)

  let pendingStreamDelta = ''
  let pendingPartialAnalysis: ZiweiAnalysisResult | null = null
  let pendingQuestionDelta = ''
  let streamFrameId: number | null = null
  let partialFrameId: number | null = null
  let questionFrameId: number | null = null
  let analysisRunId = 0
  let questionRunId = 0
  let lastChartGeneratedAt = chart.value?.generatedAt ?? null

  function flushStreamingText(): void {
    if (pendingStreamDelta) {
      aiStreamingText.value += pendingStreamDelta
      pendingStreamDelta = ''
    }
    streamFrameId = null
  }

  function queueStreamingText(text: string): void {
    if (!text) return
    pendingStreamDelta += text
    if (streamFrameId !== null) return
    streamFrameId = window.requestAnimationFrame(flushStreamingText)
  }

  function flushPartialAnalysis(): void {
    if (pendingPartialAnalysis) {
      aiResult.value = pendingPartialAnalysis
      pendingPartialAnalysis = null
    }
    partialFrameId = null
  }

  function queuePartialAnalysis(analysis: ZiweiAnalysisResult): void {
    pendingPartialAnalysis = analysis
    if (partialFrameId !== null) return
    partialFrameId = window.requestAnimationFrame(flushPartialAnalysis)
  }

  function flushQuestionText(): void {
    if (pendingQuestionDelta) {
      aiQuestionAnswer.value += pendingQuestionDelta
      pendingQuestionDelta = ''
    }
    questionFrameId = null
  }

  function queueQuestionText(text: string): void {
    if (!text) return
    pendingQuestionDelta += text
    if (questionFrameId !== null) return
    questionFrameId = window.requestAnimationFrame(flushQuestionText)
  }

  function cancelPendingFrames(): void {
    if (streamFrameId !== null) {
      window.cancelAnimationFrame(streamFrameId)
      streamFrameId = null
    }
    if (partialFrameId !== null) {
      window.cancelAnimationFrame(partialFrameId)
      partialFrameId = null
    }
    if (questionFrameId !== null) {
      window.cancelAnimationFrame(questionFrameId)
      questionFrameId = null
    }
  }

  function clearAiState(): void {
    analysisRunId += 1
    questionRunId += 1
    cancelPendingFrames()
    pendingStreamDelta = ''
    pendingPartialAnalysis = null
    pendingQuestionDelta = ''
    aiLoading.value = false
    aiError.value = ''
    aiAnalysisReady.value = false
    aiStreamingText.value = ''
    aiResult.value = null
    aiQuestionInput.value = ''
    aiQuestionLoading.value = false
    aiQuestionStreaming.value = false
    aiQuestionAnswer.value = ''
    aiQuestionError.value = ''
    lastAiQuestion.value = ''
  }

  watch(
    () => chart.value?.generatedAt ?? null,
    (generatedAt) => {
      if (generatedAt === null) {
        lastChartGeneratedAt = null
        clearAiState()
        return
      }

      if (lastChartGeneratedAt !== null && generatedAt !== lastChartGeneratedAt) {
        clearAiState()
      }

      lastChartGeneratedAt = generatedAt
    },
    { flush: 'sync' }
  )

  onBeforeUnmount(() => {
    cancelPendingFrames()
    if (pendingStreamDelta) flushStreamingText()
    if (pendingPartialAnalysis) flushPartialAnalysis()
    if (pendingQuestionDelta) flushQuestionText()
  })

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

  const canAskAiQuestions = computed(() => Boolean(chart.value))

  async function handleAiAnalysis(): Promise<void> {
    if (!chart.value) return

    const currentRunId = ++analysisRunId
    questionRunId += 1
    cancelPendingFrames()
    pendingStreamDelta = ''
    pendingPartialAnalysis = null
    pendingQuestionDelta = ''

    aiLoading.value = true
    aiError.value = ''
    aiAnalysisReady.value = false
    aiStreamingText.value = ''
    aiResult.value = null
    aiQuestionAnswer.value = ''
    aiQuestionError.value = ''
    aiQuestionLoading.value = false
    aiQuestionStreaming.value = false
    lastAiQuestion.value = ''

    try {
      const result = await requestZiweiAnalysisStream(
        {
          chart: chart.value,
          profileName: profileName.value,
          gender: gender.value,
          school: school.value
        },
        {
          onPartial: (analysis) => {
            if (currentRunId !== analysisRunId) return
            queuePartialAnalysis(analysis)
          },
          onDelta: (text) => {
            if (currentRunId !== analysisRunId) return
            queueStreamingText(text)
          }
        }
      )

      if (currentRunId !== analysisRunId) return

      flushStreamingText()
      flushPartialAnalysis()

      if (result.ok && result.data) {
        aiResult.value = result.data
        aiAnalysisReady.value = true
      } else {
        aiError.value = mapZiweiAiErrorMessage(result.error || 'ai_analysis_failed')
      }
    } catch (error) {
      if (currentRunId !== analysisRunId) return

      if (error instanceof ApiError) {
        aiError.value = mapErrorCodeToMessage(error.code)
      } else {
        console.error('[useZiweiAI] analysis failed:', error)
        aiError.value = mapErrorCodeToMessage('unknown_error')
      }
    } finally {
      if (currentRunId === analysisRunId) {
        aiLoading.value = false
      }
    }
  }

  async function handleAiQuestion(): Promise<void> {
    const question = aiQuestionInput.value.trim()
    if (!question || !chart.value) return

    const currentRunId = ++questionRunId
    cancelPendingFrames()
    pendingQuestionDelta = ''

    aiQuestionLoading.value = true
    aiQuestionStreaming.value = true
    aiQuestionError.value = ''
    aiQuestionAnswer.value = ''
    lastAiQuestion.value = question

    try {
      const result = await requestZiweiQaStream(
        {
          chart: chart.value,
          profileName: profileName.value,
          gender: gender.value,
          school: school.value,
          question,
          analysis: aiResult.value
        },
        {
          onDelta: (text) => {
            if (currentRunId !== questionRunId) return
            queueQuestionText(text)
          }
        }
      )

      if (currentRunId !== questionRunId) return

      flushQuestionText()

      if (result.ok && result.answer) {
        aiQuestionAnswer.value = result.answer
      } else {
        aiQuestionError.value = mapZiweiAiErrorMessage(result.error || 'ziwei_qa_failed')
      }
    } catch (error) {
      if (currentRunId !== questionRunId) return

      console.error('[useZiweiAI] question failed:', error)
      if (error instanceof ApiError) {
        aiQuestionError.value = mapErrorCodeToMessage(error.code)
      } else {
        aiQuestionError.value = mapErrorCodeToMessage('ziwei_qa_failed')
      }
    } finally {
      if (currentRunId === questionRunId) {
        aiQuestionStreaming.value = false
        aiQuestionLoading.value = false
      }
    }
  }

  return {
    aiLoading,
    aiError,
    aiAnalysisReady,
    aiStreamingText,
    aiResult,
    aiQuestionInput,
    aiQuestionLoading,
    aiQuestionStreaming,
    aiQuestionAnswer,
    aiQuestionError,
    lastAiQuestion,
    currentStep,
    aiButtonLabel,
    canAskAiQuestions,
    clearAiState,
    handleAiAnalysis,
    handleAiQuestion
  }
}
