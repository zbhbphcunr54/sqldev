<!-- [2026-05-03] 工作台主应用容器 -->
<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'
import WorkbenchSidebar from './WorkbenchSidebar.vue'
import WorkbenchHeader from './WorkbenchHeader.vue'
import WorkbenchActionBar from './WorkbenchActionBar.vue'
import DdlPage from './pages/DdlPage.vue'
import FunctionPage from './pages/FunctionPage.vue'
import ProcedurePage from './pages/ProcedurePage.vue'
import IdToolPage from './pages/IdToolPage.vue'
import ZiweiPage from './pages/ZiweiPage.vue'
import RulesPage from './pages/RulesPage.vue'
import AlertModal from './modals/AlertModal.vue'
import ConfirmModal from './modals/ConfirmModal.vue'

const store = useWorkbenchStore()

onMounted(() => {
  store.isMacPlatform = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
})
</script>

<template>
  <div class="workbench-root">
    <!-- Sidebar -->
    <WorkbenchSidebar />

    <!-- Main Content -->
    <div class="workbench-main">
      <!-- Header -->
      <WorkbenchHeader />

      <!-- Action Bar -->
      <WorkbenchActionBar />

      <!-- Page Content -->
      <main class="workbench-content">
        <DdlPage v-if="store.activePage === 'ddl'" />
        <FunctionPage v-else-if="store.activePage === 'func'" />
        <ProcedurePage v-else-if="store.activePage === 'proc'" />
        <IdToolPage v-else-if="store.activePage === 'idTool'" />
        <ZiweiPage v-else-if="store.activePage === 'ziweiTool'" />
        <RulesPage v-else-if="store.activePage === 'rules' || store.activePage === 'bodyRules'" />
        <div v-else class="placeholder">选择一个功能开始</div>
      </main>
    </div>

    <!-- Modals -->
    <AlertModal />
    <ConfirmModal />
  </div>
</template>

<style scoped>
.workbench-root {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

.workbench-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.workbench-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
  font-size: 14px;
}
</style>
