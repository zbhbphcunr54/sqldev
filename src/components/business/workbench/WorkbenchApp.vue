<!-- [2026-05-05] 更新：工作台主应用容器 - 完全匹配 UI 预览 -->
<!-- [2026-05-07] 修复：添加页面懒加载以提升首屏性能 -->
<script setup lang="ts">
import { defineAsyncComponent, h } from 'vue'
import { onMounted } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'
import WorkbenchSidebar from './WorkbenchSidebar.vue'
import WorkbenchHeaderActions from './WorkbenchHeaderActions.vue'

const asyncPageOptions = {
  loadingComponent: {
    render() {
      return h(
        'div',
        {
          style:
            'display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);font-size:14px;'
        },
        '加载中...'
      )
    }
  },
  errorComponent: {
    render() {
      return h(
        'div',
        {
          style:
            'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:var(--color-danger-text);font-size:14px;'
        },
        [
          h('span', '页面加载失败'),
          h(
            'button',
            {
              style:
                'padding:6px 14px;border:1px solid var(--color-border);border-radius:6px;background:var(--color-panel-2);color:var(--color-text);cursor:pointer;font-size:13px;',
              onClick: () => window.location.reload()
            },
            '重试'
          )
        ]
      )
    }
  },
  delay: 200
}

// 懒加载页面组件 - 按需加载，不影响首屏
const SqlConvertPage = defineAsyncComponent({
  ...asyncPageOptions,
  loader: () => import('./pages/SqlConvertPage.vue')
})
const IdToolPage = defineAsyncComponent({
  ...asyncPageOptions,
  loader: () => import('./pages/IdToolPage.vue')
})
const ZiweiPage = defineAsyncComponent({
  ...asyncPageOptions,
  loader: () => import('./pages/ZiweiPage.vue')
})
const AiConfigPage = defineAsyncComponent({
  ...asyncPageOptions,
  loader: () => import('@/components/business/ai/AiConfigPage.vue')
})
const OperationLogsPage = defineAsyncComponent({
  ...asyncPageOptions,
  loader: () => import('./pages/OperationLogsPage.vue')
})

import AlertModal from './modals/AlertModal.vue'
import ConfirmModal from './modals/ConfirmModal.vue'

const store = useWorkbenchStore()

onMounted(() => {
  store.isMacPlatform = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
})
</script>

<template>
  <div class="wb-layout">
    <!-- 全局顶部分割线 -->
    <div class="wb-global-divider"></div>

    <!-- 右上角操作按钮 -->
    <WorkbenchHeaderActions />

    <!-- Sidebar -->
    <WorkbenchSidebar />

    <!-- Main Content -->
    <div class="wb-main">
      <!-- Page Content -->
      <main class="wb-content" :class="{ 'wb-content-no-scroll': store.activePage === 'aiConfig' }">
        <SqlConvertPage v-if="store.activePage === 'sqlConvert'" />
        <IdToolPage v-else-if="store.activePage === 'idTool'" />
        <ZiweiPage v-else-if="store.activePage === 'ziweiTool'" />
        <AiConfigPage v-else-if="store.activePage === 'aiConfig'" />
        <OperationLogsPage v-else-if="store.activePage === 'opLogs'" />
        <div v-else class="placeholder" role="status" aria-live="polite">选择一个功能开始</div>
      </main>
    </div>

    <!-- Modals -->
    <AlertModal />
    <ConfirmModal />
  </div>
</template>

<style scoped>
.wb-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.wb-global-divider {
  position: absolute;
  top: calc(var(--header-height, 56px) + 12px);
  left: 0;
  right: 0;
  height: 1px;
  background: var(--color-page-border);
  z-index: 50;
  pointer-events: none;
}

.wb-page-idtool .wb-global-divider {
  top: calc(var(--header-height, 56px) + 44px);
}

.wb-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.wb-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.wb-content-no-scroll {
  overflow-y: hidden;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  font-size: 14px;
}
</style>
