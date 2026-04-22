<script setup lang="ts">
import StatePanel from '@/components/StatePanel.vue'

const aiResult = defineModel<string>('result', { required: true })
const qaQuestion = defineModel<string>('question', { required: true })

const props = defineProps<{
  loading: boolean
  canAsk: boolean
  suggestions: string[]
  status: {
    type: 'idle' | 'error' | 'success'
    text: string
  }
}>()

const emit = defineEmits<{
  analysis: []
  qa: []
}>()
</script>

<template>
  <aside class="rounded-card border border-border bg-panel p-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold">AI 个性化解盘</h2>
      <button class="btn-primary px-3 py-1.5 text-xs" :disabled="props.loading || !props.canAsk" @click="emit('analysis')">
        {{ props.loading ? 'AI思考中' : 'AI深度解读' }}
      </button>
    </div>

    <div class="mt-3">
      <label class="block text-xs text-subtle" for="qa-input">问答</label>
      <div class="mt-1 flex gap-2">
        <input id="qa-input" v-model="qaQuestion" list="qa-suggestions" class="input-control flex-1" placeholder="输入你要追问的问题" />
        <button class="btn-secondary px-3 text-sm" :disabled="props.loading || !qaQuestion.trim()" @click="emit('qa')">
          {{ props.loading ? 'AI思考中' : '发送' }}
        </button>
      </div>
      <datalist id="qa-suggestions">
        <option v-for="item in props.suggestions" :key="item" :value="item" />
      </datalist>
    </div>

    <textarea
      v-model="aiResult"
      rows="18"
      class="input-control mt-3 w-full resize-y font-mono text-xs leading-6"
      readonly
      placeholder="AI 解读结果将在这里展示。"
    ></textarea>

    <StatePanel
      v-if="props.status.type === 'error'"
      type="error"
      title="处理失败"
      :description="props.status.text"
      class="mt-3"
    />
    <StatePanel
      v-else-if="props.status.type === 'success'"
      type="success"
      title="处理完成"
      :description="props.status.text"
      class="mt-3"
    />
    <StatePanel
      v-else
      type="empty"
      title="等待操作"
      description="请先点击排盘，再执行 AI 深度解读或问答。"
      class="mt-3"
    />
  </aside>
</template>
