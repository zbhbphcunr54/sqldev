<script setup lang="ts">
import { computed, ref } from 'vue'
import { submitFeedback, type FeedbackRequest } from '@/api/feedback'

const props = withDefaults(
  defineProps<{
    source?: FeedbackRequest['source']
  }>(),
  {
    source: 'workbench'
  }
)

const open = ref(false)
const category = ref<FeedbackRequest['category']>('feature')
const content = ref('')
const loading = ref(false)
const status = ref<{ type: 'idle' | 'success' | 'error'; text: string }>({ type: 'idle', text: '' })

const canSubmit = computed(() => content.value.trim().length >= 6)

async function handleSubmit() {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  status.value = { type: 'idle', text: '' }
  try {
    await submitFeedback({
      category: category.value,
      content: content.value.trim(),
      source: props.source
    })
    content.value = ''
    status.value = { type: 'success', text: '建议已提交，感谢你的反馈。' }
  } catch {
    status.value = { type: 'error', text: '提交失败，请稍后重试。' }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <aside class="fixed bottom-6 right-6 z-50">
    <button
      class="group flex h-12 items-center rounded-control border border-border bg-panel px-3 shadow-panel transition-all hover:bg-panel2"
      :aria-expanded="open"
      aria-label="打开建议反馈面板"
      @click="open = !open"
    >
      <span class="mr-2 h-2 w-2 rounded-full bg-brand-500"></span>
      <span class="text-sm font-medium text-text">提建议</span>
    </button>

    <div
      v-if="open"
      class="mt-3 w-[320px] rounded-card border border-border bg-panel p-4 shadow-soft"
    >
      <h3 class="text-sm font-semibold text-text">产品建议</h3>
      <p class="mt-1 text-xs text-subtle">欢迎反馈 Bug、体验问题或优化想法。</p>

      <label class="mt-3 block text-xs text-subtle" for="feedback-category">分类</label>
      <select id="feedback-category" v-model="category" class="input-control mt-1 w-full">
        <option value="bug">Bug 问题</option>
        <option value="feature">功能建议</option>
        <option value="ux">界面体验</option>
        <option value="performance">性能速度</option>
        <option value="other">其他</option>
      </select>

      <label class="mt-3 block text-xs text-subtle" for="feedback-content">内容</label>
      <textarea
        id="feedback-content"
        v-model="content"
        rows="5"
        class="input-control mt-1 w-full resize-none"
        placeholder="请输入你的建议（至少 6 个字）"
      ></textarea>

      <p
        v-if="status.text"
        class="mt-2 text-xs"
        :class="
          status.type === 'success'
            ? 'text-success'
            : status.type === 'error'
              ? 'text-danger'
              : 'text-subtle'
        "
      >
        {{ status.text }}
      </p>

      <div class="mt-3 flex justify-end gap-2">
        <button class="btn-secondary px-3 py-2 text-sm" @click="open = false">关闭</button>
        <button
          class="btn-primary px-3 py-2 text-sm"
          :disabled="!canSubmit || loading"
          @click="handleSubmit"
        >
          {{ loading ? '提交中...' : '提交建议' }}
        </button>
      </div>
    </div>
  </aside>
</template>
