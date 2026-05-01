<!-- [2026-04-30] 新增：AI 配置列表表格 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { AiProviderConfig, ConfigStatus } from '@/features/ai'
import { MAX_CONFIGS_GLOBAL } from '@/features/ai'

const props = defineProps<{
  configs: AiProviderConfig[]
  isAdmin: boolean
}>()

const emit = defineEmits<{
  edit: [config: AiProviderConfig]
  activate: [config: AiProviderConfig]
  remove: [config: AiProviderConfig]
  create: []
}>()

// [2026-04-30] derive display status from config fields
function getStatus(config: AiProviderConfig): ConfigStatus {
  if (config.is_active) return 'active'
  if (config.last_test_ok === true) return 'tested_ok'
  if (config.last_test_ok === false) return 'tested_fail'
  return 'untested'
}

function statusLabel(status: ConfigStatus): string {
  const labels: Record<ConfigStatus, string> = {
    active: '活跃',
    tested_ok: '已测试',
    tested_fail: '测试失败',
    untested: '未测试'
  }
  return labels[status]
}

function statusDotClass(status: ConfigStatus): string {
  const map: Record<ConfigStatus, string> = {
    active: 'bg-success',
    tested_ok: 'bg-success',
    tested_fail: 'bg-danger',
    untested: 'bg-gray-400'
  }
  return map[status]
}

const canCreate = computed(() => props.isAdmin && props.configs.length < MAX_CONFIGS_GLOBAL)

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  const d = new Date(iso)
  return (
    d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  )
}
</script>

<template>
  <!-- Section header -->
  <div class="flex items-center justify-between mt-8 mb-4">
    <h2 class="text-[15px] font-semibold">已保存配置</h2>
    <button v-if="canCreate" class="btn-primary px-3 py-1.5 text-[13px]" @click="emit('create')">
      + 新增配置
    </button>
  </div>

  <!-- Table -->
  <div class="bg-panel rounded-card border border-border shadow-panel overflow-hidden">
    <!-- Header row -->
    <div
      class="grid items-center px-4 py-3 border-b border-border text-[12px] font-medium text-subtle uppercase tracking-wide"
      style="grid-template-columns: 1fr 120px 140px 140px 90px 100px 120px"
    >
      <span>配置名称</span>
      <span>供应商</span>
      <span>模型</span>
      <span>API Key</span>
      <span>状态</span>
      <span>最后测试</span>
      <span class="text-right">操作</span>
    </div>

    <!-- Data rows -->
    <div
      v-for="config in configs"
      :key="config.id"
      class="grid items-center px-4 py-3 border-b border-border hover:bg-panel2 transition text-[13px]"
      style="grid-template-columns: 1fr 120px 140px 140px 90px 100px 120px"
    >
      <!-- Name -->
      <span class="font-medium truncate">{{ config.name }}</span>

      <!-- Provider -->
      <span class="text-subtle truncate">{{ config.provider?.label ?? '--' }}</span>

      <!-- Model -->
      <span class="font-mono text-[12px] text-subtle truncate">{{ config.model }}</span>

      <!-- API Key masked -->
      <span class="font-mono text-[12px] text-subtle">{{ config.api_key_masked }}</span>

      <!-- Status -->
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full" :class="statusDotClass(getStatus(config))"></span>
        <span
          v-if="getStatus(config) === 'active'"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium text-success border border-border bg-panel2"
        >
          {{ statusLabel(getStatus(config)) }}
        </span>
        <span v-else class="text-[12px] text-subtle">{{ statusLabel(getStatus(config)) }}</span>
      </div>

      <!-- Last test -->
      <span class="text-[12px] text-subtle">{{ formatDate(config.last_test_at) }}</span>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-2">
        <template v-if="isAdmin">
          <button
            class="text-[12px] text-brand-500 font-medium hover:underline"
            @click="emit('edit', config)"
          >
            编辑
          </button>
          <button
            v-if="!config.is_active"
            class="text-[12px] text-subtle hover:text-success"
            @click="emit('activate', config)"
          >
            激活
          </button>
          <button class="text-[12px] text-subtle hover:text-danger" @click="emit('remove', config)">
            删除
          </button>
        </template>
        <template v-else>
          <button
            class="text-[12px] text-brand-500 font-medium hover:underline"
            @click="emit('edit', config)"
          >
            查看
          </button>
        </template>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="configs.length === 0" class="px-4 py-10 text-center text-subtle text-sm">
      <p>暂无 AI 配置</p>
      <p v-if="isAdmin" class="mt-1 text-[12px]">点击供应商列表中的「配置」按钮新增</p>
    </div>
  </div>
</template>
