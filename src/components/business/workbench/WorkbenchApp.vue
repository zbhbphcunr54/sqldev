<!-- [2026-05-05] 更新：工作台主应用容器 - 完全匹配 UI 预览 -->
<!-- [2026-05-07] 修复：添加页面懒加载以提升首屏性能 -->
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { onMounted } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'
import WorkbenchSidebar from './WorkbenchSidebar.vue'
import WorkbenchHeaderActions from './WorkbenchHeaderActions.vue'

// 懒加载页面组件 - 按需加载，不影响首屏
const DdlPage = defineAsyncComponent(() => import('./pages/DdlPage.vue'))
const FunctionPage = defineAsyncComponent(() => import('./pages/FunctionPage.vue'))
const ProcedurePage = defineAsyncComponent(() => import('./pages/ProcedurePage.vue'))
const IdToolPage = defineAsyncComponent(() => import('./pages/IdToolPage.vue'))
const ZiweiPage = defineAsyncComponent(() => import('./pages/ZiweiPage.vue'))
const RulesPage = defineAsyncComponent(() => import('./pages/RulesPage.vue'))
const AiConfigPage = defineAsyncComponent(() => import('@/components/business/ai/AiConfigPage.vue'))
const AppConfigPage = defineAsyncComponent(
  () => import('@/components/business/app-config/AppConfigPage.vue')
)
const OperationLogsPage = defineAsyncComponent(() => import('./pages/OperationLogsPage.vue'))

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
      <main
        class="wb-content"
        :class="{ 'wb-content-no-scroll': store.activePage === 'aiConfig' }"
      >
        <DdlPage v-if="store.activePage === 'ddl'" />
        <FunctionPage v-else-if="store.activePage === 'func'" />
        <ProcedurePage v-else-if="store.activePage === 'proc'" />
        <IdToolPage v-else-if="store.activePage === 'idTool'" />
        <ZiweiPage v-else-if="store.activePage === 'ziweiTool'" />
        <RulesPage v-else-if="store.activePage === 'rules'" />
        <AiConfigPage v-else-if="store.activePage === 'aiConfig'" />
        <AppConfigPage v-else-if="store.activePage === 'appConfig'" />
        <OperationLogsPage v-else-if="store.activePage === 'opLogs'" />
        <div v-else class="placeholder">选择一个功能开始</div>
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
  top: 68px;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--color-page-border);
  z-index: 50;
  pointer-events: none;
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
