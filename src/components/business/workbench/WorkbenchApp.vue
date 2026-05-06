<!-- [2026-05-05] 更新：工作台主应用容器 - 完全匹配 UI 预览 -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'
import WorkbenchSidebar from './WorkbenchSidebar.vue'
import DdlPage from './pages/DdlPage.vue'
import FunctionPage from './pages/FunctionPage.vue'
import ProcedurePage from './pages/ProcedurePage.vue'
import IdToolPage from './pages/IdToolPage.vue'
import ZiweiPage from './pages/ZiweiPage.vue'
import RulesPage from './pages/RulesPage.vue'
import AiConfigPage from '@/components/business/ai/AiConfigPage.vue'
import AlertModal from './modals/AlertModal.vue'
import ConfirmModal from './modals/ConfirmModal.vue'

const store = useWorkbenchStore()

onMounted(() => {
  store.isMacPlatform = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
})
</script>

<template>
  <div class="wb-layout">
    <!-- Sidebar -->
    <WorkbenchSidebar />

    <!-- Main Content -->
    <div class="wb-main">
      <!-- Page Content -->
      <main class="wb-content">
        <DdlPage v-if="store.activePage === 'ddl'" />
        <FunctionPage v-else-if="store.activePage === 'func'" />
        <ProcedurePage v-else-if="store.activePage === 'proc'" />
        <IdToolPage v-else-if="store.activePage === 'idTool'" />
        <ZiweiPage v-else-if="store.activePage === 'ziweiTool'" />
        <RulesPage v-else-if="store.activePage === 'rules'" />
        <AiConfigPage v-else-if="store.activePage === 'aiConfig'" />
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

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  font-size: 14px;
}
</style>
