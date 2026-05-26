<script setup lang="ts">
/**
 * SQL 工作台侧边栏导航 - Apple Style
 *
 * 设计规范：
 * - 纯黑背景，Apple 风格文字
 * - 固定宽度 240px，高度撑满视口
 * - 三层菜单分组：SQL 工具 / 测试工具 / 设置
 * - 可折叠分组，箭头旋转动画
 * - 选中态：Apple 蓝高亮背景药丸
 * - 悬停态：半透明背景，Apple 曲线过渡
 */
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkbenchStore } from '@/stores/workbench'
import { useAuth } from '@/composables/useAuth'
import Icon from '@/components/common/Icon.vue'
import { buildMenuGroups, SECTION_MAP, type MenuItem, type MenuGroup } from './sidebar-menu'

const store = useWorkbenchStore()
const route = useRoute()
const router = useRouter()
const auth = useAuth()

// ==================== 菜单数据 ====================

const collapsedGroups = ref<Record<string, boolean>>({})
const menuGroups = computed(() =>
  buildMenuGroups({ canAccessZiweiTool: auth.canAccessZiweiTool.value })
)

// ==================== 选中状态 ====================

const activeKey = computed(() => {
  const path = route.path
  // 工作台内部页面
  if (path.startsWith('/workbench/')) {
    const section = path.replace('/workbench/', '')
    if (section === 'home') return 'home'
    if (section === 'metadata') return 'metadata'
    if (section === 'sql-convert') return 'sqlConvert'
    if (section === 'id-tool') return 'idTool'
    if (section === 'ziwei') return 'ziweiTool'
    if (section === 'ai-config') return 'aiConfig'
    if (section === 'op-logs') return 'opLogs'
    return section
  }
  // 独立路由页面
  if (path === '/operation-logs') return 'op-logs'
  return 'home'
})

// 同步选中状态到 store
watch(
  activeKey,
  (key) => {
    const allItems = menuGroups.value.flatMap((g) => g.items)
    const item = allItems.find((i) => i.key === key)
    if (item?.page) {
      store.setPage(item.page)
    }
  },
  { immediate: true }
)

// ==================== 折叠状态 ====================

function isGroupCollapsed(group: MenuGroup): boolean {
  if (!group.collapsible) return false
  return collapsedGroups.value[group.key] ?? false
}

function toggleGroup(group: MenuGroup): void {
  if (!group.collapsible) return
  collapsedGroups.value[group.key] = !collapsedGroups.value[group.key]
}

// ==================== 点击处理 ====================

function handleItemClick(item: MenuItem): void {
  if (item.route) {
    router.push(item.route)
  } else if (item.page) {
    const path = SECTION_MAP[item.page]
    if (path && route.path !== path) {
      router.push(path)
    }
  }
  if (window.innerWidth < 1024) {
    store.sidebarOpen = false
  }
}

function isActive(key: string): boolean {
  return activeKey.value === key
}
</script>

<template>
  <aside
    class="h-screen flex flex-col flex-shrink-0"
    :class="{ 'sidebar-open': store.sidebarOpen }"
    style="
      width: var(--sidebar-width);
      background: var(--color-page-panel);
      border-right: 1px solid var(--color-page-border);
    "
    aria-label="主导航"
  >
    <!-- 顶部 Logo 区域 -->
    <div class="flex items-center gap-3 px-5 py-4">
      <div
        class="flex items-center justify-center rounded-lg font-bold"
        style="
          width: 36px;
          height: 36px;
          background: var(--color-page-brand);
          font-size: 12px;
          font-family: var(--font-code);
          letter-spacing: -0.02em;
          color: var(--color-btn-primary-text);
        "
      >
        Dev
      </div>
      <span
        class="font-semibold"
        style="font-size: 15px; letter-spacing: -0.01em; color: var(--color-page-text)"
      >
        Dev Studio
      </span>
    </div>

    <!-- 菜单列表 -->
    <nav class="flex-1 overflow-y-auto py-4 px-3" aria-label="功能菜单">
      <template v-for="(group, groupIndex) in menuGroups" :key="group.key">
        <!-- 分组标题 -->
        <button
          v-if="group.title"
          class="w-full flex items-center justify-between px-3 py-2 cursor-pointer select-none"
          :aria-expanded="!isGroupCollapsed(group)"
          :aria-controls="`group-${group.key}`"
          style="
            color: var(--color-page-text-muted);
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            background: none;
            border: none;
          "
          @click="toggleGroup(group)"
        >
          <span>{{ group.title }}</span>
          <svg
            class="transition-transform duration-200"
            :class="{ 'rotate-180': !isGroupCollapsed(group) }"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <!-- 菜单项列表（带折叠动画） -->
        <Transition name="sidebar-collapse">
          <div v-show="!isGroupCollapsed(group)">
            <button
              v-for="item in group.items"
              :key="item.key"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg relative transition-all duration-150"
              :class="[isActive(item.key) ? 'active-item' : 'inactive-item']"
              @click="handleItemClick(item)"
            >
              <!-- 图标区域 -->
              <span class="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                <Icon :name="item.icon" :size="18" />
              </span>

              <!-- 菜单文字 -->
              <span
                class="flex-1 text-left font-medium"
                style="font-size: 14px; letter-spacing: -0.01em"
              >
                {{ item.label }}
              </span>
            </button>
          </div>
        </Transition>

        <!-- 分组间距 -->
        <div v-if="group.title && groupIndex < menuGroups.length - 1" class="h-3"></div>
      </template>
    </nav>
  </aside>
</template>

<style scoped>
/* 选中态 - Apple 蓝药丸背景 */
.active-item {
  background: var(--color-accent-bg);
  color: var(--color-page-brand);
}

/* 非选中态 */
.inactive-item {
  background: transparent;
  color: var(--color-page-text-subtle);
}

.inactive-item:hover {
  background: var(--color-page-elevated);
  color: var(--color-page-text);
}

/* 侧边栏折叠动画 — 使用 sidebar-collapse-* 避免与 main.css 中的 collapse-* 冲突 */
.sidebar-collapse-enter-active,
.sidebar-collapse-leave-active {
  transition:
    max-height var(--duration-normal) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
  overflow: hidden;
}

.sidebar-collapse-enter-from,
.sidebar-collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.sidebar-collapse-enter-to,
.sidebar-collapse-leave-from {
  max-height: 600px;
  opacity: 1;
}

@media (max-width: 1023px) {
  aside {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 90;
    height: 100dvh;
    transform: translateX(-100%);
    transition: transform 0.3s var(--ease-apple, ease);
    box-shadow: none;
  }

  aside.sidebar-open {
    transform: translateX(0);
    box-shadow: var(--shadow-xl);
  }
}
</style>
