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
import { useWorkbenchStore, type WorkbenchPage } from '@/stores/workbench'
import Icon from '@/components/common/Icon.vue'

const store = useWorkbenchStore()
const route = useRoute()
const router = useRouter()

// ==================== 类型定义 ====================

interface MenuItem {
  key: string
  label: string
  icon: string
  page?: WorkbenchPage // 工作台内部页面
  route?: string // 独立路由页面
}

interface MenuGroup {
  title: string | null
  collapsible: boolean
  items: MenuItem[]
}

// ==================== 菜单数据 ====================

const testToolsCollapsed = ref(false)
const settingsCollapsed = ref(false)

const menuGroups = computed<MenuGroup[]>(() => [
  // 第一组：SQL 工具（不可折叠）
  {
    title: null,
    collapsible: false,
    items: [
      { key: 'ddl', label: 'DDL 语句', icon: 'grid', page: 'ddl' },
      { key: 'func', label: '函数', icon: 'layers', page: 'func' },
      { key: 'proc', label: '存储过程', icon: 'terminal', page: 'proc' }
    ]
  },
  // 第二组：测试工具（可折叠）
  {
    title: '测试工具',
    collapsible: true,
    items: [
      { key: 'idTool', label: '证件号码生成', icon: 'document', page: 'idTool' },
      { key: 'ziweiTool', label: '紫微斗数命盘', icon: 'clock', page: 'ziweiTool' }
    ]
  },
  // 第三组：设置（可折叠）
  {
    title: '设置',
    collapsible: true,
    items: [
      { key: 'rules', label: '映射规则', icon: 'document-text', page: 'rules' },
      { key: 'aiConfig', label: 'AI 助手配置', icon: 'sparkles', page: 'aiConfig' },
      { key: 'appConfig', label: '应用配置', icon: 'cog', page: 'appConfig' },
      { key: 'opLogs', label: '操作日志', icon: 'clock-history', page: 'opLogs' }
    ]
  }
])

// ==================== 选中状态 ====================

/** 从当前路由推断选中的菜单 key */
const activeKey = computed(() => {
  const path = route.path
  // 工作台内部页面
  if (path.startsWith('/workbench/')) {
    const section = path.replace('/workbench/', '')
    if (section === 'function') return 'func'
    if (section === 'procedure') return 'proc'
    if (section === 'id-tool') return 'idTool'
    if (section === 'ziwei') return 'ziweiTool'
    if (section === 'rules') return 'rules'
    if (section === 'ai-config') return 'aiConfig'
    if (section === 'app-config') return 'appConfig'
    if (section === 'op-logs') return 'opLogs'
    return section
  }
  // 独立路由页面
  if (path === '/app-config') return 'app-config'
  if (path === '/operation-logs') return 'op-logs'
  return 'ddl'
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
  if (group.title === '测试工具') return testToolsCollapsed.value
  if (group.title === '设置') return settingsCollapsed.value
  return false
}

function toggleGroup(group: MenuGroup): void {
  if (!group.collapsible) return
  if (group.title === '测试工具') testToolsCollapsed.value = !testToolsCollapsed.value
  else if (group.title === '设置') settingsCollapsed.value = !settingsCollapsed.value
}

// ==================== 点击处理 ====================

function handleItemClick(item: MenuItem): void {
  if (item.page) {
    store.setPage(item.page)
  }
  if (item.route) {
    router.push(item.route)
  } else if (item.page) {
    // 工作台内部页面，映射路由路径
    const sectionMap: Record<string, string> = {
      ddl: '/workbench/ddl',
      func: '/workbench/function',
      proc: '/workbench/procedure',
      idTool: '/workbench/id-tool',
      ziweiTool: '/workbench/ziwei',
      rules: '/workbench/rules',
      aiConfig: '/workbench/ai-config',
      appConfig: '/workbench/app-config',
      opLogs: '/workbench/op-logs'
    }
    const path = sectionMap[item.page]
    if (path && route.path !== path) {
      router.push(path)
    }
  }
}

function isActive(key: string): boolean {
  return activeKey.value === key
}
</script>

<template>
  <aside
    class="h-screen flex flex-col flex-shrink-0"
    style="width: 240px; background: var(--color-page-panel); border-right: 1px solid var(--color-page-border)"
  >
    <!-- 顶部 Logo 区域 -->
    <div class="flex items-center gap-3 px-5 pt-5 pb-3">
      <div
        class="flex items-center justify-center rounded-lg font-bold text-white"
        style="
          width: 36px;
          height: 36px;
          background: var(--color-page-brand);
          font-size: 12px;
          font-family: var(--font-code);
          letter-spacing: -0.02em;
        "
      >
        Dev
      </div>
      <span class="text-white font-semibold" style="font-size: 15px; letter-spacing: -0.01em">
        Dev Studio
      </span>
    </div>

    <!-- 菜单列表 -->
    <nav class="flex-1 overflow-y-auto py-4 px-3">
      <template v-for="(group, groupIndex) in menuGroups" :key="groupIndex">
        <!-- 分组标题 -->
        <button
          v-if="group.title"
          class="w-full flex items-center justify-between px-3 py-2 cursor-pointer select-none"
          style="
            color: rgba(160, 160, 165, 0.6);
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
        <Transition name="collapse">
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
              <span class="flex-1 text-left font-medium" style="font-size: 14px; letter-spacing: -0.01em">
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
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-page-text);
}

/* 折叠动画 */
.collapse-enter-active,
.collapse-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
