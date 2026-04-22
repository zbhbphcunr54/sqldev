<script setup lang="ts">
import type { BirthForm } from '@/composables/useZiweiTool'

const modelValue = defineModel<BirthForm>({
  required: true
})

const props = defineProps<{
  canGenerate: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  generate: []
}>()

function onGenerate() {
  emit('generate')
}
</script>

<template>
  <aside class="rounded-card border border-border bg-panel p-4">
    <h1 class="text-base font-semibold">紫微斗数命盘</h1>
    <p class="mt-1 text-xs text-subtle">输入出生信息后，先排盘，再执行 AI 解读。</p>

    <form class="mt-4 space-y-3" @submit.prevent>
      <div>
        <label class="block text-xs text-subtle" for="case-name">命例名称（可选）</label>
        <input
          id="case-name"
          v-model="modelValue.name"
          class="input-control mt-1 w-full"
          placeholder="例如：张明远 1990-06-15 寅时"
        />
      </div>
      <div>
        <label class="block text-xs text-subtle" for="birth-date">出生日期</label>
        <input id="birth-date" v-model="modelValue.date" type="date" class="input-control mt-1 w-full" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs text-subtle" for="birth-hour">出生小时</label>
          <input
            id="birth-hour"
            v-model.number="modelValue.hour"
            type="number"
            min="0"
            max="23"
            class="input-control mt-1 w-full"
          />
        </div>
        <div>
          <label class="block text-xs text-subtle" for="birth-minute">出生分钟</label>
          <input
            id="birth-minute"
            v-model.number="modelValue.minute"
            type="number"
            min="0"
            max="59"
            class="input-control mt-1 w-full"
          />
        </div>
      </div>
      <div>
        <p class="text-xs text-subtle">性别</p>
        <div class="mt-1 flex gap-3 text-sm">
          <label><input v-model="modelValue.gender" type="radio" value="male" /> 男</label>
          <label><input v-model="modelValue.gender" type="radio" value="female" /> 女</label>
        </div>
      </div>
      <button class="btn-primary w-full py-2.5 text-sm" :disabled="props.loading || !props.canGenerate" @click="onGenerate">
        {{ props.loading ? '排盘中...' : '排盘' }}
      </button>
    </form>
  </aside>
</template>
