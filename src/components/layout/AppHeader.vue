<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore, type ThemeMode } from '@/stores/app'
import { useAuth } from '@/composables/useAuth'
import { useAuthModal } from '@/composables/useAuthModal'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const auth = useAuth()
const authModal = useAuthModal()
const { isAuthenticated, user } = auth

const navItems = computed(() => [
  { to: '/', label: '首页' },
  { to: '/workbench', label: 'SQL 工作台' },
  { to: '/workbench/ziwei', label: '紫微斗数' }
])

async function handleSignOut() {
  await auth.signOut()
  await router.push('/')
}

function setTheme(mode: ThemeMode) {
  appStore.setTheme(mode)
}

function openLoginModal() {
  authModal.openModal({ redirectTo: route.fullPath || '/workbench/ddl' })
}

const showMenu = ref(false)

function handleClickOutside(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (showMenu.value && !target.closest('.relative')) {
    showMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-border bg-panel/95 backdrop-blur">
    <div class="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between px-4">
      <div class="flex items-center gap-2">
        <div class="h-7 w-7 rounded-control bg-brand-500/15"></div>
        <p class="text-sm font-semibold tracking-wide text-text">SQLDev Studio</p>
      </div>

      <nav class="hidden items-center gap-1 md:flex">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="rounded-control px-3 py-2 text-sm text-subtle transition-colors hover:bg-panel2 hover:text-text"
          :class="{ 'bg-panel2 text-text': route.path === item.to }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="flex items-center gap-2">
        <div class="hidden items-center rounded-control border border-border bg-panel2 p-1 sm:flex">
          <button
            class="theme-btn"
            :class="{ 'theme-btn-active': appStore.themeMode === 'light' }"
            aria-label="切换浅色主题"
            @click="setTheme('light')"
          >
            浅色
          </button>
          <button
            class="theme-btn"
            :class="{ 'theme-btn-active': appStore.themeMode === 'dark' }"
            aria-label="切换深色主题"
            @click="setTheme('dark')"
          >
            深色
          </button>
          <button
            class="theme-btn"
            :class="{ 'theme-btn-active': appStore.themeMode === 'system' }"
            aria-label="跟随系统主题"
            @click="setTheme('system')"
          >
            系统
          </button>
        </div>

        <div v-if="isAuthenticated" class="relative">
          <button
            class="flex h-8 w-8 items-center justify-center rounded-control text-subtle transition-colors hover:bg-panel2"
            aria-label="更多选项"
            @click.stop="showMenu = !showMenu"
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
          <Transition name="dropdown">
            <div
              v-if="showMenu"
              class="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-control border border-border bg-panel py-1 shadow-soft"
            >
              <RouterLink
                to="/ai-config"
                class="flex items-center gap-2 px-3 py-2 text-sm text-text transition-colors hover:bg-panel2"
                @click="showMenu = false"
              >
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" />
                  <path
                    d="M19.14 15.14a1.72 1.72 0 0 0 .33 1.9l.06.06a2.1 2.1 0 1 1-2.97 2.97l-.06-.06a1.72 1.72 0 0 0-1.9-.33 1.72 1.72 0 0 0-1.04 1.57v.17a2.1 2.1 0 1 1-4.2 0v-.09A1.72 1.72 0 0 0 8.23 19.7a1.72 1.72 0 0 0-1.9.33l-.06.06a2.1 2.1 0 1 1-2.97-2.97l.06-.06a1.72 1.72 0 0 0 .33-1.9 1.72 1.72 0 0 0-1.57-1.04h-.17a2.1 2.1 0 1 1 0-4.2h.09A1.72 1.72 0 0 0 4.3 8.23a1.72 1.72 0 0 0-.33-1.9l-.06-.06A2.1 2.1 0 1 1 6.88 3.3l.06.06a1.72 1.72 0 0 0 1.9.33h.08A1.72 1.72 0 0 0 9.96 2.1v-.17a2.1 2.1 0 1 1 4.2 0v.09a1.72 1.72 0 0 0 1.04 1.57 1.72 1.72 0 0 0 1.9-.33l.06-.06a2.1 2.1 0 1 1 2.97 2.97l-.06.06a1.72 1.72 0 0 0-.33 1.9v.08a1.72 1.72 0 0 0 1.57 1.04h.17a2.1 2.1 0 0 1 0 4.2h-.09a1.72 1.72 0 0 0-1.57 1.04Z"
                  />
                </svg>
                AI 配置
              </RouterLink>
              <RouterLink
                to="/operation-logs"
                class="flex items-center gap-2 px-3 py-2 text-sm text-text transition-colors hover:bg-panel2"
                @click="showMenu = false"
              >
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 6v6l4 2" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                操作日志
              </RouterLink>
            </div>
          </Transition>
        </div>

        <button
          v-if="!isAuthenticated"
          class="rounded-control border border-border px-3 py-2 text-sm text-text transition-colors hover:bg-panel2"
          type="button"
          @click="openLoginModal"
        >
          登录 / 注册
        </button>
        <div v-else class="flex items-center gap-2">
          <span class="hidden text-xs text-subtle sm:block">{{ user?.email }}</span>
          <button class="btn-secondary px-3 py-2 text-sm" @click="handleSignOut">退出</button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
