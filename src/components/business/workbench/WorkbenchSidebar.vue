<script setup lang="ts">
/**
 * SQL 工作台侧边栏导航
 *
 * 设计规范：
 * - 深色主题，背景色 #0f1729，文字色 #c8cdd5
 * - 固定宽度 260px，高度撑满视口
 * - 三层菜单分组：SQL 工具 / 测试工具 / 设置
 * - 可折叠分组，箭头旋转动画
 * - 选中态：紫色高亮 + 左侧 3px 竖条指示器
 * - 悬停态：半透明白色背景，transition 150ms
 */
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkbenchStore, type WorkbenchPage } from '@/stores/workbench'

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
  <aside class="h-screen flex flex-col flex-shrink-0" style="width: 260px; background: #0f1729">
    <!-- 顶部 Logo 区域 -->
    <div class="flex items-center gap-3 px-5 py-5">
      <div
        class="flex items-center justify-center rounded-lg font-bold text-white"
        style="
          width: 36px;
          height: 36px;
          background: #6366f1;
          font-size: 12px;
          font-family: var(--font-code);
        "
      >
        SQL
      </div>
      <span class="text-white font-semibold" style="font-size: 16px"> SQL 工作台 </span>
    </div>

    <!-- 分割线 -->
    <div class="mx-5" style="height: 1px; background: rgba(255, 255, 255, 0.1)"></div>

    <!-- 菜单列表 -->
    <nav class="flex-1 overflow-y-auto py-3 px-3">
      <template v-for="(group, groupIndex) in menuGroups" :key="groupIndex">
        <!-- 分组标题 -->
        <button
          v-if="group.title"
          class="w-full flex items-center justify-between px-3 py-2 cursor-pointer select-none"
          style="color: rgba(200, 205, 213, 0.5); font-size: 12px; background: none; border: none"
          @click="toggleGroup(group)"
        >
          <span class="font-medium">{{ group.title }}</span>
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
              :class="[
                isActive(item.key) ? 'text-[#818cf8]' : 'text-[#c8cdd5] hover:bg-white/[0.05]'
              ]"
              :style="{
                background: isActive(item.key) ? 'rgba(99,102,241,0.15)' : 'transparent',
                fontSize: '14px'
              }"
              @click="handleItemClick(item)"
            >
              <!-- 选中态左侧竖条指示器 -->
              <span
                v-if="isActive(item.key)"
                class="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                style="width: 3px; height: 20px; background: #6366f1"
              ></span>

              <!-- 图标区域 -->
              <span class="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                <!-- Grid / Squares-2x2 -->
                <svg v-if="item.icon === 'grid'" viewBox="0 0 20 20" fill="none" class="w-5 h-5">
                  <rect
                    x="2"
                    y="2"
                    width="7"
                    height="7"
                    rx="1.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                  <rect
                    x="11"
                    y="2"
                    width="7"
                    height="7"
                    rx="1.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                  <rect
                    x="2"
                    y="11"
                    width="7"
                    height="7"
                    rx="1.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                  <rect
                    x="11"
                    y="11"
                    width="7"
                    height="7"
                    rx="1.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                </svg>

                <!-- Layers / 堆叠 -->
                <svg
                  v-else-if="item.icon === 'layers'"
                  viewBox="0 0 20 20"
                  fill="none"
                  class="w-5 h-5"
                >
                  <path
                    d="M10 2L2 7L10 12L18 7L10 2Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M2 12L10 17L18 12"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M2 9.5L10 14.5L18 9.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>

                <!-- Terminal / 代码终端 -->
                <svg
                  v-else-if="item.icon === 'terminal'"
                  viewBox="0 0 20 20"
                  fill="none"
                  class="w-5 h-5"
                >
                  <rect
                    x="2"
                    y="3"
                    width="16"
                    height="14"
                    rx="2"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                  <path
                    d="M6 8L10 11L6 14"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M11 14H14"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>

                <!-- Document / 证件 -->
                <svg
                  v-else-if="item.icon === 'document'"
                  viewBox="0 0 20 20"
                  fill="none"
                  class="w-5 h-5"
                >
                  <path
                    d="M4 2H11L15 6V18H4V2Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M11 2V6H15"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                  />
                </svg>

                <!-- Clock / 罗盘时钟 -->
                <svg
                  v-else-if="item.icon === 'clock'"
                  viewBox="0 0 20 20"
                  fill="none"
                  class="w-5 h-5"
                >
                  <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" />
                  <path
                    d="M10 6V10L13 12"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>

                <!-- Document Text / 文件规则 -->
                <svg
                  v-else-if="item.icon === 'document-text'"
                  viewBox="0 0 20 20"
                  fill="none"
                  class="w-5 h-5"
                >
                  <path
                    d="M4 2H11L15 6V18H4V2Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M11 2V6H15"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M7 10H13M7 13H11"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>

                <!-- Sparkles / AI 星光 -->
                <svg
                  v-else-if="item.icon === 'sparkles'"
                  viewBox="0 0 20 20"
                  fill="none"
                  class="w-5 h-5"
                >
                  <path
                    d="M10 2L11.5 6.5L16 8L11.5 9.5L10 14L8.5 9.5L4 8L8.5 6.5L10 2Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M15 13L15.5 14.5L17 15L15.5 15.5L15 17L14.5 15.5L13 15L14.5 14.5L15 13Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M5 13L5.25 13.75L6 14L5.25 14.25L5 15L4.75 14.25L4 14L4.75 13.75L5 13Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                  />
                </svg>

                <!-- Cog / 齿轮设置 -->
                <svg
                  v-else-if="item.icon === 'cog'"
                  viewBox="0 0 20 20"
                  fill="none"
                  class="w-5 h-5"
                >
                  <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5" />
                  <path
                    d="M10 2V4M10 16V18M18 10H16M4 10H2M15.5 4.5L14 6M6 14L4.5 15.5M15.5 15.5L14 14M6 6L4.5 4.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>

                <!-- Clock History / 操作日志 -->
                <svg
                  v-else-if="item.icon === 'clock-history'"
                  viewBox="0 0 20 20"
                  fill="none"
                  class="w-5 h-5"
                >
                  <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" />
                  <path
                    d="M10 6V10L13 12"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M6 4L5 2"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                  <path
                    d="M14 4L15 2"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </span>

              <!-- 菜单文字 -->
              <span class="flex-1 text-left font-medium">{{ item.label }}</span>
            </button>
          </div>
        </Transition>

        <!-- 分组间距 -->
        <div v-if="group.title && groupIndex < menuGroups.length - 1" class="h-2"></div>
      </template>
    </nav>
  </aside>
</template>

<style scoped>
/* 折叠/展开动画 */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
