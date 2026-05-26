<!-- [2026-05-05] 更新：工作台主应用容器 - 完全匹配 UI 预览 -->
<!-- [2026-05-07] 修复：添加页面懒加载以提升首屏性能 -->
<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h, onMounted } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'
import { useAuth } from '@/composables/useAuth'
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
const KeepAliveZiweiPage = defineComponent({
  name: 'KeepAliveZiweiPage',
  setup() {
    return () => h(ZiweiPage)
  }
})
const AiConfigPage = defineAsyncComponent({
  ...asyncPageOptions,
  loader: () => import('@/components/business/ai/AiConfigPage.vue')
})
const OperationLogsPage = defineAsyncComponent({
  ...asyncPageOptions,
  loader: () => import('./pages/OperationLogsPage.vue')
})
const HomePage = defineAsyncComponent({
  ...asyncPageOptions,
  loader: () => import('./pages/HomePage.vue')
})
const MetadataPage = defineAsyncComponent({
  ...asyncPageOptions,
  loader: () => import('./pages/MetadataPage.vue')
})
const KeepAliveMetadataPage = defineComponent({
  name: 'KeepAliveMetadataPage',
  setup() {
    return () => h(MetadataPage)
  }
})

import AlertModal from './modals/AlertModal.vue'
import ConfirmModal from './modals/ConfirmModal.vue'

const store = useWorkbenchStore()
const auth = useAuth()
const ziweiCacheScope = computed(() => auth.user.value?.id ?? 'guest')
const activePageComponent = computed(() => {
  if (store.activePage === 'home') return HomePage
  if (store.activePage === 'metadata') return KeepAliveMetadataPage
  if (store.activePage === 'sqlConvert') return SqlConvertPage
  if (store.activePage === 'idTool') return IdToolPage
  if (store.activePage === 'ziweiTool') {
    return auth.canAccessZiweiTool.value ? KeepAliveZiweiPage : null
  }
  if (store.activePage === 'aiConfig') return AiConfigPage
  if (store.activePage === 'opLogs') return OperationLogsPage
  return null
})
const activePageKey = computed(() => {
  if (store.activePage === 'ziweiTool') return 'ziweiTool'
  if (store.activePage === 'metadata') return 'metadata'
  return store.activePage
})

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

    <!-- 移动端汉堡按钮 -->
    <button
      class="wb-hamburger"
      :class="{ 'wb-hamburger--open': store.sidebarOpen }"
      aria-label="切换导航菜单"
      @click="store.sidebarOpen = !store.sidebarOpen"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          v-if="!store.sidebarOpen"
          d="M3 5h14M3 10h14M3 15h14"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <path
          v-else
          d="M5 5l10 10M5 15L15 5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <!-- 移动端遮罩层 -->
    <Transition name="fade">
      <div
        v-if="store.sidebarOpen"
        class="wb-backdrop hidden"
        @click="store.sidebarOpen = false"
      ></div>
    </Transition>

    <!-- Sidebar -->
    <WorkbenchSidebar />

    <!-- Main Content -->
    <div class="wb-main">
      <!-- Page Content -->
      <main class="wb-content" :class="{ 'wb-content-no-scroll': store.activePage === 'aiConfig' }">
        <KeepAlive
          :key="ziweiCacheScope"
          :include="['KeepAliveZiweiPage', 'KeepAliveMetadataPage']"
          :max="2"
        >
          <component :is="activePageComponent" v-if="activePageComponent" :key="activePageKey" />
        </KeepAlive>
        <div v-if="!activePageComponent" class="placeholder" role="status" aria-live="polite">
          选择一个功能开始
        </div>
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

.wb-hamburger {
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 110;
  width: 44px;
  height: 44px;
  display: none;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-panel);
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.15s ease;
}

.wb-hamburger:hover {
  background: var(--color-panel-2);
}

.wb-hamburger--open {
  z-index: 110;
}

.wb-backdrop {
  position: fixed;
  inset: 0;
  z-index: 89;
  background: rgba(0, 0, 0, 0.4);
}

@media (max-width: 1023px) {
  .wb-hamburger {
    display: flex;
    top: 4px;
    left: 8px;
    width: 40px;
    height: 40px;
    border: none;
    background: transparent;
    box-shadow: none;
  }

  .wb-hamburger:hover {
    background: var(--color-panel-2);
  }

  .wb-backdrop {
    display: block;
  }

  .wb-global-divider {
    display: none;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
